// Diagnostic: which authored bank shapes does the engine REJECT, and does a
// rejection poison the rest of the session?
//
// Three upstream defects interact here:
//
//  1. `parseBank` requires the bank to have EXACTLY the closed key set
//     `candidate_id, dependency_ids, expected_local_cost, guard,
//      predecessor_id, required_receipt_fields, tool, arguments`.
//  2. `parseBank` requires every candidate's `arguments` to match the live
//     tool schema.
//  3. `controller.prepare()` re-parses the bank from the request history
//     WITHOUT catching BankContractError, so a bank that failed at authoring
//     time throws again on the next request and the model request fails.
//
// This test drives the real plugin through the real engine with the argument
// shapes a model actually produces, and checks both questions.
//
// Run: node --import ./tests/register-vendor.mjs --test tests/bank-shapes.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import * as plugin from '../index.js';
import { parseBank } from '../engine.js';

const BASH_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    command: { type: 'string' },
    timeoutMs: { type: 'number' },
    workdir: { type: 'string' },
    run_in_background: { type: 'boolean' },
    sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] },
    justification: { type: 'string' },
  },
  required: ['description', 'command'],
};

const TOOLS = [{ name: 'bash', parameters: BASH_SCHEMA }];

const policy = { version: 6, enabled: true, maximum_candidates: 16,
  maximum_fast_steps: 8, maximum_public_bytes: 65536 };

function bank(candidate) {
  return `<CHISEL_PLAN>${JSON.stringify({ candidates: [candidate] })}</CHISEL_PLAN>`;
}

function assistantMessage(text) {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text },
      { type: 'tool-call', id: 'root-call', name: 'bash', arguments: JSON.stringify({ description: 'root', command: 'ls' }) },
    ],
  };
}

const FULL_CANDIDATE = {
  candidate_id: 'A', predecessor_id: 'root', tool: 'bash',
  arguments: { description: 'Print step two', command: "printf '%s' '{\"return_code\":0}'" },
  guard: { return_code: 0 },
  required_receipt_fields: ['return_code'],
  expected_local_cost: { selector_upper_tokens: 8192 },
  dependency_ids: [],
};

test('the full contract shape is accepted', () => {
  const parsed = parseBank(assistantMessage(bank(FULL_CANDIDATE)), policy, TOOLS);
  assert.equal(parsed.candidates.length, 1);
});

test('a candidate WITHOUT dependency_ids is accepted (the contract allows it)', () => {
  const { dependency_ids, ...withoutDeps } = FULL_CANDIDATE;
  const parsed = parseBank(assistantMessage(bank(withoutDeps)), policy, TOOLS);
  assert.equal(parsed.candidates.length, 1);
});

test('a candidate WITHOUT expected_local_cost is REJECTED', () => {
  const { expected_local_cost, ...withoutCost } = FULL_CANDIDATE;
  assert.throws(() => parseBank(assistantMessage(bank(withoutCost)), policy, TOOLS), /Nonlocal or incomplete/);
});

test('a candidate whose arguments omit a required schema field is REJECTED', () => {
  // Models routinely write {"command": "..."} without `description`.
  const noDescription = { ...FULL_CANDIDATE, arguments: { command: "printf '%s' '{}'" } };
  assert.throws(() => parseBank(assistantMessage(bank(noDescription)), policy, TOOLS),
    /Invalid, cyclic, duplicate or unsupported authored candidate/);
});

test('a candidate naming a tool that is not in the live catalog is REJECTED', () => {
  const unknownTool = { ...FULL_CANDIDATE, tool: 'tool_that_does_not_exist' };
  assert.throws(() => parseBank(assistantMessage(bank(unknownTool)), policy, TOOLS),
    /Invalid, cyclic, duplicate or unsupported authored candidate/);
});

test('a bank with MORE than one root tool call is REJECTED', () => {
  const message = {
    role: 'assistant',
    content: [
      { type: 'text', text: bank(FULL_CANDIDATE) },
      { type: 'tool-call', id: 'r1', name: 'bash', arguments: '{}' },
      { type: 'tool-call', id: 'r2', name: 'bash', arguments: '{}' },
    ],
  };
  assert.throws(() => parseBank(message, policy, TOOLS), /exactly one registered native root/);
});
