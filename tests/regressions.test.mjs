/**
 * 这一轮审查发现的问题的回归测试。
 *
 * 每个用例对应一条「已经错了、但没人发现」的行为，写下来是为了下次改动立刻变红：
 *   1. 审计是追加写（不是整文件覆盖）
 *   2. 面板数审计行数时只读新增部分（不是每 2 秒全量读）
 *   3. 轮询指纹剔掉易变字段（否则去重永远失效）
 *   4. 命中率的分母包含「一个候选都没过准入」的决策点
 *   5. 会话视图里的 sessions 不冒充全局数字
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { countAuditLines } from '../panel.js';
import { signatureOf } from '../view.js';
import { buildSnapshot, guardHitRate } from '../snapshot.js';

const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hmm-regress-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* --------------------------------------------------------------- 审计行数 */

test('审计行数只累加新增部分，轮转后重新计数', () => withTempDir(dir => {
  const file = path.join(dir, 'audit.jsonl');
  writeFileSync(file, 'a\nb\n');
  assert.equal(countAuditLines(file), 2);

  appendFileSync(file, 'c\n');
  assert.equal(countAuditLines(file), 3, '追加一行只应 +1');

  appendFileSync(file, 'd');          // 末尾半行也算一行（与旧实现一致）
  assert.equal(countAuditLines(file), 4);
  appendFileSync(file, '\n');         // 补齐时不能重复计
  assert.equal(countAuditLines(file), 4);

  // 轮转：换成更小的新文件，必须从头重新数
  rmSync(file);
  writeFileSync(file, 'x\n');
  assert.equal(countAuditLines(file), 1);

  assert.equal(countAuditLines(path.join(dir, 'missing.jsonl')), null);
  assert.equal(countAuditLines(''), null);
}));

/* --------------------------------------------------------------- 轮询指纹 */

test('指纹忽略 generatedAt 和秒级 uptime，但认得出真实变化', () => {
  const base = {
    schema: 'harnessmm.snapshot/v1',
    generatedAt: '2026-11-05T00:00:00.000Z',
    status: { uptimeSeconds: 100, counters: { substitutions: 1 } },
    events: { recent: [] },
  };
  const nextPoll = {
    ...base,
    generatedAt: '2026-11-05T00:00:02.000Z',
    status: { ...base.status, uptimeSeconds: 102 },
  };
  assert.equal(signatureOf(base), signatureOf(nextPoll), '只有时间戳在动，不该触发重绘');

  const realChange = { ...nextPoll, status: { ...nextPoll.status, counters: { substitutions: 2 } } };
  assert.notEqual(signatureOf(base), signatureOf(realChange), '计数器变了必须重绘');

  const minuteLater = { ...base, status: { ...base.status, uptimeSeconds: 200 } };
  assert.notEqual(signatureOf(base), signatureOf(minuteLater), '跨分钟的运行时长仍会更新一次');

  assert.equal(signatureOf(null), 'null');
});

/* ----------------------------------------------------------------- 命中率 */

test('命中率分母包含「一个候选都没过准入」的决策点', () => {
  // 守卫拦下 9 次、只放过 1 次 —— 不能显示 100%
  assert.equal(guardHitRate({ substitutions: 1, guardMisses: 9 }), 10);
  assert.equal(guardHitRate({ substitutions: 1, guardMisses: 0 }), 100);
  assert.equal(guardHitRate({}), null);
  assert.equal(guardHitRate({ substitutions: 2, deferrals: 1, uncertified: 1, guardMisses: 2 }), 33.3);
});

/* ----------------------------------------------------------------- 口径 */

function fakeController() {
  return {
    sessions: new Map([
      [A, { banks: new Map(), pending: new Map() }],
      [B, { banks: new Map(), pending: new Map() }],
    ]),
  };
}

function snapshot(session) {
  return buildSnapshot({
    controller: fakeController(),
    counters: { requests: 3, substitutions: 1 },
    sessionCounters: new Map([[A, { requests: 2, substitutions: 1 }]]),
    policy: { version: 6, enabled: true },
    minimumChain: 2,
    config: { enabled: true },
    admissions: [],
    startedAt: Date.now(),
    session,
  });
}

test('会话视图里的 sessions 不冒充全局数字', () => {
  assert.equal(snapshot(A).status.sessions, 1, '本会话视图里会话数就是 1');
  assert.equal(snapshot(B).status.sessions, 1);
  assert.equal(snapshot(undefined).status.sessions, 2, '全局视图才是全部');
  const unknown = snapshot('cccccccc-3333-4333-8333-cccccccccccc');
  assert.equal(unknown.status.sessions, 0, '未知会话不能冒充 1');
});
