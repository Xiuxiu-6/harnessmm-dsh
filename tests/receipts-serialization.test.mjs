// Diagnostic: the diagnosis tools must return losslessly JSON-serializable values.
//
// A tool result is snapshotted as lossless JSON before it reaches the model.
// `undefined` is not representable there, so a single absent field turns the
// whole tool result into an error instead of an answer.
//
// The certificate record carries no `at` field of its own (the audit listener
// stamps one when it writes the trail), so `at: item.at` was `undefined` and
// `harnessmm_receipts` failed with "value is not lossless JSON" precisely when
// a certificate EXISTED.
//
// Run: node --import ./tests/register-vendor.mjs --test tests/receipts-serialization.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import * as plugin from '../index.js';

const readTool = {
  name: 'read', description: 'Read a file.',
  parameters: { type: 'object', properties: { file_path: { type: 'string' } },
    required: ['file_path'], additionalProperties: false },
};

function makeHost() {
  const listeners = new Map();
  const tools = new Map();
  const ctx = {
    on(name, listener) {
      const list = listeners.get(name) ?? [];
      list.push(listener);
      listeners.set(name, list);
      return () => listeners.set(name, (listeners.get(name) ?? []).filter(item => item !== listener));
    },
    effect(fn) { return fn(); },
    inject(deps, callback) { return deps.includes('fs') ? () => {} : callback(ctx); },
    tools: {
      schemas() { return [...tools.values()].map(({ name, description, parameters }) => ({ name, description, parameters })); },
      register(definition) { tools.set(definition.name, definition); return () => tools.delete(definition.name); },
    },
    systemPrompt: { section() { return () => {}; } },
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
  return { ctx, tools, waterfall };
}

async function drive(host, options, provider) {
  const chunks = [];
  const iterator = await host.waterfall('llm/stream', options, () => provider());
  for await (const chunk of iterator) chunks.push(chunk);
  return chunks;
}

const PLAN = JSON.stringify({ candidates: [{
  candidate_id: 'A', predecessor_id: 'root', tool: 'read',
  arguments: { file_path: 'src/a.ts' },
  guard: { return_code: 0 },
  required_receipt_fields: ['return_code'],
  expected_local_cost: { selector_upper_tokens: 8192 },
  dependency_ids: [],
}] });

/** Assert that every value in the tree is representable as lossless JSON. */
function assertLosslessJson(value, path = 'value') {
  if (value === null) return;
  if (typeof value === 'undefined') {
    assert.fail(`${path} is undefined, which is not losslessly JSON-serializable`);
  }
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is ${value}, which is not losslessly JSON-serializable`);
    return;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertLosslessJson(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertLosslessJson(item, `${path}.${key}`);
  }
}

test('harnessmm_receipts returns a losslessly serializable value after a certificate', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, { minimumChain: 1 });
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'go' }] }];

  // The slow actor authors a bank plus its own root call.
  await drive(host, { purpose: 'conversation', sessionId: 's1', messages, tools: [readTool] },
    async function* () {
      yield { type: 'block-end', index: 0, block: { type: 'text', text: `<CHISEL_PLAN>${PLAN}</CHISEL_PLAN>` } };
      yield { type: 'block-end', index: 1, block: { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' } };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
    });

  // The next request is answered from the stored action, with no model call.
  const withHistory = [
    ...messages,
    { role: 'assistant', content: [
      { type: 'text', text: `<CHISEL_PLAN>${PLAN}</CHISEL_PLAN>` },
      { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' },
    ] },
    { role: 'tool', toolCallId: 'root', content: [{ type: 'text', text: 'ok\n' }] },
  ];
  const step = await drive(host, { purpose: 'conversation', sessionId: 's1', messages: withHistory, tools: [readTool] },
    async function* () { yield { type: 'finish', reason: { kind: 'stop' } }; });
  const call = step.find(chunk => chunk.type === 'block-end').block;

  // The native tool runs and the certificate is signed.
  await host.waterfall('tools/post-execute',
    { callId: call.id, name: 'read', arguments: { file_path: 'src/a.ts' }, agent: { id: 's1' } },
    { isError: false, value: { return_code: 0 }, content: [{ type: 'text', text: 'ok\n' }] },
    async () => ({ kind: 'accept' }));

  const receipts = await host.tools.get('harnessmm_receipts').execute({ limit: 10 });
  assert.equal(receipts.total, 1);
  assertLosslessJson(receipts, 'receipts');
  assert.equal(receipts.receipts[0].tool, 'read');
  assert.deepEqual(receipts.receipts[0].arguments, { file_path: 'src/a.ts' });
});

test('harnessmm_status returns a losslessly serializable value', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  const status = await host.tools.get('harnessmm_status').execute({});
  assertLosslessJson(status, 'status');
});
