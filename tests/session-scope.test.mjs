/**
 * 面板统计口径：本会话 vs 全部。
 *
 * 这组测试守的是一条底线 —— 面板写「本会话」时，数字必须真的只来自那一个会话。
 * 一旦有人把 `session` 参数丢掉或忘了过滤，这里就会红。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshot } from '../snapshot.js';

const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

function fakeController() {
  return {
    sessions: new Map([
      [A, { banks: new Map(), pending: new Map() }],
      [B, { banks: new Map(), pending: new Map() }],
    ]),
  };
}

function certificate(session, candidate) {
  return {
    kind: 'gdr/substitution-certificate',
    session,
    at: '2026-11-05T00:00:00.000Z',
    candidate_id: candidate,
    exact_native_tool: 'bash',
    exact_arguments: '{"command":"echo hi"}',
    call_id: `gdr_${candidate}`,
    guard: { return_code: 0 },
    guard_fields: ['return_code'],
    native_receipt_sha256: 'f'.repeat(64),
    bank_sha256: 'e'.repeat(64),
    steps_before: 1,
    steps_after: 2,
    valid_substitution: true,
  };
}

function counters(requests, substitutions) {
  return {
    requests, substitutions, certificates: substitutions, uncertified: 0,
    banksAuthored: 1, banksRejected: 0, deferrals: 0, invalidBanks: 0,
  };
}

function build(session) {
  const admissions = [certificate(A, 'c1'), certificate(B, 'c2'), certificate(A, 'c3')];
  return buildSnapshot({
    controller: fakeController(),
    counters: counters(10, 3),
    sessionCounters: new Map([[A, counters(4, 2)], [B, counters(6, 1)]]),
    policy: { version: 6, enabled: true },
    minimumChain: 2,
    config: { enabled: true },
    admissions,
    startedAt: Date.now(),
    auditPath: null,
    auditLines: null,
    session,
  });
}

test('不传 session 时是全局视图，与改造前行为一致', () => {
  const snapshot = build({}.session);
  assert.equal(snapshot.scope, 'all');
  assert.equal(snapshot.session, null);
  assert.equal(snapshot.certificates.length, 3);
  assert.equal(snapshot.status.counters.substitutions, 3);
  assert.deepEqual(snapshot.knownSessions, ['aaaaaaaa', 'bbbbbbbb']);
});

test('传 session 时只统计那一个会话', () => {
  const snapshot = build(A);
  assert.equal(snapshot.scope, 'session');
  assert.equal(snapshot.session.short, 'aaaaaaaa');
  assert.equal(snapshot.session.known, true);
  assert.equal(snapshot.certificates.length, 2, 'A 有 2 条证书，B 的不能混进来');
  assert.equal(snapshot.events.total, 2);
  assert.equal(snapshot.status.counters.substitutions, 2, '计数器必须来自 sessionCounters，不是全局');
  assert.equal(snapshot.status.counters.requests, 4);
});

test('两个会话各看各的，互不加总', () => {
  const a = build(A);
  const b = build(B);
  assert.equal(a.certificates.length, 2);
  assert.equal(b.certificates.length, 1);
  assert.equal(a.status.counters.substitutions + b.status.counters.substitutions, 3);
  assert.notEqual(a.session.id, b.session.id);
});

test('未知会话退化成空账，不冒充全局数字', () => {
  const snapshot = build('dddddddd-9999-4999-8999-dddddddddddd');
  assert.equal(snapshot.scope, 'session');
  assert.equal(snapshot.session.known, false);
  assert.equal(snapshot.certificates.length, 0);
  assert.equal(snapshot.status.counters.substitutions, 0);
  assert.equal(snapshot.banks.length, 0);
});

test('老调用方不传 sessionCounters 也不炸', () => {
  const snapshot = buildSnapshot({
    controller: fakeController(),
    counters: counters(10, 3),
    policy: { version: 6, enabled: true },
    minimumChain: 2,
    config: { enabled: true },
    admissions: [],
    startedAt: Date.now(),
    session: A,
  });
  assert.equal(snapshot.scope, 'session');
  assert.equal(snapshot.status.counters.substitutions, 0);
});
