/**
 * 客户端 bundle 冒烟测试。
 *
 * 不打真实浏览器，但把宿主加载器的契约走一遍：
 *   window.__ModuleLoader__.load({ id, factory })  →  factory(require) → { name, inject, apply }
 * 然后真的调用 apply(ctx)，确认注册了三个入口、并且能接上 uiSession。
 *
 * 这能挡住「改完构建出来一加载就崩」这类低级事故 —— 面板崩了就是白屏。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** 按宿主的方式加载 bundle，返回 factory 产物。 */
function loadBundle() {
  let registration = null;
  const window = { __ModuleLoader__: { load: (spec) => { registration = spec; } } };
  // eslint-disable-next-line no-new-func
  new Function('window', code)(window);

  assert.ok(registration !== null, 'bundle 必须调用 __ModuleLoader__.load');
  assert.equal(registration.id, pkg.name, 'id 必须等于包名，否则宿主登记不上');

  const React = {
    Component: class {},
    createElement: () => null,
  };
  const require = (name) => {
    if (name === 'react') return React;
    throw new Error(`unexpected require: ${name}`);
  };
  return registration.factory(require);
}

test('bundle 能被宿主加载，导出 name/inject/apply', () => {
  const mod = loadBundle();
  assert.equal(mod.name, 'harnessmm-panel');
  assert.ok(Array.isArray(mod.inject), 'inject 必须是数组');
  assert.ok(mod.inject.includes('slots'));
  assert.ok(mod.inject.includes('sidebarRightTabs'));
  assert.equal(typeof mod.apply, 'function');
});

test('apply 注册三个入口，并订阅当前会话', () => {
  const mod = loadBundle();

  const registered = [];
  const subscriptions = [];
  const cleanup = [];
  let readCount = 0;

  const binding = {
    value: { key: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' },
    getSnapshot() { readCount += 1; return this.value; },
    subscribe(listener) { subscriptions.push(listener); return () => {}; },
  };

  const ctx = {
    effect: (fn) => { const disposer = fn(); if (typeof disposer === 'function') cleanup.push(disposer); },
    get: (name) => (name === 'uiSession' ? { current: binding } : undefined),
    slots: {
      inject: (name, fn) => fn(),
      register: (descriptor) => { registered.push(descriptor); return { dispose() {} }; },
    },
    sidebarRightTabs: {
      register: (descriptor) => { registered.push(descriptor); return { dispose() {} }; },
    },
  };

  mod.apply(ctx);
  for (const dispose of cleanup) dispose();

  assert.equal(registered.length, 3, '侧边栏类型 + 侧边栏主体 + 对话页签');
  const names = registered.map((item) => item.name ?? 'sidebarTabType');
  assert.ok(names.includes('sidebar.right.pane.tab'));
  assert.ok(names.includes('conversation.view'));
  assert.equal(readCount, 1, '挂载时要先读一次当前会话');
  assert.equal(subscriptions.length, 1, '必须订阅会话切换');
});

test('没有 uiSession 服务时 apply 不抛错（退回全部会话）', () => {
  const mod = loadBundle();
  const cleanup = [];
  const ctx = {
    effect: (fn) => { const disposer = fn(); if (typeof disposer === 'function') cleanup.push(disposer); },
    get: () => undefined,
    slots: {
      inject: (name, fn) => fn(),
      register: () => ({ dispose() {} }),
    },
    sidebarRightTabs: { register: () => ({ dispose() {} }) },
  };
  assert.doesNotThrow(() => mod.apply(ctx));
  // 收尾：清掉服务探测的定时器，否则测试进程会等满 20 秒。
  for (const dispose of cleanup) dispose();
});
