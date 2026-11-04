// Diagnostic: a rejected bank poisons every later request in the session.
//
// `controller.author()` catches BankContractError and counts the rejection.
// But `controller.prepare()` calls `decisionState()` -> `parseBank()` with NO
// try/catch, and `decisionState()` re-parses the SAME bank out of the durable
// request history on the next request. The throw then escapes the
// `llm/stream` waterfall, so the model request FAILS instead of falling back
// to the slow actor.
//
// A single malformed <CHISEL_PLAN> therefore kills the rest of the session.
//
// Run: node --import ./tests/register-vendor.mjs --test tests/bank-poisoning.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import * as plugin from '../index.js';

const readTool = {
  name: 'read', description: 'Read a file.',
  parameters: { type: 'object', properties: { file_path: { type: 'string' } },
    required: ['file_path'] },
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

// A bank whose candidate names a tool that is not in the live catalog.
// parseBank throws BankContractError for this.
const BROKEN_BANK = '<CHISEL_PLAN>{"candidates":[{"candidate_id":"A","predecessor_id":"root",'
  + '"tool":"tool_that_does_not_exist","arguments":{},"guard":{"return_code":0},'
  + '"required_receipt_fields":["return_code"],"expected_local_cost":{"selector_upper_tokens":8192},'
  + '"dependency_ids":[]}]}</CHISEL_PLAN>';

test('a rejected bank does not break the NEXT model request', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, {});
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'go' }] }];

  // Turn 1: the slow actor emits a bank that violates the contract.
  await drive(host, { purpose: 'conversation', sessionId: 's1', messages, tools: [readTool] },
    async function* () {
      yield { type: 'block-end', index: 0, block: { type: 'text', text: BROKEN_BANK } };
      yield { type: 'block-end', index: 1, block: { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' } };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
    });

  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.counters.invalidBanks, 1, 'the broken bank must be counted as invalid');

  // Turn 2: the broken bank is now in the durable history, so the controller
  // replays it. The slow actor must still get to answer.
  const withHistory = [
    ...messages,
    { role: 'assistant', content: [
      { type: 'text', text: BROKEN_BANK },
      { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' },
    ] },
    { role: 'tool', toolCallId: 'root', content: [{ type: 'text', text: '{"return_code":0,"stdout":"ok","stderr":null}' }] },
  ];

  let called = 0;
  const chunks = await drive(host, { purpose: 'conversation', sessionId: 's1', messages: withHistory, tools: [readTool] },
    async function* () {
      called += 1;
      yield { type: 'finish', reason: { kind: 'stop' } };
    });

  assert.equal(called, 1, 'the slow actor must still be reached on the next request');
  assert.equal(chunks.length, 1);
});
