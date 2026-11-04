/**
 * HarnessMM 面板聚合层 —— 把插件内部状态转成面板快照。
 *
 * 设计约束（对应「数据真实有效溯源可查」）：
 *   1. 只读，不产生任何新状态；不改 engine.js。
 *   2. 每个数字都能追到具体来源，快照里带 `provenance` 逐项标注。
 *   3. 全部为纯函数，可用真实 engine.js 驱动后断言。
 *
 * 数据来源对照：
 *   counters        ← index.js 的 `counters` 对象（进程内存，随进程重启归零）
 *   admissions      ← index.js 的 `admissions` 环形缓冲（上限 2000）
 *   banks           ← engine.js GuardedReuseController.sessions[*].banks（Map）
 *   certificates    ← admissions 中 kind === 'gdr/substitution-certificate'
 *   rejection 分布  ← admissions 中 gdr/pre-admission 的 rejected[].reason
 *   trend           ← certificates 的 steps_after（真实步号）
 *   audit 行数      ← $DSH_HOME/harnessmm-audit.jsonl（若存在）
 */

export const SNAPSHOT_SCHEMA = 'harnessmm-panel/v1';

/** 9 种 gdr/* 事件归入 5 个面板分类。键必须与 engine.js/index.js 实际记录的 kind 完全一致。 */
export const EVENT_CLASS = Object.freeze({
  'gdr/bank-authored': 'author',
  'gdr/bank-recovered': 'author',
  'gdr/invalid-bank': 'author',
  'gdr/pre-admission': 'admit',
  'gdr/compiled-native-action': 'substitute',
  'gdr/substitution-certificate': 'substitute',
  'gdr/uncertified-execution': 'reject',
  'gdr/session-identity-mismatch': 'reject',
  'gdr/defer': 'defer',
});

/** 面板展示的事件分类顺序。 */
export const EVENT_CLASSES = ['author', 'admit', 'substitute', 'reject', 'defer'];

/** 9 条拒绝理由，与 engine.js localGuard/admitStep/prepare 的 reason 取值一一对应。 */
export const REJECT_REASONS = Object.freeze([
  'guard_false',
  'dependency_missing',
  'ambiguous_eligible',
  'required_field_missing',
  'native_error',
  'invalid_guard',
  'non_json_receipt',
  'missing_receipt',
  'public_bytes_exceeded',
]);

/** 5 种合法守卫字段，与 engine.js GUARD_FIELDS 一致。 */
export const GUARD_FIELDS = Object.freeze([
  'return_code',
  'stdout_contains',
  'stdout_equals',
  'stderr_empty',
  'json_equals',
]);

const asArray = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(v) ? v : 0);

/* ------------------------------------------------------------------ 分类 */

/** 事件 → 面板分类；未知 kind 归 null（不猜）。 */
export function classifyEvent(kind) {
  return EVENT_CLASS[kind] ?? null;
}

/** 统计每个分类的事件数。 */
export function eventClassCounts(admissions) {
  const counts = Object.fromEntries(EVENT_CLASSES.map((k) => [k, 0]));
  for (const ev of asArray(admissions)) {
    const cls = classifyEvent(ev?.kind);
    if (cls) counts[cls] += 1;
  }
  return counts;
}

/* -------------------------------------------------------------- 证书提取 */

/** 从 admissions 抽出全部替换证书，按时间升序（旧→新）。 */
export function collectCertificates(admissions) {
  return asArray(admissions)
    .filter((ev) => ev?.kind === 'gdr/substitution-certificate')
    .map((ev) => ({
      at: ev.at ?? null,
      session: ev.session ?? null,
      candidateId: ev.candidate_id ?? null,
      tool: ev.exact_native_tool ?? null,
      arguments: ev.exact_arguments ?? null,
      callId: ev.call_id ?? null,
      guard: ev.guard ?? null,
      guardFields: ev.guard_fields ?? null,
      receiptSha256: ev.native_receipt_sha256 ?? null,
      bankSha256: ev.bank_sha256 ?? null,
      receipt: ev.native_receipt ?? null,
      isError: ev.is_error === true,
      stepsBefore: num(ev.steps_before),
      stepsAfter: num(ev.steps_after),
      schema: ev.schema ?? null,
      validSubstitution: ev.valid_substitution === true,
    }));
}

/* ---------------------------------------------------------------- 分布类 */

/** 被替换的工具分布（按次数降序）。 */
export function toolUsage(certificates) {
  const m = new Map();
  for (const c of asArray(certificates)) {
    if (!c.tool) continue;
    m.set(c.tool, (m.get(c.tool) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 证书按会话分布。 */
export function sessionUsage(certificates) {
  const m = new Map();
  for (const c of asArray(certificates)) {
    const key = c.session ?? '(unscoped)';
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 守卫字段使用分布：统计证书里每个守卫字段被用了几次。 */
export function guardFieldUsage(certificates) {
  const m = new Map();
  for (const c of asArray(certificates)) {
    const guard = c.guard;
    if (!guard || typeof guard !== 'object') continue;
    for (const key of Object.keys(guard)) {
      if (!GUARD_FIELDS.includes(key)) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
  }
  return GUARD_FIELDS.map((field) => ({ field, count: m.get(field) ?? 0 }));
}

/** 拒绝原因分布：来自 gdr/pre-admission 的 rejected[].reason。 */
export function rejectionBreakdown(admissions) {
  const m = new Map();
  for (const ev of asArray(admissions)) {
    if (ev?.kind !== 'gdr/pre-admission') continue;
    for (const r of asArray(ev.rejected)) {
      const reason = r?.reason;
      if (typeof reason !== 'string') continue;
      m.set(reason, (m.get(reason) ?? 0) + 1);
    }
  }
  return REJECT_REASONS.map((reason) => ({ reason, count: m.get(reason) ?? 0 }));
}

/** 最近一次守卫未命中的上下文，用于状态条文案。 */
export function lastGuardFailure(admissions) {
  const list = asArray(admissions);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const ev = list[i];
    if (ev?.kind !== 'gdr/pre-admission') continue;
    const rejected = asArray(ev.rejected).filter((r) => typeof r?.reason === 'string');
    if (!rejected.length) continue;
    return {
      at: ev.at ?? null,
      session: ev.session ?? null,
      step: num(ev.step),
      reasons: rejected.map((r) => ({ id: r.id ?? null, reason: r.reason })),
    };
  }
  return null;
}

/* ------------------------------------------------------------------ 动作库 */

/** 从 controller.sessions 提取动作库结构（供 DAG 渲染）。 */
export function collectBanks(controller) {
  const out = [];
  const sessions = controller?.sessions;
  if (!(sessions instanceof Map)) return out;

  for (const [sessionId, state] of sessions) {
    const banks = state?.banks;
    if (!(banks instanceof Map)) continue;

    for (const [sha, bank] of banks) {
      const candidates = asArray(bank?.candidates).map((c) => ({
        id: c?.label ?? null,
        tool: c?.tool ?? null,
        after: c?.after ?? null,
        arguments: c?.arguments ?? null,
        guard: c?.node?.guard ?? c?.guard ?? null,
        dependencyIds: asArray(c?.dependency_ids),
      }));
      out.push({
        session: sessionId,
        sha256: sha ?? null,
        root: bank?.root ? { id: bank.root.id ?? null, name: bank.root.name ?? null } : null,
        candidateCount: candidates.length,
        chainDepth: chainDepthOf(candidates),
        candidates,
      });
    }
  }
  return out;
}

/** 候选图的链深（与 engine.js chainDepth 同义，但输入是已提取的候选数组）。 */
export function chainDepthOf(candidates) {
  const list = asArray(candidates);
  const seen = new Set();
  const depth = (after) => {
    if (seen.has(after)) return 0;
    seen.add(after);
    let best = 0;
    for (const c of list) {
      if (c.after !== after) continue;
      best = Math.max(best, 1 + depth(c.id));
    }
    seen.delete(after);
    return best;
  };
  return depth('root');
}

/* ------------------------------------------------------------------ 趋势 */

/**
 * 累计替换次数曲线。
 * 横轴是真实步号（certificate.steps_after），不是估算的时间桶。
 * @returns {{ steps:number[], cumulative:number[], delta:number[] }}
 */
export function trendSeries(certificates, buckets = 12) {
  const certs = asArray(certificates).filter((c) => Number.isFinite(c.stepsAfter));
  if (!certs.length) {
    return { steps: [], cumulative: [], delta: [] };
  }

  const maxStep = Math.max(...certs.map((c) => c.stepsAfter));
  const span = Math.max(1, maxStep);
  const size = Math.max(1, Math.ceil(span / Math.max(1, buckets)));

  const counts = new Array(buckets).fill(0);
  for (const c of certs) {
    const idx = Math.min(buckets - 1, Math.floor((c.stepsAfter - 1) / size));
    if (idx >= 0) counts[idx] += 1;
  }

  const steps = [];
  const cumulative = [];
  const delta = [];
  let running = 0;
  for (let i = 0; i < buckets; i += 1) {
    steps.push(1 + i * size);
    running += counts[i];
    cumulative.push(running);
    delta.push(counts[i]);
  }
  return { steps, cumulative, delta };
}

/* ------------------------------------------------------------------ 状态 */

/**
 * 三态判定。完全由真实计数器推导，不靠人工设置。
 *   C：已经发生替换（substitutions > 0）
 *   B：有动作库但没替换（banksAuthored > 0）
 *   A：都没有
 */
export function derivePhase(counters) {
  const c = counters ?? {};
  if (num(c.substitutions) > 0) return 'C';
  if (num(c.banksAuthored) > 0) return 'B';
  return 'A';
}

/** 守卫命中率 = 替换次数 / (替换次数 + 被拒次数)。无数据时为 null。 */
export function guardHitRate(counters) {
  const subs = num(counters?.substitutions);
  const rejected = num(counters?.deferrals) + num(counters?.uncertified);
  const denom = subs + rejected;
  if (denom === 0) return null;
  return Math.round((subs / denom) * 1000) / 10;
}

/* -------------------------------------------------------------- 值得注意 */

/** 异常摘要：只挑真实存在且有信息量的条目，没有就返回空数组。 */
export function notableFindings({ counters, certificates, banks, rejection }) {
  const out = [];
  const c = counters ?? {};

  if (num(c.requests) > 0 && num(c.banksAuthored) === 0) {
    out.push({
      key: '拦截但未授权',
      value: `${num(c.requests)} 次请求`,
      note: '模型从未写出合格的 CHISEL_PLAN',
      tone: 'warn',
    });
  }

  const depths = asArray(banks).map((b) => b.chainDepth).filter((d) => d > 0);
  if (depths.length) {
    out.push({
      key: '最长链深',
      value: `${Math.max(...depths)}`,
      note: `${depths.length} 个动作库`,
      tone: 'ok',
    });
  }

  const topReject = asArray(rejection).filter((r) => r.count > 0).sort((a, b) => b.count - a.count)[0];
  if (topReject) {
    out.push({
      key: '最常拒绝',
      value: `${topReject.reason} ×${topReject.count}`,
      note: '',
      tone: 'bad',
    });
  }

  const tools = toolUsage(certificates);
  if (tools.length) {
    out.push({
      key: '最常替换',
      value: `${tools[0].name} ×${tools[0].count}`,
      note: '',
      tone: 'info',
    });
  }

  if (num(c.deferrals) > 0) {
    out.push({
      key: '歧义延迟',
      value: `${num(c.deferrals)} 次`,
      note: '多候选同时合格，交还模型',
      tone: 'muted',
    });
  }

  if (num(c.uncertified) > 0) {
    out.push({
      key: '未认证执行',
      value: `${num(c.uncertified)} 次`,
      note: '原生动作偏离候选',
      tone: 'bad',
    });
  }

  return out;
}

/* ---------------------------------------------------------------- 快照 */

/**
 * 组装完整快照。
 * @param {object} input
 * @param {object} input.controller  GuardedReuseController 实例
 * @param {object} input.counters    index.js 的 counters
 * @param {object} input.policy      冻结后的 policy
 * @param {number} input.minimumChain
 * @param {object} input.config      解析后的插件配置
 * @param {Array}  input.admissions  环形缓冲
 * @param {number} input.startedAt   Date.now()
 * @param {string} input.auditPath
 * @param {number|null} input.auditLines
 * @param {number} [input.now]
 */
export function buildSnapshot(input) {
  const {
    controller, counters, policy, minimumChain, config,
    admissions, startedAt, auditPath, auditLines, now = Date.now(),
  } = input ?? {};

  const safeCounters = { ...(counters ?? {}) };
  const list = asArray(admissions);
  const certificates = collectCertificates(list);
  const banks = collectBanks(controller);
  const rejection = rejectionBreakdown(list);
  const phase = derivePhase(safeCounters);

  const sessions = controller?.sessions instanceof Map ? controller.sessions.size : 0;
  const pendingActions = controller?.sessions instanceof Map
    ? [...controller.sessions.values()].reduce((n, s) => n + (s?.pending instanceof Map ? s.pending.size : 0), 0)
    : 0;

  return {
    schema: SNAPSHOT_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    phase,

    /* 逐项溯源：界面上的每个数字都能在这里找到出处 */
    provenance: {
      counters: {
        source: 'index.js:counters',
        kind: '进程内存计数器',
        note: '随 DSH 进程重启归零',
      },
      admissions: {
        source: 'index.js:admissions',
        kind: '环形缓冲',
        count: list.length,
        capacity: 2000,
        note: '上限 2000 条，超出后丢弃最旧记录',
      },
      banks: {
        source: 'engine.js:GuardedReuseController.sessions[*].banks',
        kind: 'Map<sha256, bank>',
        count: banks.length,
      },
      certificates: {
        source: "admissions 中 kind === 'gdr/substitution-certificate'",
        count: certificates.length,
      },
      rejection: {
        source: 'admissions 中 gdr/pre-admission 的 rejected[].reason',
        total: rejection.reduce((n, r) => n + r.count, 0),
      },
      trend: {
        source: 'certificates[*].steps_after（真实步号，非估算）',
        buckets: 12,
      },
      audit: {
        path: auditPath ?? null,
        lines: auditLines ?? null,
        note: 'JSONL 追加写；进程重启后仍可追溯',
      },
    },

    status: {
      enabled: config?.enabled !== false,
      policy: policy ? { ...policy } : null,
      minimumChain: num(minimumChain),
      uptimeSeconds: Math.round((now - num(startedAt)) / 1000),
      sessions,
      pendingActions,
      counters: safeCounters,
    },

    diagnostics: {
      phase,
      guardHitRate: guardHitRate(safeCounters),
      rejection,
      lastGuardFailure: lastGuardFailure(list),
      bankChainDepths: banks.map((b) => b.chainDepth),
      notable: notableFindings({ counters: safeCounters, certificates, banks, rejection }),
    },

    banks,
    certificates,
    distributions: {
      tools: toolUsage(certificates),
      sessions: sessionUsage(certificates),
      guardFields: guardFieldUsage(certificates),
    },
    trend: trendSeries(certificates, 12),
    events: {
      total: list.length,
      counts: eventClassCounts(list),
      recent: list.slice(-200).map((ev) => ({
        at: ev?.at ?? null,
        kind: ev?.kind ?? null,
        class: classifyEvent(ev?.kind),
        session: ev?.session ?? null,
        raw: ev,
      })),
    },
  };
}
