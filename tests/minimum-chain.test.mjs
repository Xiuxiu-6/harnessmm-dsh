// Diagnostic: a one-candidate bank is a REJECTION, not an invalid bank.
//
// `author()` first parses the bank (a contract violation is an INVALID bank),
// then applies the structural admission rules (a too-short chain is a
// REJECTED bank). The two counters therefore mean different things:
//
//   invalidBanks  - the bank violated the contract (unparseable, unknown tool,
//                   wrong shape, repeats the root call)
//   banksRejected - the bank was well formed but too short to be worth reusing
//
// This test pins that distinction, because a short chain looks like "nothing
// happened" in the counters while the real cause was a different rule.
//
// Run: node --import ./tests/register-vendor.mjs --test tests/minimum-chain.test.mjs
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

function candidate(id, predecessor, file) {
  return {
    candidate_id: id, predecessor_id: predecessor, tool: 'read',
    arguments: { file_path: file },
    guard: { return_code: 0 },
    required_receipt_fields: ['return_code'],
    expected_local_cost: { selector_upper_tokens: 8192 },
    dependency_ids: predecessor === 'root' ? [] : [predecessor],
  };
}

function plan(candidates) {
  return `<CHISEL_PLAN>${JSON.stringify({ candidates })}</CHISEL_PLAN>`;
}

test('a ONE-candidate bank is rejected, not invalid', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, { minimumChain: 2 });
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'go' }] }];

  await drive(host, { purpose: 'conversation', sessionId: 's1', messages, tools: [readTool] },
    async function* () {
      yield { type: 'block-end', index: 0, block: { type: 'text', text: plan([candidate('A', 'root', 'a.ts')]) } };
      yield { type: 'block-end', index: 1, block: { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' } };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
    });

  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.counters.invalidBanks, 0, 'a short chain is not a contract violation');
  assert.equal(status.counters.banksRejected, 1, 'a short chain is a structural rejection');
});

test('a TWO-candidate chain is admitted', async () => {
  const host = makeHost();
  plugin.apply(host.ctx, { minimumChain: 2 });
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'go' }] }];

  await drive(host, { purpose: 'conversation', sessionId: 's1', messages, tools: [readTool] },
    async function* () {
      yield { type: 'block-end', index: 0, block: { type: 'text', text: plan([
        candidate('A', 'root', 'a.ts'), candidate('B', 'A', 'b.ts'),
      ]) } };
      yield { type: 'block-end', index: 1, block: { type: 'tool-call', id: 'root', name: 'read', arguments: '{}' } };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
    });

  const status = await host.tools.get('harnessmm_status').execute({});
  assert.equal(status.counters.banksAuthored, 1, 'a two-candidate chain clears minimumChain');
  assert.equal(status.counters.banksRejected, 0);
});
