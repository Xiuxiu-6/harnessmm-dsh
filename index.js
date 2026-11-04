/**
 * HarnessMM DSH Plugin — Guarded Reuse Host plugin for the DeepSeek Harness.
 *
 * Derived from HarnessMM, Copyright 2026 PhiAgent-0 contributors,
 * https://github.com/YuhuaJiang2002/HarnessMM — Apache License, Version 2.0.
 * See NOTICE for the exact changes made by this derivative work.
 *
 * Implements the HarnessMM controller at two native boundaries:
 *
 *  1. `llm/stream` — after the slow actor answers, its `<CHISEL_PLAN>` bank is
 *     recorded. On the next reasoning request, if a receipt-supported action is
 *     still pending, the request is answered with that exact native tool call
 *     instead of asking the model, so the reasoning request is never paid for.
 *  2. `tools/post-execute` — the substituted call runs through the ORIGINAL tool
 *     definition with its exact arguments; only then is a substitution
 *     certificate recorded.
 *
 * Everything else (no bank, failed guard, ambiguity, graph exhausted, error,
 * plugin disabled) returns `next()`, so the native harness behaves exactly as it
 * does without this plugin.
 *
 * The plan tag stays visible in the conversation as ordinary assistant text
 * rather than being rewritten out of the request: it costs the same tokens the
 * slow actor already paid for it, and it keeps every request a pure function of
 * the durable session log.
 */
import Schema from '@deepseek-ai/schemastery';
import { appendFile } from 'node:fs/promises';
import {
  GuardedReuseController, planInstruction,
  validatePolicy, sha256,
} from './engine.js';

export const name = 'harnessmm-guarded-reuse';
export const inject = ['tools', 'systemPrompt'];

const POLICY_VERSION = 6;

/**
 * The Loader validates a plugin's `Config` with `resolveConfig`, which requires a
 * Schemastery schema (a plain JSON Schema object has no `.validate`). Declaring it
 * here is what lets these knobs be set from `cordis.patch.yml`.
 */
export const Config = Schema.object({
  enabled: Schema.boolean()
    .default(true)
    .description('Enable guarded decision reuse. When false every request and tool call passes through unchanged.'),
  minimumChain: Schema.natural()
    .min(1)
    .max(16)
    .default(2)
    .description('Minimum number of literal future callbacks a bank must declare before it may replace reasoning.'),
  maximumCandidates: Schema.natural()
    .min(1)
    .max(16)
    .default(16)
    .description('Largest bank the slow actor may author (A-P).'),
  maximumFastSteps: Schema.natural()
    .min(1)
    .max(16)
    .default(8)
    .description('Maximum consecutive substitutions before control returns to the slow actor.'),
  injectPlanInstruction: Schema.boolean()
    .default(true)
    .description('Add the bank authorship instruction to the system prompt.'),
  auditLog: Schema.boolean()
    .default(true)
    .description('Write an append-only JSONL audit trail of admissions and certificates.'),
});

/**
 * The request the controller may answer must be an ordinary conversation
 * request: compaction and session-title requests are never substituted.
 */
function eligibleRequest(options) {
  if (options?.purpose && options.purpose !== 'conversation') return false;
  if (!Array.isArray(options?.messages) || !options.messages.length) return false;
  if (!Array.isArray(options.tools) || !options.tools.length) return false;
  return true;
}

/**
 * Extract the tool-call/visible-text content of a completed assistant stream.
 * Reasoning blocks are kept out: a bank must be declared in visible text.
 */
function contentFromChunks(chunks) {
  return chunks
    .filter(chunk => chunk.type === 'block-end')
    .map(chunk => chunk.block)
    .filter(block => block && (block.type === 'text' || block.type === 'tool-call'));
}

function sessionKey(options) {
  return String(options?.sessionId ?? 'unscoped');
}

export function apply(ctx, config = {}) {
  const resolved = {
    enabled: config.enabled !== false,
    minimumChain: Number.isSafeInteger(config.minimumChain) ? config.minimumChain : 2,
    maximumCandidates: Number.isSafeInteger(config.maximumCandidates) ? config.maximumCandidates : 16,
    maximumFastSteps: Number.isSafeInteger(config.maximumFastSteps) ? config.maximumFastSteps : 8,
    injectPlanInstruction: config.injectPlanInstruction !== false,
    auditLog: config.auditLog !== false,
  };

  const policy = validatePolicy({
    version: POLICY_VERSION,
    enabled: resolved.enabled,
    maximum_candidates: resolved.maximumCandidates,
    maximum_fast_steps: resolved.maximumFastSteps,
    maximum_public_bytes: 65536,
  });

  const started = Date.now();
  const admissions = [];
  const auditListeners = new Set();
  const counters = {
    requests: 0, substitutions: 0, certificates: 0, uncertified: 0,
    banksAuthored: 0, banksRejected: 0, deferrals: 0, invalidBanks: 0,
  };

  const controller = new GuardedReuseController({
    policy,
    minimumChain: resolved.minimumChain,
    record: event => {
      // Every recorded event carries its own timestamp, so the trail and the
      // diagnosis tools agree on when something happened.
      const stamped = { at: new Date().toISOString(), ...event };
      admissions.push(stamped);
      if (admissions.length > 2000) admissions.splice(0, admissions.length - 2000);
      if (event.kind === 'gdr/bank-authored') {
        if (event.admitted) counters.banksAuthored += 1;
        else counters.banksRejected += 1;
      }
      if (event.kind === 'gdr/invalid-bank') counters.invalidBanks += 1;
      if (event.kind === 'gdr/defer') counters.deferrals += 1;
      if (event.kind === 'gdr/substitution-certificate') counters.certificates += 1;
      if (event.kind === 'gdr/uncertified-execution') counters.uncertified += 1;
      for (const listener of auditListeners) listener(stamped);
    },
  });

  /* ------------------------------------------------------------------ audit */

  // The audit trail is the PLUGIN's own file, not a model-controlled path, so
  // it is written with the host's own filesystem rather than through
  // `ctx.fs`. Two reasons:
  //
  //  * `ctx.fs.writeText` REPLACES the whole file. Its `expected` argument is
  //    an FsWriteIntent (`createIfAbsent` | `replaceIfVersion`), not a write
  //    mode, so `{ mode: 'append' }` was silently ignored and every event
  //    overwrote the previous one.
  //  * `ctx.fs` is the SANDBOXED model-facing filesystem. Under the default
  //    `workspace-write` mode it refuses any write outside the session
  //    workspace and the platform temp roots, so the trail at `$DSH_HOME`
  //    was denied outright and never written at all.
  //
  // The path is fixed and not derived from model output.
  const auditFile = auditPath();
  let auditQueue = Promise.resolve();
  const auditListener = event => {
    const line = `${JSON.stringify(event)}\n`;
    auditQueue = auditQueue.then(async () => {
      await appendFile(auditFile, line);
    }).catch((error) => {
      // The trail is best effort, but a failure to write it is worth
      // reporting once: a silent catch is what hid this path for so long.
      ctx.logger?.warn?.(`harnessmm: audit write failed: ${error?.message ?? error}`);
    });
  };
  if (resolved.auditLog) {
    auditListeners.add(auditListener);
    ctx.effect(() => () => { auditListeners.delete(auditListener); });
  }

  /* ------------------------------------------------------- system prompt text */

  if (resolved.injectPlanInstruction) {
    const instruction = planInstruction(policy, ctx.tools.schemas());
    ctx.effect(() => ctx.systemPrompt.section({
      name: 'harnessmm:guarded-reuse',
      order: 10400,
      text: instruction,
      interpolate: false,
    }));
  }

  /* --------------------------------------------------------- native dispatch */

  // A substituted call is known by its `gdr_` call id. `tools/execute` wraps the
  // real dispatcher, so the stored action executes through the exact registered
  // tool definition that any model-issued call would use.
  const isSubstituted = exec => String(exec?.callId ?? '').startsWith('gdr_');

  /**
   * Certify after the native result is frozen. `isError`, `value` and `content`
   * are the real outcome of the real tool, which is what makes the certificate
   * a substitution record rather than a claim.
   */
  ctx.effect(() => ctx.on('tools/post-execute', async (exec, result, next) => {
    if (!isSubstituted(exec)) return next();
    // `observeTool` records `gdr/uncertified-execution` itself when the native
    // action diverged or belongs to another session. The native result is always
    // passed through unchanged, so a refused certificate changes nothing the
    // harness or the model sees.
    controller.observeTool({
      sessionId: sessionKey({ sessionId: exec.agent?.id }),
      callId: String(exec.callId),
      name: exec.name,
      args: exec.arguments,
      isError: result.isError,
      value: result.value,
      content: result.content,
    });
    return next();
  }));

  /* ------------------------------------------------------- reasoning boundary */

  ctx.effect(() => ctx.on('llm/stream', (options, next) => (async function* () {
    if (!eligibleRequest(options)) {
      yield* next();
      return;
    }
    const sessionId = sessionKey(options);
    counters.requests += 1;

    // 1. Can an already-authored action be executed without a reasoning request?
    const step = await controller.prepare({ sessionId, options, tools: options.tools });
    if (step) {
      counters.substitutions += 1;
      const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      yield { type: 'block-start', index: 0, blockType: 'tool-call' };
      yield { type: 'tool-call-delta', index: 0, id: step.call.id, name: step.call.name, argumentsDelta: step.call.arguments };
      yield { type: 'block-end', index: 0, block: step.call };
      yield { type: 'usage', usage };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
      return;
    }

    // 2. Otherwise the slow actor runs unchanged, and its bank is recorded.
    const chunks = [];
    for await (const chunk of next()) {
      chunks.push(chunk);
      yield chunk;
    }
    const toolCalls = chunks.filter(chunk => chunk.type === 'block-end' && chunk.block?.type === 'tool-call');
    if (toolCalls.length !== 1) return;
    const content = contentFromChunks(chunks);
    if (!content.some(block => block.type === 'text' && block.text.includes('<CHISEL_PLAN>'))) return;
    controller.author(sessionId, content, options.tools);
  })()));

  /* ------------------------------------------------------------- lifecycle */

  ctx.effect(() => ctx.on('agent/disposed', ({ agent }) => {
    controller.forget(String(agent?.id ?? 'unscoped'));
    return undefined;
  }));

  /* ------------------------------------------------------------- diagnosis */

  ctx.effect(() => ctx.tools.register({
    name: 'harnessmm_status',
    description: 'Report HarnessMM guarded decision-reuse counters for this profile: reasoning requests answered from a stored action, substitution certificates, authored banks and deferrals. Use it to check whether decision reuse is active.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute() {
      // The most recent rejection reasons, so a user who sees
      // `invalidBanks` climbing can tell WHICH contract rule was broken
      // without attaching a debugger.
      const reasons = admissions
        .filter(event => event.kind === 'gdr/invalid-bank' || event.kind === 'gdr/bank-authored' && !event.admitted)
        .slice(-10)
        .map(event => ({
          kind: event.kind,
          reason: event.error ?? (event.admitted ? null : `chain_depth_${event.chain_depth}_below_minimum_${resolved.minimumChain}`),
          at: event.at ?? null,
        }));
      return {
        enabled: resolved.enabled,
        policy: { ...policy },
        minimumChain: resolved.minimumChain,
        uptimeSeconds: Math.round((Date.now() - started) / 1000),
        sessions: controller.sessions.size,
        counters,
        pendingActions: [...controller.sessions.values()].reduce((total, state) => total + state.pending.size, 0),
        certificates: admissions.filter(event => event.kind === 'gdr/substitution-certificate').length,
        recentRejections: reasons,
      };
    },
  }));

  ctx.effect(() => ctx.tools.register({
    name: 'harnessmm_receipts',
    description: 'Return the most recent HarnessMM substitution certificates: which stored action ran through which native tool, with its exact arguments, guard and native receipt hash. Empty until the model authors an action bank and a guard holds.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const limit = Number.isSafeInteger(args?.limit) ? Math.min(50, Math.max(1, args.limit)) : 10;
      const certificates = admissions.filter(event => event.kind === 'gdr/substitution-certificate');
      return {
        total: certificates.length,
        scope: 'One certificate records one actually bypassed reasoning callback, not a measured counterfactual trajectory cost.',
        // A tool result must be losslessly JSON-serializable, so every field
        // here has to be present. The certificate record carries no timestamp
        // of its own (the audit listener stamps one) and its optional members
        // may be absent, so each is read with a defined fallback.
        receipts: certificates.slice(-limit).map(item => ({
          at: item.at ?? null,
          session: item.session ?? null,
          candidate: item.candidate_id ?? null,
          tool: item.exact_native_tool ?? null,
          arguments: item.exact_arguments ?? null,
          guard: item.guard ?? null,
          guardFields: item.guard_fields ?? null,
          nativeReceiptSha256: item.native_receipt_sha256 ?? null,
          isError: item.is_error ?? false,
          bankSha256: item.bank_sha256 ?? null,
        })),
      };
    },
  }));

  return () => { controller.sessions.clear(); };
}

/**
 * Audit trail location, kept outside the workspace so it never dirties a repo.
 *
 * The desktop Host does not export DSH_HOME to its plugins, so the path is
 * resolved from the user's home directory the way the harness itself does:
 * `~/.dsh` is the harness home, and the trail belongs beside the other
 * harness state rather than loose in `$HOME`.
 */
function auditPath() {
  const home = process.env.DSH_HOME
    || process.env.USERPROFILE
    || (process.env.HOME ? `${process.env.HOME}/.dsh` : process.cwd());
  return `${home}/harnessmm-audit.jsonl`;
}

/** Exported for tests: the pure helpers the Host wiring depends on. */
export const internals = { eligibleRequest, contentFromChunks, sessionKey, auditPath, sha256 };


