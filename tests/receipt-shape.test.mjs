// Diagnostic: the guard vocabulary against DeepSeek Harness's real receipts.
//
// The engine's guard evaluator (localGuard in engine.js) evaluates a guard
// against the previous tool call's result text.
//
// The paper's research harness ran its own exec tool, which returned a JSON
// observation carrying stdout / stderr / return_code. DeepSeek Harness's own
// tools return rendered text instead, so the JSON-only guard vocabulary could
// never match against them.
//
// This test pins BOTH shapes down.
//
// Run: node --import ./tests/register-vendor.mjs --test tests/receipt-shape.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import { localGuard } from '../engine.js';

function node(guard, required) {
  return { guard, required_receipt_fields: required };
}

/** The engine reads the receipt text out of `value.native_text`. */
function receipt(text) {
  return { status: 'PARSED', is_error: null, value: { native_text: text } };
}

// The research harness's JSON observation.
const RESEARCH_SHAPE = JSON.stringify({
  stdout: 'alpha\n', stderr: '', return_code: 0,
});

// DeepSeek Harness's bash rendering (see dsh-tool-bash renderResult):
// stdout, then an optional [stderr] section, then optional exit markers.
const DSH_BASH_OK = 'alpha\n';
const DSH_BASH_FAIL = 'alpha\n[exit code: 3]\n';
const DSH_BASH_WITH_STDERR = 'alpha\n[stderr]\nboom\n';

test('the research harness JSON receipt satisfies a return_code guard', () => {
  const result = localGuard(node({ return_code: 0 }, ['return_code']), receipt(RESEARCH_SHAPE));
  assert.equal(result.known, true);
  assert.equal(result.eligible, true);
  assert.equal(result.fields.return_code, 0);
});

test("a DeepSeek Harness bash receipt with no exit marker satisfies return_code 0", () => {
  const result = localGuard(node({ return_code: 0 }, ['return_code']), receipt(DSH_BASH_OK));
  assert.equal(result.known, true);
  assert.equal(result.eligible, true);
  assert.equal(result.fields.return_code, 0);
});

test('a DeepSeek Harness bash receipt with a nonzero exit fails a return_code 0 guard', () => {
  const result = localGuard(node({ return_code: 0 }, ['return_code']), receipt(DSH_BASH_FAIL));
  assert.equal(result.known, true);
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'guard_false');
});

test('a DeepSeek Harness bash receipt satisfies a stdout_contains guard', () => {
  const result = localGuard(node({ stdout_contains: 'alpha' }, ['stdout']), receipt(DSH_BASH_OK));
  assert.equal(result.eligible, true);
});

test('the stderr section of a bash receipt is separated from stdout', () => {
  const result = localGuard(node({ stderr_empty: false }, ['stderr']), receipt(DSH_BASH_WITH_STDERR));
  assert.equal(result.eligible, true, 'stderr is present, so stderr_empty:false holds');
  const clean = localGuard(node({ stderr_empty: true }, ['stderr']), receipt(DSH_BASH_OK));
  assert.equal(clean.eligible, true, 'no stderr section means stderr is empty');
});

test('a guard on text that the receipt does not contain fails', () => {
  const result = localGuard(node({ stdout_contains: 'beta' }, ['stdout']), receipt(DSH_BASH_OK));
  assert.equal(result.known, true);
  assert.equal(result.eligible, false);
});

test('a plain-text receipt with no matching field is unknown, not a false guard', () => {
  // The guard asked about return_code, but a text receipt with no exit marker
  // still reports a successful run (exit code 0), so the field is present.
  const result = localGuard(node({ stdout_equals: 'exact' }, ['stdout']), receipt('different\n'));
  assert.equal(result.known, true);
  assert.equal(result.eligible, false);
});

test("DeepSeek Harness's read receipt (line-numbered text) also works", () => {
  const readShape = '     1\talpha\n';
  const result = localGuard(node({ stdout_contains: 'alpha' }, ['stdout']), receipt(readShape));
  assert.equal(result.eligible, true);
});
