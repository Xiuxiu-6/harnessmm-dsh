// Integration test for the Host wiring of the HarnessMM plugin.
//
// `cordis` is not a workspace dependency, so this file drives the plugin with a
// minimal Context that implements exactly the contract the plugin uses:
//   - `ctx.inject(deps, callback)`, `ctx.effect(fn)`, `ctx.on(name, listener)`
//   - `ctx.tools.schemas/register`, `ctx.systemPrompt.section`
//   - a waterfall dispatcher for `llm/stream` and `tools/post-execute`
// The engine itself is covered by harness_plugin_engine.test.mjs.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as plugin from '../index.js';

// 审计是往 home 下写的。测试必须把它指到临时目录，否则 `npm test` 会污染用户目录。
const auditDir = mkdtempSync(path.join(tmpdir(), 'hmm-audit-'));
process.env.HARNESSMM_AUDIT = path.join(auditDir, 'default.jsonl');
after(() => rmSync(auditDir, { recursive: true, force: true }));

/** 轮询等待异步 append 落盘。 */
async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = predicate();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

const PLAN = candidates => `<CHISEL_PLAN>${JSON.stringify({ candidates })}</CHISEL_PLAN>`;

function node(id, predecessor, args, guard = { return_code: 0 }) {
  return {
    candidate_id: id, predecessor_id: predecessor, tool: 'read', arguments: args, guard,
    required_receipt_fields: ['return_code', 'stdout', 'stderr'],
    expected_local_cost: { selector_upper_tokens: 8192 }, dependency_ids: [],
  };
}

const readTool = {
  name: 'read', description: 'Read a file.',
  parameters: { type: 'object', properties: { file_path: { type: 'string' } },
    required: ['file_path'], additionalProperties: false },
};

/** A Context implementing only what the plugin contractually needs. */
function makeHost() {
  const listeners = new Map();
  const sections = [];
  const tools = new Map();
  const effects = [];

  const ctx = {
    on(name, listener) {
      const list = listeners.get(name) ?? [];
      list.push(listener);
      listeners.set(name, list);
      return () => listeners.set(name, (listeners.get(name) ?? []).filter(item => item !== listener));
    },
    effect(fn) {
      const dispose = fn();
      effects.push(dispose);
      return dispose;
    },
    inject(deps, callback) {
      // The 'fs' audit dependency is absent in this host: the callback must not run.
      if (deps.includes('fs')) return () => {};
      return ctx.effect(() => callback(ctx));
    },
    tools: {
      schemas() { return [...tools.values()].map(({ name, description, parameters }) => ({ name, description, parameters })); },
      register(definition) { tools.set(definition.name, definition); return () => tools.delete(definition.name); },
    },
    systemPrompt: {
      section(section) { sections.push(section); return () => sections.splice(sections.indexOf(section), 1); },
    },
  };

  async function waterfall(name, ...args) {
    const steps = listeners.get(name) ?? [];
    let index = 0;
    const next = () => {
      if (index >= steps.length) throw new Error(`no terminal handler for ${name}`);
      const step = steps[index++];
      return step(...args, next);
    };
    return next();
  }

  return { ctx, listeners, sections, tools, effects, waterfall };
}

/** Drive `llm/stream` and collect the chunks the caller would see. */
async function driveStream(host, options, provider) {
  const chunks = [];
  const iterator = await host.waterfall('llm/stream', options, () => provider());
  for await (const chunk of iterator) chunks.push(chunk);
  return chunks;
}

test('activation registers one prompt section and both diagnosis tools', () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  assert.equal(host.sections.length, 1);
  assert.equal(host.sections[0].name, 'harnessmm:guarded-reuse');
  assert.match(host.sections[0].text, /<CHISEL_PLAN>/);
  assert.match(host.sections[0].text, /read/);
  assert.ok(host.tools.has('harnessmm_status'));
  assert.ok(host.tools.has('harnessmm_receipts'));
  for (const dispose of host.effects) if (typeof dispose === 'function') dispose();
});

test('injectPlanInstruction=false leaves the system prompt untouched', () => {
  const host = makeHost();
  plugin.apply(host.ctx, { injectPlanInstruction: false });
  assert.equal(host.sections.length, 0);
});

test('Config implements the Standard Schema interface the Loader validates with', () => {
  // `resolveConfig` reads `Config['~standard'].validate(config)`; a plain JSON
  // Schema object has no such member, which is what failed activation before.
  const standard = plugin.Config['~standard'];
  assert.ok(standard, 'Config must expose ~standard');
  assert.equal(typeof standard.validate, 'function');
  const resolved = standard.validate({});
  assert.equal('then' in resolved, false, 'validation must be synchronous');
  assert.equal(resolved.issues, undefined);
  assert.deepEqual(resolved.value, {
    enabled: true, minimumChain: 2, maximumCandidates: 16,
    maximumFastSteps: 8, injectPlanInstruction: true, auditLog: true,
  });
  // Out-of-range values are rejected rather than silently coerced.
  const bad = standard.validate({ minimumChain: 99 });
  assert.ok(Array.isArray(bad.issues) && bad.issues.length > 0);
  assert.deepEqual(plugin.inject.slice().sort(), ['systemPrompt', 'tools']);
});

test('a request with no pending bank passes straight through to the model', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  let called = 0;
  const chunks = await driveStream(host, {
    purpose: 'conversation', sessionId: 's1',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    tools: [readTool],
  }, async function* () {
    called += 1;
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'hi' } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  assert.equal(called, 1);
  assert.deepEqual(chunks.at(-1), { type: 'finish', reason: { kind: 'stop' } });
});

test('compaction requests never reach the controller', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  let called = 0;
  await driveStream(host, {
    purpose: 'compaction', sessionId: 's1',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'summarise' }] }],
    tools: [readTool],
  }, async function* () {
    called += 1;
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  assert.equal(called, 1);
});

// The core behaviour: slow actor authors a bank on step 1, and step 2 is
// answered from the stored action without a model call at all.
test('a receipt-supported stored action replaces the next reasoning request', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, { minimumChain: 1 });
  const rootCall = { type: 'tool-call', id: 'root-call', name: 'read', arguments: JSON.stringify({ file_path: 'README.md' }) };
  const candidates = [node('A', 'root', { file_path: 'src/a.ts' })];

  const messages = [{ role: 'user', content: [{ type: 'text', text: 'Read README then src/a.ts' }] }];

  // Step 1: the slow actor answers with a bank plus its own root call.
  const stepOne = await driveStream(host, {
    purpose: 'conversation', sessionId: 'session-1', messages, tools: [readTool],
  }, async function* () {
    yield { type: 'block-end', index: 0, block: { type: 'text', text: PLAN(candidates) } };
    yield { type: 'block-end', index: 1, block: rootCall };
    yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } };
    yield { type: 'finish', reason: { kind: 'tool-calls' } };
  });
  assert.equal(stepOne.some(chunk => chunk.block?.id === 'root-call'), true);

  // The Host appends the root call and its native receipt.
  messages.push({ role: 'assistant', content: [stepOne[0].block, stepOne[1].block] },
    { role: 'tool', toolCallId: 'root-call', content: [{ type: 'text', text: '{"return_code":0,"stdout":"ok","stderr":null}' }] });

  // Step 2: no model call may happen.
  let called = 0;
  const stepTwo = await driveStream(host, {
    purpose: 'conversation', sessionId: 'session-1', messages, tools: [readTool],
  }, async function* () {
    called += 1;
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  assert.equal(called, 0, 'the substituted request must not reach the model');
  const call = stepTwo.find(chunk => chunk.type === 'block-end').block;
  assert.match(call.id, /^gdr_/);
  assert.equal(call.name, 'read');
  assert.deepEqual(JSON.parse(call.arguments), { file_path: 'src/a.ts' });
  assert.deepEqual(stepTwo.at(-1), { type: 'finish', reason: { kind: 'tool-calls' } });

  // The native dispatcher ran the real tool; post-execute certifies it.
  messages.push({ role: 'assistant', content: [call] },
    { role: 'tool', toolCallId: call.id, content: [{ type: 'text', text: '{"return_code":0,"stdout":"A","stderr":null}' }] });
  await host.waterfall('tools/post-execute',
    { callId: call.id, name: 'read', arguments: { file_path: 'src/a.ts' }, agent: { id: 'session-1' } },
    { isError: false, value: { return_code: 0, stdout: 'A', stderr: null }, content: [{ type: 'text', text: '{}' }] },
    async () => ({ kind: 'accept' }));

  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.enabled, true);
  assert.equal(status.counters.substitutions, 1);
  assert.equal(status.counters.certificates, 1);
  assert.equal(status.counters.banksAuthored, 1);

  const receipts = await host.tools.get('harnessmm_receipts').execute({ limit: 5 });
  assert.equal(receipts.total, 1);
  assert.equal(receipts.receipts[0].candidate, 'A');
  assert.deepEqual(receipts.receipts[0].arguments, { file_path: 'src/a.ts' });

  // Step 3: the bank is exhausted, so the slow actor resumes.
  let resumed = 0;
  await driveStream(host, {
    purpose: 'conversation', sessionId: 'session-1', messages, tools: [readTool],
  }, async function* () {
    resumed += 1;
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  assert.equal(resumed, 1, 'control must return to the slow actor after the graph is exhausted');
});

test('a bank that breaks the contract is rejected and the model still answers', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  let called = 0;
  await driveStream(host, {
    purpose: 'conversation', sessionId: 's2',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }], tools: [readTool],
  }, async function* () {
    called += 1;
    yield { type: 'block-end', index: 0, block: { type: 'text', text: PLAN([{ candidate_id: 'A' }]) } };
    yield { type: 'block-end', index: 1, block: { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' } };
    yield { type: 'finish', reason: { kind: 'tool-calls' } };
  });
  assert.equal(called, 1);
  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.counters.invalidBanks, 1);
});

test('a call id minted for another dispatch session still resolves to its authoring session', async () => {
  // The Host may report the dispatching agent under a different id than the one
  // the reasoning request carried. The pending action is found by the call id
  // this controller minted, and the mismatch is recorded rather than dropped.
  const host = makeHost();
  plugin.apply(host.ctx, { minimumChain: 1 });
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'go' }] },
    { role: 'assistant', content: [
      { type: 'text', text: PLAN([node('A', 'root', { file_path: 'a.ts' })]) },
      { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' },
    ] },
    { role: 'tool', toolCallId: 'root', content: [{ type: 'text', text: '{"return_code":0,"stdout":"ok","stderr":null}' }] },
  ];
  await driveStream(host, { purpose: 'conversation', sessionId: 'session-1',
    messages: messages.slice(0, 1), tools: [readTool] }, async function* () {
    yield { type: 'block-end', index: 0, block: messages[1].content[0] };
    yield { type: 'block-end', index: 1, block: messages[1].content[1] };
    yield { type: 'finish', reason: { kind: 'tool-calls' } };
  });
  const step = await driveStream(host, { purpose: 'conversation', sessionId: 'session-1', messages, tools: [readTool] },
    async function* () { yield { type: 'finish', reason: { kind: 'stop' } }; });
  const call = step.find(chunk => chunk.type === 'block-end').block;
  await host.waterfall('tools/post-execute',
    { callId: call.id, name: 'read', arguments: { file_path: 'a.ts' }, agent: { id: 'session-2' } },
    { isError: false, value: {}, content: [] }, async () => ({ kind: 'accept' }));
  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.counters.certificates, 1);
  assert.equal(status.counters.uncertified, 0);
});

test('an unknown substitution call id is never certified', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  await host.waterfall('tools/post-execute',
    { callId: 'gdr_unknown_A', name: 'read', arguments: {}, agent: { id: 's' } },
    { isError: false, value: {}, content: [] }, async () => ({ kind: 'accept' }));
  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.counters.certificates, 0);
  assert.equal(status.counters.uncertified, 0);
});

test('an ordinary tool result is not certified', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  let reached = false;
  await host.waterfall('tools/post-execute',
    { callId: 'call_from_model', name: 'read', arguments: {}, agent: { id: 's' } },
    { isError: false, value: {}, content: [] }, async () => { reached = true; return { kind: 'accept' }; });
  assert.equal(reached, true);
  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.counters.certificates, 0);
});

// 回归：审计曾经是「整文件覆盖」而不是追加。
// dsh-fs-local 的 writeText(target, content, expected) 第三个参数是版本令牌，
// 传 {mode:'append'} 不匹配任何分支，最终走 writeFileAtomic 把文件整体替换掉，
// 于是审计文件里永远只剩最后一条事件。现在改用 node:fs 的 appendFile。
test('the audit trail appends one line per event instead of overwriting', async () => {
  const file = path.join(auditDir, `append-${process.pid}.jsonl`);
  const previous = process.env.HARNESSMM_AUDIT;
  process.env.HARNESSMM_AUDIT = file;
  try {
    const host = makeHost();
    const dispose = plugin.apply(host.ctx, { minimumChain: 1 });
    const messages = [{ role: 'user', content: [{ type: 'text', text: 'go' }] }];

    // 第一步：慢回答里带动作库 —— 产生 gdr/bank-authored
    const stepOne = await driveStream(host, {
      purpose: 'conversation', sessionId: 'audit-1', messages, tools: [readTool],
    }, async function* () {
      yield { type: 'block-end', index: 0, block: { type: 'text', text: PLAN([node('A', 'root', { file_path: 'a.ts' })]) } };
      yield { type: 'block-end', index: 1, block: { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' } };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
    });
    messages.push(
      { role: 'assistant', content: stepOne.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block) },
      { role: 'tool', toolCallId: 'root', content: [{ type: 'text', text: '{"return_code":0,"stdout":"ok","stderr":null}' }] },
    );

    // 第二步：边界上产生 pre-admission + compiled-native-action
    await driveStream(host, { purpose: 'conversation', sessionId: 'audit-1', messages, tools: [readTool] },
      async function* () { yield { type: 'finish', reason: { kind: 'stop' } }; });

    const lines = await waitFor(() => {
      if (!readFileSync(file, 'utf8').includes('gdr/compiled-native-action')) return null;
      return readFileSync(file, 'utf8').trim().split('\n');
    });
    assert.ok(lines, '审计文件里没有等到 compiled-native-action');
    assert.ok(lines.length >= 3, `审计应该逐条追加，实际只有 ${lines.length} 行`);
    const kinds = lines.map(line => JSON.parse(line).kind);
    assert.ok(kinds.includes('gdr/bank-authored'), kinds.join(','));
    assert.ok(kinds.includes('gdr/pre-admission'), kinds.join(','));
    // 每行都带时间戳，且顺序与事件顺序一致（追加，不是覆盖）
    for (const line of lines) assert.match(JSON.parse(line).at, /^\d{4}-\d{2}-\d{2}T/);
    dispose();
  } finally {
    process.env.HARNESSMM_AUDIT = previous;
  }
});
