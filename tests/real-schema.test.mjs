// Diagnostic: does the engine's schema matcher accept DSH's REAL tool schemas?
//
// The upstream test suite validates authored arguments against hand-written
// simplified schemas. This test uses the schemas DSH actually exposes, taken
// from the live tool registry.
//
// If `schemaMatches` rejects a valid argument set against a real schema, then
// every bank that names a real DSH tool is rejected at authoring time — and,
// because `prepare()` re-parses the same bank from history without catching
// BankContractError, the session is then poisoned.
//
// Run: node --import ./tests/register-vendor.mjs --test tests/real-schema.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import { schemaMatches } from '../engine.js';

// DSH's real `bash` schema (from the live tool registry).
const BASH_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string', description: 'Clear, concise description of what this command does.' },
    command: { type: 'string', description: 'The bash command to execute.' },
    timeoutMs: { type: 'number', description: 'Timeout in milliseconds.' },
    workdir: { type: 'string', description: 'Working directory for this command.' },
    run_in_background: { type: 'boolean', description: 'Run in the background.' },
    sandbox_permissions: {
      type: 'string',
      enum: ['workspace-write', 'danger-full-access'],
      description: 'The narrowest wider sandbox mode for a one-shot retry.',
    },
    justification: { type: 'string', description: 'Required with sandbox_permissions.' },
  },
  required: ['description', 'command'],
};

// DSH's real `read` schema.
const READ_SCHEMA = {
  type: 'object',
  properties: {
    file_path: { type: 'string', description: 'Path to read.' },
    offset: { type: 'number', description: '1-based first line to return.' },
    limit: { type: 'number', description: 'Maximum number of lines to return.' },
  },
  required: ['file_path'],
};

test('a valid bash argument set matches the real bash schema', () => {
  const args = { description: 'Print a JSON receipt', command: "printf '%s' '{\"return_code\":0}'" };
  assert.equal(schemaMatches(args, BASH_SCHEMA), true);
});

test('a valid read argument set matches the real read schema', () => {
  assert.equal(schemaMatches({ file_path: '/tmp/hm-demo/a.txt' }, READ_SCHEMA), true);
});

test('the matcher accepts extra properties the schema does not declare', () => {
  // DSH's schemas do not set additionalProperties:false, so an argument set
  // carrying extra keys is legal against them.
  const args = { description: 'x', command: 'ls', unexpected_key: 42 };
  const matched = schemaMatches(args, BASH_SCHEMA);
  console.log('  extra-property match result:', matched);
  assert.equal(matched, true, 'DSH does not forbid extra properties');
});

test('the matcher does not reject an empty description', () => {
  const args = { description: '', command: 'ls' };
  const matched = schemaMatches(args, BASH_SCHEMA);
  console.log('  empty-description match result:', matched);
  assert.equal(matched, true);
});

test('a missing required property is rejected', () => {
  assert.equal(schemaMatches({ command: 'ls' }, BASH_SCHEMA), false);
});
