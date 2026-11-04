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
import {
  GuardedReuseController, planInstruction,
  validatePolicy, sha256,
} from './engine.js';
import { installPanel } from './panel.js';

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
      admissions.push(event);
      if (admissions.length > 2000) admissions.splice(0, admissions.length - 2000);
      if (event.kind === 'gdr/bank-authored') {
        if (event.admitted) counters.banksAuthored += 1;
        else counters.banksRejected += 1;
      }
      if (event.kind === 'gdr/invalid-bank') counters.invalidBanks += 1;
      if (event.kind === 'gdr/defer') counters.deferrals += 1;
      if (event.kind === 'gdr/substitution-certificate') counters.certificates += 1;
      if (event.kind === 'gdr/uncertified-execution') counters.uncertified += 1;
      for (const listener of auditListeners) listener(event);
    },
  });

  /* ------------------------------------------------------------------ audit */

  ctx.inject(['fs'], fsCtx => {
    if (!resolved.auditLog) return () => {};
    const path = auditPath();
    const handle = fsCtx.fs.resolve(path);
    return fsCtx.effect(() => {
      const listener = event => {
        handle.then(target => fsCtx.fs.writeText(target, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, { mode: 'append' }))
          .catch(() => { /* audit is best effort; it never affects a request or a tool call */ });
      };
      auditListeners.add(listener);
      return () => { auditListeners.delete(listener); };
    });
  });

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
      return {
        enabled: resolved.enabled,
        policy: { ...policy },
        minimumChain: resolved.minimumChain,
        uptimeSeconds: Math.round((Date.now() - started) / 1000),
        sessions: controller.sessions.size,
        counters,
        pendingActions: [...controller.sessions.values()].reduce((total, state) => total + state.pending.size, 0),
        certificates: admissions.filter(event => event.kind === 'gdr/substitution-certificate').length,
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
        receipts: certificates.slice(-limit).map(item => ({
          at: item.at, session: item.session, candidate: item.candidate_id,
          tool: item.exact_native_tool, arguments: item.exact_arguments,
          guard: item.guard, guardFields: item.guard_fields,
          nativeReceiptSha256: item.native_receipt_sha256, isError: item.is_error,
          bankSha256: item.bank_sha256,
        })),
      };
    },
  }));

  /* ---------------------------------------------------------------- panel */

  // Read-only decision-reuse panel. Registers /plugins/harnessmm/{status,panel,health}
  // on the Web server. Every number it shows traces back to `controller`,
  // `counters` or `admissions` above — see snapshot.js provenance.
  const disposePanel = installPanel(ctx, {
    controller, counters, policy, admissions, startedAt: started,
    minimumChain: resolved.minimumChain,
    config: resolved,
  });

  return () => {
    disposePanel();
    controller.sessions.clear();
  };
}

/** Audit trail location, kept outside the workspace so it never dirties a repo. */
function auditPath() {
  const home = process.env.DSH_HOME || process.env.USERPROFILE || process.env.HOME || process.cwd();
  return `${home}/harnessmm-audit.jsonl`;
}

/** Exported for tests: the pure helpers the Host wiring depends on. */
export const internals = { eligibleRequest, contentFromChunks, sessionKey, auditPath, sha256 };


