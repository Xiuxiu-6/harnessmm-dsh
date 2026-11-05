// Host contract tests for the productized GDR/CCS port. No model calls:
// the "slow actor" and the "native dispatcher" are scripted by the test.
// The module under test is the one the installed bundle ships.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GuardedReuseController, parseBank, localGuard, admitStep, chainDepth,
  decisionState, planInstruction, validatePolicy, BankContractError,
} from '../engine.js';

const policy = { version: 6, enabled: true, maximum_candidates: 16,
  maximum_fast_steps: 8, maximum_public_bytes: 65536 };
const tools = [
  { name: 'read', parameters: { type: 'object', properties: { file_path: { type: 'string' } },
    required: ['file_path'], additionalProperties: false } },
  { name: 'glob', parameters: { type: 'object', properties: { pattern: { type: 'string' } },
    required: ['pattern'], additionalProperties: false } },
];

function authorMessage(candidates, root = { name: 'glob', arguments: { pattern: 'src/**/*.ts' } }) {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text: `<CHISEL_PLAN>${JSON.stringify({ candidates })}</CHISEL_PLAN>` },
      { type: 'tool-call', id: 'root-call', name: root.name, arguments: JSON.stringify(root.arguments) },
    ],
  };
}

function node(id, predecessor, tool, args, guard = { return_code: 0 }) {
  return { candidate_id: id, predecessor_id: predecessor, tool, arguments: args, guard,
    required_receipt_fields: ['return_code', 'stdout', 'stderr'],
    expected_local_cost: { selector_upper_tokens: 8192 }, dependency_ids: [] };
}

const receipt = (callId, value, isError = false) => ({
  role: 'tool', toolCallId: callId, isError,
  content: [{ type: 'text', text: JSON.stringify(value) }],
});

test('policy validation rejects anything but the v6 contract', () => {
  assert.deepEqual({ ...validatePolicy(policy) }, policy);
  assert.throws(() => validatePolicy({ ...policy, version: 5 }), /Invalid frozen GDR policy/);
  assert.throws(() => validatePolicy({ ...policy, extra: 1 }), /Invalid frozen GDR policy/);
  assert.throws(() => validatePolicy({ ...policy, maximum_fast_steps: 99 }), /Invalid frozen GDR policy/);
});

test('plan instruction names the live catalog and the exact node contract', () => {
  const text = planInstruction(policy, tools);
  assert.match(text, /<CHISEL_PLAN>/);
  assert.match(text, /read, glob/);
  assert.match(text, /candidate_id/);
});

test('a bank validates against the live tool schema and rejects unknown tools', () => {
  const bank = parseBank(authorMessage([node('A', 'root', 'read', { file_path: 'a.ts' })]), policy, tools);
  assert.equal(bank.candidates.length, 1);
  assert.throws(() => parseBank(authorMessage([node('A', 'root', 'nope', { file_path: 'a.ts' })]), policy, tools),
    BankContractError);
  assert.throws(() => parseBank(authorMessage([node('A', 'root', 'read', { file_path: 'a.ts', extra: 1 })]), policy, tools),
    BankContractError);
});

test('a bank cannot repeat the root call', () => {
  const root = { name: 'glob', arguments: { pattern: 'src/**/*.ts' } };
  assert.throws(() => parseBank(authorMessage([node('A', 'root', 'glob', root.arguments)], root), policy, tools),
    /cannot repeat the already executed native root/);
});

test('duplicate or forward predecessors are rejected', () => {
  assert.throws(() => parseBank(authorMessage([
    node('A', 'root', 'read', { file_path: 'a.ts' }),
    node('A', 'root', 'read', { file_path: 'b.ts' }),
  ]), policy, tools), BankContractError);
  assert.throws(() => parseBank(authorMessage([
    node('A', 'B', 'read', { file_path: 'a.ts' }),
  ]), policy, tools), BankContractError);
});

test('guards are evaluated deterministically against the native receipt', () => {
  const n = node('A', 'root', 'read', { file_path: 'a.ts' }, { return_code: 0, stdout_equals: 'OK' });
  assert.equal(localGuard(n, { value: { return_code: 0, stdout: 'OK', stderr: null } }).eligible, true);
  assert.equal(localGuard(n, { value: { return_code: 0, stdout: 'NO', stderr: null } }).reason, 'guard_false');
  assert.equal(localGuard(n, { is_error: true, value: { return_code: 0, stdout: 'OK' } }).reason, 'native_error');
  assert.equal(localGuard(n, { value: { stdout: 'OK' } }).reason, 'required_field_missing');
  assert.equal(localGuard(n, { value: 'not json' }).reason, 'guard_false');
});

test('plain-text native receipts are judged as command output', () => {
  // DSH ships tool results as content[0].text, not a JSON envelope: a shell
  // command's receipt is literally "CLEAN src/a.js\n". The guard must still be
  // decidable, with stdout = the text and return_code derived from is_error.
  const n = node('A', 'root', 'read', { file_path: 'a.ts' },
    { return_code: 0, stdout_contains: 'CLEAN' });
  const text = (body, isError = false) => ({
    call_id: 'call_1', is_error: isError, value: { native_text: body },
  });
  assert.equal(localGuard(n, text('CLEAN src/a.js\n')).eligible, true);
  assert.equal(localGuard(n, text('DIRTY src/a.js 3\n')).reason, 'guard_false');
  assert.equal(localGuard(n, text('CLEAN src/a.js\n', true)).reason, 'native_error');
  // A declared-but-unused field (stderr) must not invalidate a decidable guard.
  assert.equal(localGuard(n, text('CLEAN src/a.js\n')).eligible, true);
  // stderr_empty cannot be judged from a text receipt, so it stays ineligible.
  const se = node('A', 'root', 'read', { file_path: 'a.ts' }, { stderr_empty: true });
  assert.equal(localGuard(se, text('CLEAN src/a.js\n')).known, false);
});

test('json_equals reads a nested path and refuses prototype keys', () => {
  const ok = node('A', 'root', 'read', { file_path: 'a.ts' }, { json_equals: { path: ['a', 'b'], value: 1 } });
  assert.equal(localGuard(ok, { value: { return_code: 0, stdout: '{"a":{"b":1}}', stderr: null } }).eligible, true);
  const bad = node('A', 'root', 'read', { file_path: 'a.ts' }, { json_equals: { path: ['__proto__'], value: 1 } });
  assert.equal(localGuard(bad, { value: { return_code: 0, stdout: '{}', stderr: null } }).known, false);
});

test('chain depth counts literal future callbacks', () => {
  const bank = parseBank(authorMessage([
    node('A', 'root', 'read', { file_path: 'a.ts' }),
    node('B', 'A', 'read', { file_path: 'b.ts' }),
    node('C', 'B', 'read', { file_path: 'c.ts' }),
  ]), policy, tools);
  assert.equal(chainDepth(bank), 3);
});

// The end-to-end path: slow actor authors, controller substitutes, native
// dispatcher executes, certificate is recorded, and slow returns at exhaustion.
test('certified callback substitution end to end', async () => {
  const events = [];
  const controller = new GuardedReuseController({ policy, record: event => events.push(event) });
  const sessionId = 'session-1';
  const candidates = [
    node('A', 'root', 'read', { file_path: 'src/a.ts' }),
    node('B', 'A', 'read', { file_path: 'src/b.ts' }),
  ];
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'Read the two files.' }] },
    authorMessage(candidates),
    receipt('root-call', { return_code: 0, stdout: 'found 2 files', stderr: null }),
  ];

  const bank = controller.author(sessionId, messages[1].content, tools);
  assert.ok(bank);
  assert.equal(events.at(-1).admitted, true);

  // Step 1: the controller compiles candidate A through the native boundary.
  const first = await controller.prepare({ sessionId, options: { messages, tools }, tools });
  assert.equal(first.call.name, 'read');
  assert.deepEqual(JSON.parse(first.call.arguments), { file_path: 'src/a.ts' });

  // The native dispatcher runs the ORIGINAL tool with those exact arguments.
  const executed = [];
  executed.push({ callId: first.call.id, name: first.call.name, args: JSON.parse(first.call.arguments) });
  const certified = controller.observeTool({
    sessionId, callId: first.call.id, name: first.call.name,
    args: JSON.parse(first.call.arguments), isError: false,
    value: { return_code: 0, stdout: 'file A', stderr: null },
    content: [{ type: 'text', text: JSON.stringify({ return_code: 0, stdout: 'file A', stderr: null }) }],
  });
  assert.equal(certified, true);

  // The Host appends the substitution call and its receipt; step 2 follows.
  messages.push({ role: 'assistant', content: [first.call] },
    receipt(first.call.id, { return_code: 0, stdout: 'file A', stderr: null }));
  const second = await controller.prepare({ sessionId, options: { messages, tools }, tools });
  assert.equal(second.call.name, 'read');
  assert.deepEqual(JSON.parse(second.call.arguments), { file_path: 'src/b.ts' });

  // After the last candidate the graph is exhausted and the slow actor resumes.
  controller.observeTool({
    sessionId, callId: second.call.id, name: second.call.name,
    args: JSON.parse(second.call.arguments), isError: false,
    value: { return_code: 0, stdout: 'file B', stderr: null },
    content: [{ type: 'text', text: '{}' }],
  });
  messages.push({ role: 'assistant', content: [second.call] },
    receipt(second.call.id, { return_code: 0, stdout: 'file B', stderr: null }));
  assert.equal(await controller.prepare({ sessionId, options: { messages, tools }, tools }), null);

  const certificates = events.filter(event => event.kind === 'gdr/substitution-certificate');
  assert.equal(certificates.length, 2);
  assert.deepEqual(certificates.map(item => item.candidate_id), ['A', 'B']);
  assert.equal(certificates.every(item => item.valid_substitution), true);
  assert.equal(certificates.every(item => item.slow_requests_at_boundary === 0), true);
});

test('a guard that does not hold returns control to the slow actor', async () => {
  const controller = new GuardedReuseController({ policy });
  const sessionId = 'session-2';
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'go' }] },
    authorMessage([node('A', 'root', 'read', { file_path: 'a.ts' }, { return_code: 0, stdout_contains: 'MISSING' })]),
    receipt('root-call', { return_code: 0, stdout: 'present', stderr: null }),
  ];
  controller.author(sessionId, messages[1].content, tools);
  assert.equal(await controller.prepare({ sessionId, options: { messages, tools }, tools }), null);
});

test('two eligible successors defer to the slow actor instead of guessing', async () => {
  const events = [];
  // 这个用例测的是「两个候选都合格时不要猜」，与链深无关；
  // 这里的 bank 只有 1 步，所以要显式把 minimumChain 放到 1。
  const controller = new GuardedReuseController({ policy, minimumChain: 1, record: event => events.push(event) });
  const sessionId = 'session-3';
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'go' }] },
    authorMessage([
      node('A', 'root', 'read', { file_path: 'a.ts' }),
      node('B', 'root', 'read', { file_path: 'b.ts' }),
    ]),
    receipt('root-call', { return_code: 0, stdout: 'ok', stderr: null }),
  ];
  controller.author(sessionId, messages[1].content, tools);
  assert.equal(await controller.prepare({ sessionId, options: { messages, tools }, tools }), null);
  assert.equal(events.some(event => event.kind === 'gdr/defer' && event.reason === 'ambiguous_eligible'), true);
});

test('a mismatched native action is never certified', async () => {
  const events = [];
  // 测的是「原生调用被篡改就不发证书」，与链深无关；bank 只有 1 步。
  const controller = new GuardedReuseController({ policy, minimumChain: 1, record: event => events.push(event) });
  const sessionId = 'session-4';
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'go' }] },
    authorMessage([node('A', 'root', 'read', { file_path: 'a.ts' })]),
    receipt('root-call', { return_code: 0, stdout: 'ok', stderr: null }),
  ];
  controller.author(sessionId, messages[1].content, tools);
  const step = await controller.prepare({ sessionId, options: { messages, tools }, tools });
  const certified = controller.observeTool({
    sessionId, callId: step.call.id, name: step.call.name,
    args: { file_path: 'TAMPERED.ts' }, isError: false, value: {}, content: [],
  });
  assert.equal(certified, false);
  assert.equal(events.filter(event => event.kind === 'gdr/substitution-certificate').length, 0);
  assert.equal(events.some(event => event.kind === 'gdr/uncertified-execution'), true);
});

test('a bank below the literal-chain minimum is not admitted', () => {
  const events = [];
  const controller = new GuardedReuseController({
    policy: { ...policy, maximum_fast_steps: 8 }, minimumChain: 3, record: event => events.push(event),
  });
  const authored = controller.author('s', authorMessage([
    node('A', 'root', 'read', { file_path: 'a.ts' }),
  ]).content, tools);
  assert.equal(authored, null);
  assert.equal(events.at(-1).admitted, false);
});

test('a pending action resolves by call id and records a session mismatch', async () => {
  const events = [];
  const controller = new GuardedReuseController({ policy, minimumChain: 1, record: event => events.push(event) });
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'go' }] },
    authorMessage([node('A', 'root', 'read', { file_path: 'a.ts' })], { name: 'read', arguments: { file_path: 'root.ts' } }),
    receipt('root-call', { return_code: 0, stdout: 'ok', stderr: null }),
  ];
  controller.author('session-a', messages[1].content, tools);
  const step = await controller.prepare({ sessionId: 'session-a', options: { messages, tools }, tools });
  assert.equal(controller.observeTool({
    sessionId: 'session-b', callId: step.call.id, name: step.call.name,
    args: { file_path: 'a.ts' }, isError: false, value: {}, content: [],
  }), true);
  assert.equal(events.some(event => event.kind === 'gdr/session-identity-mismatch'), true);
  // An id this controller never minted is refused outright.
  assert.equal(controller.observeTool({
    sessionId: 'session-b', callId: 'gdr_nope_A', name: 'read',
    args: { file_path: 'a.ts' }, isError: false, value: {}, content: [],
  }), false);
});

test('the request is never mutated when the bank is re-projected', () => {
  const controller = new GuardedReuseController({ policy });
  const authored = authorMessage([node('A', 'root', 'read', { file_path: 'a.ts' })]);
  controller.author('s', authored.content, tools);
  const call = { type: 'tool-call', id: 'gdr_x_A', name: 'read', arguments: '{"file_path":"a.ts"}' };
  const messages = Object.freeze([
    { role: 'user', content: [{ type: 'text', text: 'go' }] },
    Object.freeze({ role: 'assistant', content: Object.freeze([call]) }),
  ]);
  const projected = controller.projectMessages({ messages }, { bank: {}, originals: new Map() });
  // Same content, but a new array: the frozen Host request is never mutated.
  assert.notEqual(projected, messages);
  assert.deepEqual(projected, messages);
  assert.throws(() => { messages[1].content.push(call); });
});

test('receipt parsing rejects non-scalar native results', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'go' }] },
    authorMessage([node('A', 'root', 'read', { file_path: 'a.ts' })]),
    { role: 'tool', toolCallId: 'root-call', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
  ];
  assert.equal(decisionState(messages, policy, tools), null);
});
