// Diagnostic: a bank may not repeat the call the author is making right now.
//
// The bank describes FUTURE actions. The turn that authors it also makes one
// native call of its own — the "root". `parseBank` rejects a candidate that
// repeats that root, because executing it would run the same command twice.
//
// This is the contract working as designed, and it is easy to trip over: a
// model that writes its plan for the command it is about to run gets its
// whole bank rejected.
//
// Run: node --import ./tests/register-vendor.mjs --test tests/repeat-root.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseBank, BankContractError } from '../engine.js';

const policy = { version: 6, enabled: true, maximum_candidates: 16,
  maximum_fast_steps: 8, maximum_public_bytes: 65536 };

const BASH_SCHEMA = {
  type: 'object',
  properties: { description: { type: 'string' }, command: { type: 'string' } },
  required: ['description', 'command'],
};
const TOOLS = [{ name: 'bash', parameters: BASH_SCHEMA }];
const READ_SCHEMA = {
  type: 'object',
  properties: { file_path: { type: 'string' } },
  required: ['file_path'],
};
const WITH_READ = [...TOOLS, { name: 'read', parameters: READ_SCHEMA }];

function candidate(overrides) {
  return {
    candidate_id: 'A', predecessor_id: 'root', tool: 'bash',
    arguments: { description: 'Print two', command: 'echo two' },
    guard: { return_code: 0 },
    required_receipt_fields: ['return_code'],
    expected_local_cost: { selector_upper_tokens: 8192 },
    dependency_ids: [],
    ...overrides,
  };
}

function authorMessage(candidates, rootArguments) {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text: `<CHISEL_PLAN>${JSON.stringify({ candidates })}</CHISEL_PLAN>` },
      { type: 'tool-call', id: 'root-call', name: 'bash', arguments: JSON.stringify(rootArguments) },
    ],
  };
}

test('a candidate that repeats the root call is REJECTED', () => {
  const root = { description: 'Print two', command: 'echo two' };
  assert.throws(
    () => parseBank(authorMessage([candidate({})], root), policy, TOOLS),
    /cannot repeat the already executed native root/,
  );
});

test('a candidate for a DIFFERENT future call is accepted', () => {
  const root = { description: 'Print one', command: 'echo one' };
  const parsed = parseBank(authorMessage([candidate({})], root), policy, TOOLS);
  assert.equal(parsed.candidates.length, 1);
  assert.deepEqual(parsed.candidates[0].arguments, { description: 'Print two', command: 'echo two' });
});

test('a candidate for a different tool with the same arguments is accepted', () => {
  const root = { description: 'Print two', command: 'echo two' };
  const other = candidate({ tool: 'read', arguments: { file_path: 'a.txt' } });
  const parsed = parseBank(authorMessage([other], root), policy, WITH_READ);
  assert.equal(parsed.candidates.length, 1);
});
