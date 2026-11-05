/**
 * 面板客户端：口径（本会话 / 全部）与取数 URL。
 *
 * 这里守两件事：
 *   1. 面板请求 /status 时必须把会话 id 带上，否则服务端只能给全局数；
 *   2. 切口径/切会话时先推占位快照，不能把上一个对话的数字留在屏幕上。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pollStatus, blankSnapshot } from '../view.js';

/** 抓一次轮询的请求地址。 */
async function captureUrl(options) {
  const urls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, text: async () => '{"scope":"session"}' };
  };
  try {
    const stop = pollStatus({ render() {} }, { interval: 60_000, ...options });
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();
  } finally {
    globalThis.fetch = original;
  }
  return urls[0] ?? null;
}

test('带 sessionId 时请求里带上会话', async () => {
  const url = await captureUrl({ sessionId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' });
  assert.equal(url, '/plugins/harnessmm/status?session=aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
});

test('没有 sessionId 时退回全局视图', async () => {
  assert.equal(await captureUrl({}), '/plugins/harnessmm/status');
  assert.equal(await captureUrl({ sessionId: '' }), '/plugins/harnessmm/status');
});

test('会话 id 里的特殊字符要转义', async () => {
  const url = await captureUrl({ sessionId: 'a b&c' });
  assert.equal(url, '/plugins/harnessmm/status?session=a%20b%26c');
});

test('占位快照带着口径，且数字全为零', () => {
  const scoped = blankSnapshot('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
  assert.equal(scoped.scope, 'session');
  assert.equal(scoped.session.short, 'aaaaaaaa');
  assert.equal(scoped.loading, true);
  assert.equal(scoped.offline, undefined, '占位不是错误，不能显示「读取失败」');
  assert.equal(scoped.status.counters.substitutions, 0);
  assert.equal(scoped.status.counters.requests, 0);
  assert.deepEqual(scoped.certificates, []);

  const global = blankSnapshot(null);
  assert.equal(global.scope, 'all');
  assert.equal(global.session, null);
});

test('构建产物里必须留着会话接线', () => {
  const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  assert.match(code, /encodeURIComponent\(sessionId\)/, '轮询要带 session 参数');
  assert.match(code, /uiSession/, '要订阅宿主当前会话');
  assert.match(code, /onScopeChange/, '面板要能把口径切换交回客户端');
});
