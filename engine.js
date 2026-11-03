// HarnessMM DSH Plugin — Guarded Decision Reuse (GDR) and Certified Callback
// Substitution (CCS) controller for the DeepSeek Harness.
//
// Derived from HarnessMM, Copyright 2026 PhiAgent-0 contributors,
// https://github.com/YuhuaJiang2002/HarnessMM — Apache License, Version 2.0.
// See NOTICE for the exact changes made by this derivative work.
//
// This module is a re-parameterization of the upstream
// `integrations/deepseek_harness/sar_v2.mjs` + `cot_jev.mjs`
// (`ExecutableSubdag`, v6 contract) for a general-purpose Host.
// It keeps every protocol rule that makes a substitution certified:
//
//   * the slow actor authors <CHISEL_PLAN> inside its own native request,
//   * only literal, fully resolved actions whose tool schema matches the live
//     catalog may be admitted,
//   * a guard is evaluated deterministically against the immediate native receipt,
//   * a single eligible action commits without any extra model call,
//   * the substituted action is dispatched through the ORIGINAL native tool
//     interface and only becomes a certificate after its exact receipt returns.
//
// It deliberately drops deployment-only pieces of the research controller that
// would make the module unusable (and unscoreable) on the DSH Host:
//
//   * `NativeCotJev`'s loopback-only fast-selector endpoint and logprob accounting.
//     DSH already routes every model call through `llm/stream`, so a selector
//     request would have to go through that same boundary; this port omits the
//     selector entirely and only ever commits a single eligible action.
//   * token-based admission (`net > 1024`, TRAIN priors, `slowTokens`), because the
//     Host owns usage accounting through `ctx.tokenMeter`.
//   * provider/model pinning (`options.model !== this.model`), because the Host
//     can switch models mid-session.
//
// The admission rule implemented here is structural rather than token-estimated:
// at least `minimum_chain` literal future callbacks must exist, the bank must fit
// `maximum_public_bytes`, and an action is admitted only when the receipt guard is
// positively satisfied.

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const LABELS = 'ABCDEFGHIJKLMNOP';
const POLICY_KEYS = ['version', 'enabled', 'maximum_candidates', 'maximum_fast_steps', 'maximum_public_bytes'];
const PLAN_TAG = /<CHISEL_PLAN>([\s\S]*?)<\/CHISEL_PLAN>/g;
const GUARD_FIELDS = ['return_code', 'stdout_contains', 'stdout_equals', 'stderr_empty', 'json_equals'];

export const sha256 = value => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(value))
  .digest('hex');
const bytes = value => Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class BankContractError extends Error {}

/** Validate and freeze the Companion policy. Mirrors `validateCotJev` (v6 subset). */
export function validatePolicy(policy) {
  if (!object(policy) || Object.keys(policy).sort().join() !== [...POLICY_KEYS].sort().join()
    || policy.version !== 6 || typeof policy.enabled !== 'boolean'
    || !Number.isSafeInteger(policy.maximum_candidates)
    || policy.maximum_candidates < 1 || policy.maximum_candidates > LABELS.length
    || !Number.isSafeInteger(policy.maximum_fast_steps)
    || policy.maximum_fast_steps < 1 || policy.maximum_fast_steps > LABELS.length
    || !Number.isSafeInteger(policy.maximum_public_bytes)
    || policy.maximum_public_bytes < 1024 || policy.maximum_public_bytes > 65536) {
    throw new Error('Invalid frozen GDR policy');
  }
  return Object.freeze({ ...policy });
}

/** The system-prompt section that teaches the slow actor to author a bank. */
export function planInstruction(policy, tools) {
  const names = tools.map(tool => tool.name);
  const example = names.includes('terminal') ? 'terminal' : names[0] ?? 'TOOL_NAME';
  const args = example === 'terminal'
    ? '{"command":"literal command with all parameters resolved"}'
    : '{"EXACT_PARAMETER_NAME":"already known literal value"}';
  return (
    'Guarded decision reuse (HarnessMM) is active for this session. Before a tool call, '
    + 'you may author a bank of already-decided future actions. '
    + `Write exactly one <CHISEL_PLAN>{"candidates":[...]}</CHISEL_PLAN> in your visible text before exactly one native tool call. `
    + 'Node format: {"candidate_id":"A","predecessor_id":"root",'
    + `"tool":"${example}","arguments":${args},`
    + '"guard":{"return_code":0},"required_receipt_fields":["return_code"],'
    + '"expected_local_cost":{"selector_upper_tokens":8192},"dependency_ids":[]}. '
    + 'Use only these fields. candidate_id is a unique letter A-P; predecessor_id and '
    + 'dependency_ids are "root" or an earlier candidate_id. Author 2-8 useful future '
    + `native calls whose every argument is already fully determined (at most ${policy.maximum_candidates}). `
    + `Each tool must be one of: ${names.join(', ') || '(none)'}. `
    + 'Never leave placeholders: if a parameter depends on an unseen result, omit that candidate. '
    + 'A guard is a conjunction of return_code (integer), stdout_contains (literal string), '
    + 'stdout_equals (literal string), stderr_empty (boolean), or json_equals '
    + '({"path":["field"],"value":literal}) over JSON stdout; list every field it uses in '
    + 'required_receipt_fields. A guard is checked deterministically against the immediate predecessor receipt. '
    + 'Semantic guards (task solved, code correct, looks reasonable) are invalid. '
    + 'When a guard holds, the controller dispatches that exact action through the same native tool '
    + `without another reasoning request, up to ${policy.maximum_fast_steps} consecutive actions. `
    + 'Control returns to you on exhaustion, an unsupported receipt, a native error, or abstention. '
    + 'The plan is removed before your own tool call executes. Use {"candidates":[]} when no safe '
    + 'fully resolved continuation exists. Never repeat the root call in the bank, and preserve every '
    + 'original requirement, deadline and verification step.'
  );
}

/**
 * Validate a slow-authored bank against the live tool catalog.
 * Mirrors `parseBank` for the v6 contract. Returns null when no bank is present.
 * Throws BankContractError when a declared bank violates the contract.
 */
export function parseBank(message, policy, tools = []) {
  if (message?.role !== 'assistant' || !Array.isArray(message.content)) return null;
  const text = message.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
  const matches = [...text.matchAll(PLAN_TAG)];
  if (!matches.length) return null;
  if (matches.length !== 1) throw new BankContractError('A slow turn must declare only one action bank');
  const roots = message.content.filter(part => part.type === 'tool-call');
  if (roots.length !== 1 || typeof roots[0].id !== 'string'
    || !tools.some(tool => tool.name === roots[0].name)) {
    throw new BankContractError('An action bank requires exactly one registered native root');
  }
  let bank;
  try {
    bank = JSON.parse(matches[0][1]);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new BankContractError('Slow-authored action bank is not valid JSON');
  }
  if (!object(bank) || Object.keys(bank).join() !== 'candidates'
    || !Array.isArray(bank.candidates) || bank.candidates.length > policy.maximum_candidates) {
    throw new BankContractError('Slow-authored action bank exceeds its closed candidate contract');
  }
  let rootArguments;
  try {
    rootArguments = JSON.parse(roots[0].arguments);
  } catch {
    throw new BankContractError('The native root needs literal JSON arguments');
  }
  if (!object(rootArguments)) throw new BankContractError('The native root needs object arguments');
  const allowedKeys = 'candidate_id,dependency_ids,expected_local_cost,guard,predecessor_id,required_receipt_fields,tool,arguments'.split(',').sort().join();
  const allowedKeysNoDeps = 'candidate_id,expected_local_cost,guard,predecessor_id,required_receipt_fields,tool,arguments'.split(',').sort().join();
  const declared = new Set(['root']);
  for (const candidate of bank.candidates) {
    const keys = object(candidate) ? Object.keys(candidate).sort().join() : '';
    if (!object(candidate) || ![allowedKeys, allowedKeysNoDeps].includes(keys)
      || !object(candidate.guard) || !Object.keys(candidate.guard).length
      || Object.keys(candidate.guard).some(key => !GUARD_FIELDS.includes(key))
      || !Array.isArray(candidate.required_receipt_fields)
      || !object(candidate.expected_local_cost)
      || !Number.isSafeInteger(candidate.expected_local_cost.selector_upper_tokens)
      || candidate.expected_local_cost.selector_upper_tokens < 0
      || (candidate.dependency_ids && (!Array.isArray(candidate.dependency_ids)
        || candidate.dependency_ids.some(id => !declared.has(id))))) {
      throw new BankContractError('Nonlocal or incomplete executable sub-DAG node');
    }
    if (typeof candidate.candidate_id !== 'string' || candidate.candidate_id.length !== 1
      || !LABELS.slice(0, policy.maximum_candidates).includes(candidate.candidate_id)
      || declared.has(candidate.candidate_id) || !declared.has(candidate.predecessor_id)
      || !object(candidate.arguments)
      || !tools.some(tool => tool.name === candidate.tool
        && schemaMatches(candidate.arguments, tool.parameters))) {
      throw new BankContractError('Invalid, cyclic, duplicate or unsupported authored candidate');
    }
    if (candidate.predecessor_id === 'root' && candidate.tool === roots[0].name
      && isDeepStrictEqual(candidate.arguments, rootArguments)) {
      throw new BankContractError('A future candidate cannot repeat the already executed native root');
    }
    candidate.node = structuredClone(candidate);
    candidate.label = candidate.candidate_id;
    candidate.after = candidate.predecessor_id;
    candidate.condition = JSON.stringify(candidate.guard);
    declared.add(candidate.label);
  }
  return {
    ...bank,
    root: roots[0],
    candidates: bank.candidates,
    sha256: sha256([roots[0].id, matches[0][1]]),
  };
}

/** Evaluate one receipt guard deterministically. Mirrors `localGuard` (v6). */
export function localGuard(node, receipt) {
  const guard = node?.guard;
  if (!object(guard) || !Object.keys(guard).length) {
    return { known: false, eligible: false, reason: 'invalid_guard' };
  }
  let value = receipt?.value?.native_text ?? receipt?.value;
  for (let depth = 0; depth < 3 && typeof value === 'string'; depth++) {
    try {
      value = JSON.parse(value);
    } catch {
      return { known: false, eligible: false, reason: 'non_json_receipt' };
    }
  }
  if (!object(value)) return { known: false, eligible: false, reason: 'missing_receipt' };
  if (receipt?.is_error) return { known: true, eligible: false, reason: 'native_error' };
  const fields = { return_code: 'return_code', stdout_contains: 'stdout', stdout_equals: 'stdout', stderr_empty: 'stderr', json_equals: 'stdout' };
  const required = node.required_receipt_fields;
  if (!Array.isArray(required) || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(guard).some(key => !fields[key] || !required.includes(fields[key]))) {
    return { known: false, eligible: false, reason: 'required_field_missing' };
  }
  for (const [key, expected] of Object.entries(guard)) {
    let ok;
    if (key === 'return_code') {
      if (!Number.isSafeInteger(expected) || !Number.isSafeInteger(value.return_code)) {
        return { known: false, eligible: false };
      }
      ok = value.return_code === expected;
    }
    if (key === 'stdout_contains' || key === 'stdout_equals') {
      if (typeof expected !== 'string' || !expected.length || typeof value.stdout !== 'string') {
        return { known: false, eligible: false };
      }
      ok = key === 'stdout_contains' ? value.stdout.includes(expected) : value.stdout === expected;
    }
    if (key === 'stderr_empty') {
      if (typeof expected !== 'boolean' || !(value.stderr === null || typeof value.stderr === 'string')) {
        return { known: false, eligible: false };
      }
      ok = (value.stderr === null || value.stderr === '') === expected;
    }
    if (key === 'json_equals') {
      if (!expected || !Array.isArray(expected.path)
        || expected.path.some(item => typeof item !== 'string'
          || ['__proto__', 'prototype', 'constructor'].includes(item))
        || !Object.hasOwn(expected, 'value')) {
        return { known: false, eligible: false };
      }
      let cursor;
      try {
        cursor = JSON.parse(value.stdout);
      } catch {
        return { known: false, eligible: false };
      }
      for (const step of expected.path) {
        if (!cursor || typeof cursor !== 'object' || !Object.hasOwn(cursor, step)) {
          return { known: false, eligible: false };
        }
        cursor = cursor[step];
      }
      ok = sha256(cursor) === sha256(expected.value);
    }
    if (!ok) return { known: true, eligible: false, reason: 'guard_false' };
  }
  return { known: true, eligible: true, fields: Object.fromEntries(required.map(key => [key, value[key]])) };
}

/** Structural admission for one bank step. Replaces token-prior admission. */
export function admitStep({ bank, previous, receipts, minimumChain, maximumPublicBytes }) {
  const receipt = receipts.at(-1);
  const done = new Set(['root', ...receipts.map(item => item.call_id.split('_').at(-1))]);
  const eligible = [];
  const rejected = [];
  for (const candidate of bank.candidates.filter(item => item.after === previous)) {
    const node = candidate.node;
    const check = localGuard(node, receipt);
    const missingDependency = (node.dependency_ids ?? []).some(id => !done.has(id));
    const reason = !check.known ? (check.reason ?? 'guard_unknown')
      : !check.eligible ? (check.reason ?? 'guard_false')
        : missingDependency ? 'dependency_missing'
          : receipt?.is_error ? 'native_error'
            : null;
    (reason ? rejected : eligible).push({ candidate, check, reason });
  }
  const publicBytes = bytes({ objective: bank.candidates, receipts });
  const overBudget = publicBytes > maximumPublicBytes;
  if (overBudget && eligible.length) {
    for (const item of eligible.splice(0)) rejected.push({ ...item, reason: 'public_bytes_exceeded' });
  }
  return {
    eligible,
    rejected,
    minimumChain,
    structural: true,
    publicBytes,
  };
}

/**
 * The controller. One instance per (profile activation). Sessions are held in a
 * Map keyed by the Host's session id so that a bank authored in one session can
 * never certify an action in another.
 */
export class GuardedReuseController {
  constructor({ policy, minimumChain = 2, record = () => {}, now = () => Date.now() }) {
    this.policy = validatePolicy(policy);
    this.minimumChain = minimumChain;
    this.record = record;
    this.now = now;
    this.sessions = new Map();
  }

  state(sessionId) {
    const key = String(sessionId ?? 'global');
    let state = this.sessions.get(key);
    if (!state) {
      state = { key, banks: new Map(), originals: new Map(), pending: new Map(), done: new Set(), steps: 0, slowTokens: 0 };
      this.sessions.set(key, state);
    }
    return state;
  }

  /** Called with the frozen Host request; returns the bank-visible options. */
  inspect({ sessionId, messages, tools }) {
    this.state(sessionId);
    if (!this.policy.enabled) return null;
    if (!Array.isArray(messages) || !messages.length) return null;
    if (!Array.isArray(tools) || !tools.length
      || new Set(tools.map(tool => tool.name)).size !== tools.length) return null;
    try {
      return decisionState(messages, this.policy, tools);
    } catch (error) {
      if (!(error instanceof BankContractError)) throw error;
      this.record({ kind: 'gdr/invalid-bank', session: String(sessionId ?? ''), error: error.message });
      return { invalid: true };
    }
  }

  /**
   * Rewrite the previous assistant message so the bank reaches the model as
   * ordinary visible text. The Host request is deep-frozen, so this returns a
   * new array; nothing is mutated in place.
   */
  projectMessages(options, state) {
    if (!state?.bank) return options.messages;
    const mutated = options.messages.some(message =>
      (message.content ?? []).some(part => part.type === 'tool-call' && part.id?.startsWith('gdr_')));
    if (!mutated) return options.messages;
    const messages = options.messages.map(message => {
      const calls = (message.content ?? []).filter(part => part.type === 'tool-call');
      const root = calls.find(part => !part.id?.startsWith('gdr_'));
      if (!root || !state.originals.has(root.id)) return message;
      return state.originals.get(root.id);
    });
    return messages;
  }

  /** Author a bank from a completed slow response and record it. */
  author(sessionId, content, tools) {
    const state = this.state(sessionId);
    let bank;
    try {
      bank = parseBank({ role: 'assistant', content }, this.policy, tools);
    } catch (error) {
      if (!(error instanceof BankContractError)) throw error;
      this.record({ kind: 'gdr/invalid-bank', session: state.key, error: error.message });
      return null;
    }
    if (!bank) return null;
    const chain = chainDepth(bank);
    const admitted = chain >= this.minimumChain && bytes(bank.candidates) <= this.policy.maximum_public_bytes;
    this.record({
      kind: 'gdr/bank-authored', session: state.key, bank_sha256: bank.sha256, root_id: bank.root.id,
      candidates: bank.candidates.length, chain_depth: chain, bank_bytes: bytes(bank.candidates),
      admitted, admission: 'structural: literal chain without token priors',
    });
    if (!admitted) return null;
    state.banks.set(bank.sha256, bank);
    state.originals.set(bank.root.id, structuredClone({
      role: 'assistant',
      ...(content.id === undefined ? {} : { id: content.id }),
      content,
    }));
    return bank;
  }

  /** Decide the next native action for this boundary, or null to run slow. */
  async prepare({ sessionId, options, tools }) {
    const state = this.state(sessionId);
    const decision = decisionState(options.messages, this.policy, tools);
    if (!decision?.bank) return null;
    const bank = decision.bank;
    if (!state.banks.has(bank.sha256)) {
      state.banks.set(bank.sha256, bank);
      this.record({ kind: 'gdr/bank-recovered', session: state.key, bank_sha256: bank.sha256, steps: decision.steps });
    }
    const admission = admitStep({
      bank, previous: decision.previous, receipts: decision.receipts,
      minimumChain: this.minimumChain, maximumPublicBytes: this.policy.maximum_public_bytes,
    });
    this.record({
      kind: 'gdr/pre-admission', session: state.key, bank_sha256: bank.sha256,
      step: decision.steps,
      eligible: admission.eligible.map(item => item.candidate.label),
      rejected: admission.rejected.map(item => ({ id: item.candidate.label, reason: item.reason })),
      public_bytes: admission.publicBytes, public_byte_limit: this.policy.maximum_public_bytes,
    });
    if (!admission.eligible.length) return null;
    if (admission.eligible.length > 1) {
      // Ambiguity is resolved by the slow actor; only a single eligible action
      // is deterministic and therefore certified without an extra model call.
      this.record({ kind: 'gdr/defer', session: state.key, reason: 'ambiguous_eligible', eligible: admission.eligible.map(item => item.candidate.label) });
      return null;
    }
    const { candidate, check } = admission.eligible[0];
    const call = {
      type: 'tool-call',
      id: nativeCallId(bank, candidate.label),
      name: candidate.tool,
      arguments: JSON.stringify(candidate.arguments),
    };
    state.pending.set(call.id, { bank, candidate, check, sessionId: state.key, at: this.now() });
    this.record({
      kind: 'gdr/compiled-native-action', session: state.key, bank_sha256: bank.sha256,
      candidate_id: candidate.label, call, guard_fields: check.fields,
      native_execution_claimed: false,
    });
    return { call, bank, candidate };
  }

  /**
   * Certify a substituted call after the ORIGINAL native tool returned.
   * Returns true when a certificate was recorded.
   *
   * The pending action is located by its call id, which this controller minted
   * (`gdr_<bank>_<label>`) and which is unique per bank step. That keeps a
   * certificate from being lost when the Host reports the dispatching agent
   * under a different session id than the reasoning request carried; the
   * mismatch is recorded rather than silently absorbed.
   */
  observeTool({ sessionId, callId, name, args, isError, value, content }) {
    const id = String(callId);
    const key = String(sessionId ?? 'global');
    let state = this.sessions.get(key);
    if (!state?.pending.has(id)) {
      const owner = [...this.sessions.values()].find(candidate => candidate.pending.has(id));
      if (!owner) return false;
      if (owner.key !== key) {
        this.record({
          kind: 'gdr/session-identity-mismatch', call_id: id,
          request_session: owner.key, dispatch_session: key,
          resolution: 'certified against the session that authored the pending action',
        });
      }
      state = owner;
    }
    const pending = state.pending.get(id);
    if (name !== pending.candidate.tool
      || !isDeepStrictEqual(args, pending.candidate.arguments)) {
      state.pending.delete(id);
      this.record({
        kind: 'gdr/uncertified-execution', session: state.key, call_id: id,
        reason: 'native action diverged from the certified candidate',
      });
      return false;
    }
    state.pending.delete(id);
    state.done.add(id);
    state.steps += 1;
    this.record({
      kind: 'gdr/substitution-certificate', schema: 'certified-native-substitution/v1',
      session: state.key, bank_sha256: pending.bank.sha256,
      candidate_id: pending.candidate.label,
      exact_native_tool: name, exact_arguments: args, call_id: id,
      native_receipt_sha256: sha256({ isError, value, content }),
      native_receipt: { isError, value, content },
      guard: pending.candidate.node.guard, guard_fields: pending.check.fields,
      bypassed_slow_callback_id: id,
      slow_requests_at_boundary: 0, steps_before: state.steps - 1, steps_after: state.steps,
      valid_substitution: true, is_error: isError ?? false,
      counterfactual_identity: 'unchanged native tool dispatcher; one actually bypassed reasoning callback',
    });
    return true;
  }

  /** Drop session state (agent disposal, session end, or plugin unload). */
  forget(sessionId) {
    this.sessions.delete(String(sessionId ?? 'global'));
  }

  /** Aggregate counters for the status tool and the status line. */
  summary() {
    let banks = 0;
    let certificates = 0;
    let pending = 0;
    for (const state of this.sessions.values()) {
      banks += state.banks.size;
      pending += state.pending.size;
    }
    for (const entry of this.history ?? []) if (entry.kind === 'gdr/substitution-certificate') certificates += 1;
    return { sessions: this.sessions.size, banks, certificates, pending };
  }
}

/** Chain depth of a bank: how many literal future callbacks it can replace. */
export function chainDepth(bank, after = 'root', seen = new Set()) {
  if (seen.has(after)) return 0;
  return Math.max(0, ...bank.candidates.filter(item => item.after === after)
    .map(item => 1 + chainDepth(bank, item.label, new Set([...seen, after]))));
}

function nativeCallId(bank, label) {
  return `gdr_${bank.sha256.slice(0, 24)}_${label}`;
}

/**
 * Recover a complete bounded candidate state from the request messages.
 * Mirrors `decisionState` for the v6 contract: unwalkable histories return null
 * so the slow actor simply runs unchanged.
 */
export function decisionState(messages, policy, tools) {
  let bank;
  let start;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === 'user') return null;
    if (message.role !== 'assistant') continue;
    bank = parseBank(message, policy, tools);
    if (bank) {
      start = index;
      break;
    }
    const calls = (message.content ?? []).filter(part => part.type === 'tool-call');
    if (calls.length !== 1 || !calls[0].id?.startsWith('gdr_')) return null;
  }
  if (!bank || !bank.candidates.length) return null;
  let previous = 'root';
  let expectedCall = bank.root;
  let waitingForResult = true;
  let steps = 0;
  const receipts = [];
  for (const message of messages.slice(start + 1)) {
    if (waitingForResult) {
      if (message.role !== 'tool' || message.toolCallId !== expectedCall.id
        || !Array.isArray(message.content)) return null;
      receipts.push(receiptOf(message));
      waitingForResult = false;
    } else {
      if (message.role !== 'assistant') return null;
      const calls = (message.content ?? []).filter(part => part.type === 'tool-call');
      if (calls.length !== 1) return null;
      const candidate = bank.candidates.find(item =>
        nativeCallId(bank, item.label) === calls[0].id && item.after === previous);
      if (!candidate || calls[0].name !== candidate.tool) return null;
      let value;
      try {
        value = JSON.parse(calls[0].arguments);
      } catch {
        return null;
      }
      if (!isDeepStrictEqual(value, candidate.arguments)) return null;
      previous = candidate.label;
      expectedCall = calls[0];
      waitingForResult = true;
      steps += 1;
    }
  }
  if (waitingForResult || steps >= policy.maximum_fast_steps) return null;
  if (!bank.candidates.some(item => item.after === previous)) return null;
  if (receipts.some(receipt => receipt.status !== 'PARSED')) return null;
  return { bank, receipts, steps, previous };
}

function receiptOf(message) {
  const identity = { call_id: message.toolCallId, is_error: message.isError ?? null };
  if (!Array.isArray(message.content) || message.content.length !== 1
    || message.content[0].type !== 'text' || typeof message.content[0].text !== 'string') {
    return { ...identity, status: 'UNKNOWN', reason: 'non_scalar_native_text' };
  }
  return {
    ...identity, status: 'PARSED',
    value: { native_text: message.content[0].text },
  };
}

/** Minimal JSON Schema matcher used to validate authored arguments. */
export function schemaMatches(value, schema, root = schema, depth = 0) {
  if (!object(schema) || depth > 16) return false;
  if (schema.$ref) {
    if (typeof schema.$ref !== 'string' || !schema.$ref.startsWith('#/')) return false;
    let target = root;
    for (const part of schema.$ref.slice(2).split('/')) {
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      if (!object(target) || !Object.hasOwn(target, key)) return false;
      target = target[key];
    }
    return schemaMatches(value, target, root, depth + 1);
  }
  if (schema.enum && !schema.enum.some(item => isDeepStrictEqual(item, value))) return false;
  if (Object.hasOwn(schema, 'const') && !isDeepStrictEqual(schema.const, value)) return false;
  if (schema.allOf && !schema.allOf.every(item => schemaMatches(value, item, root, depth + 1))) return false;
  if (schema.anyOf && !schema.anyOf.some(item => schemaMatches(value, item, root, depth + 1))) return false;
  if (schema.oneOf && schema.oneOf.filter(item => schemaMatches(value, item, root, depth + 1)).length !== 1) return false;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array'
    : typeof value === 'object' ? 'object' : typeof value;
  if (schema.type && !types.includes(actual)
    && !(actual === 'number' && Number.isSafeInteger(value) && types.includes('integer'))) return false;
  if (actual === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))
      || (schema.minimum !== undefined && value < schema.minimum)
      || (schema.maximum !== undefined && value > schema.maximum)) return false;
  } else if (actual === 'string') {
    if (value.includes('\0') || (schema.minLength !== undefined && value.length < schema.minLength)
      || (schema.maxLength !== undefined && value.length > schema.maxLength)) return false;
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
  } else if (actual === 'array') {
    if ((schema.minItems !== undefined && value.length < schema.minItems)
      || (schema.maxItems !== undefined && value.length > schema.maxItems)
      || (schema.items && !value.every(item => schemaMatches(item, schema.items, root, depth + 1)))) return false;
  } else if (actual === 'object') {
    const properties = schema.properties ?? {};
    if ((schema.required ?? []).some(key => !Object.hasOwn(value, key))) return false;
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        if (!schemaMatches(item, properties[key], root, depth + 1)) return false;
      } else if (schema.additionalProperties === false) return false;
      else if (object(schema.additionalProperties)
        && !schemaMatches(item, schema.additionalProperties, root, depth + 1)) return false;
    }
  }
  return true;
}

/** Strip the plan tag and build the streaming chunks that carry one action. */
export function substitutionChunks(call, usage) {
  const chunks = [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id: call.id, name: call.name, argumentsDelta: call.arguments },
    { type: 'block-end', index: 0, block: call },
  ];
  if (usage) chunks.push({ type: 'usage', usage });
  chunks.push({ type: 'finish', reason: { kind: 'tool-calls' } });
  return chunks;
}

/** Remove every plan tag from assistant text; used by the certificate view. */
export function stripPlan(text) {
  return typeof text === 'string' ? text.replace(PLAN_TAG, '').trim() === '' ? '' : text.replace(PLAN_TAG, '').trim() : text;
}
