/**
 * 客户端渲染层的回归测试。
 *
 * 这里守的是 1.2.3 踩过的那个坑：给区块节点套 innerHTML 代理时忘了 `get` 陷阱，
 * 于是 `el.evRows.addEventListener(...)` 里的 this 变成 Proxy，原生 DOM 方法
 * 的品牌检查直接抛 Illegal invocation —— createPanel 在绑定事件时当场炸掉，
 * 面板只剩骨架屏，而且错误被 shadow root 挡住，用户只看到「正在读取插件状态」。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lazyHTML } from '../view.js';

/**
 * 用私有字段模拟浏览器的品牌检查：一旦 `this` 不是这个类的实例，
 * 访问 #writes 就会抛 TypeError —— 和 `Illegal invocation` 同一个机制。
 */
class BrandedNode {
  #writes = 0;
  #html = '';

  get writes() { return this.#writes; }
  get html() { return this.#html; }
  get innerHTML() { return this.#html; }
  set innerHTML(value) { this.#writes += 1; this.#html = value; }

  // 方法内部访问私有字段 = 品牌检查
  addEventListener() { return this.#writes; }
  setAttribute() { return this.#html; }
}

test('代理节点上的 DOM 方法必须仍以真节点为 this', () => {
  const node = new BrandedNode();
  const lazy = lazyHTML(node);

  // 没有 get 陷阱时，这一行会抛 TypeError（品牌检查失败）
  assert.doesNotThrow(() => lazy.addEventListener('click'), 'addEventListener 的 this 被换掉了');
  assert.doesNotThrow(() => lazy.setAttribute('x', '1'), 'setAttribute 的 this 被换掉了');
});

test('内容完全相同的 innerHTML 只写一次', () => {
  const node = new BrandedNode();
  const lazy = lazyHTML(node);

  lazy.innerHTML = '<b>a</b>';
  assert.equal(node.writes, 1);
  lazy.innerHTML = '<b>a</b>';
  assert.equal(node.writes, 1, '内容没变不应该再写 DOM');

  lazy.innerHTML = '<b>b</b>';
  assert.equal(node.writes, 2, '内容变了必须写');
  assert.equal(node.html, '<b>b</b>');
});

test('空节点原样返回，不抛也不包代理', () => {
  assert.equal(lazyHTML(null), null);
  assert.equal(lazyHTML(undefined), undefined);
});
