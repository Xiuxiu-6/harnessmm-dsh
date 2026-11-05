/**
 * HarnessMM 面板 —— DSH 浏览器侧入口。
 *
 * 面板本体只有一份实现（view.js），这里只做三件事：
 *   1. 在对话头部页签条（编队之后）和右侧栏各注册一个入口；
 *   2. 用类组件把面板挂进一个 <div>，视图自己注入 shadow root，
 *      因此不污染宿主样式，也不依赖 hooks；
 *   3. 两个入口共享同一条轮询，卸载时按引用计数停掉。
 *
 * ⚠️ React 必须用宿主那一份（工厂参数 require），不能在构建时打包：
 *   DSH 客户端是 React 18（元素符号是 react.element），
 *   而本仓库 node_modules 里是 React 19（元素符号是 react.transitional.element）。
 *   两个符号不相等，宿主 renderer 会把我们的元素当成普通对象子节点，
 *   页签里就是一片空白 —— 这就是重启后面板白屏的原因。
 *   同理不能用 hooks：hooks 的 dispatcher 属于宿主 React 实例。
 */
import { createPanel, pollStatus, blankSnapshot } from './view.js';

const TAB_ID = 'harnessmm-dsh';
const TAB_KIND = 'harnessmm';
// 对话页签条：上下文 20、编队 30，所以 40 排在编队后面。
const VIEW_ID = 'harnessmm';
const VIEW_ORDER = 40;

/** 宿主 require，由 build-client.mjs 在外层工厂函数里注入。 */
const hostRequire = typeof __hmmRequire === 'function' ? __hmmRequire : null;
const React = (() => {
  if (hostRequire === null) return null;
  try { return hostRequire('react'); } catch (error) {
    console.error('[harnessmm] require("react") 失败', error);
    return null;
  }
})();

/** 挂载实例与共享轮询（引用计数 + 一份最新快照）。 */
const mounts = new Map();
const panels = new Set();
let stopPolling = null;
/** 只回放给同一个口径的快照，避免把上一个对话的账画到新面板上。 */
let lastSnapshot = null;
/** 'session' 跟随当前对话；'all' 统计全部对话。 */
let scopeMode = readStoredScope();
/** 当前打开的对话 id，由 uiSession 服务提供。 */
let currentSessionId = null;

const SCOPE_KEY = 'harnessmm.scope';

function readStoredScope() {
  try {
    return globalThis.localStorage?.getItem(SCOPE_KEY) === 'all' ? 'all' : 'session';
  } catch {
    return 'session'; // 隐私模式禁了 localStorage：用默认值即可
  }
}

function storeScope(mode) {
  try {
    globalThis.localStorage?.setItem(SCOPE_KEY, mode);
  } catch {
    /* 存不下就算了，下次打开还是默认口径 */
  }
}

/** 当前请求口径：跟会话时带 id，全部会话时不带。 */
function activeSessionId() {
  return scopeMode === 'session' ? currentSessionId : null;
}

const ROOT_STYLE = {
  display: 'block',
  width: '100%',
  height: '100%',
  minHeight: '520px',
  overflow: 'auto',
  background: 'transparent',
};

function broadcast(snapshot) {
  lastSnapshot = { sessionId: activeSessionId(), snapshot };
  for (const panel of panels) panel.render(snapshot);
}

/** 换口径或换对话时重启轮询：先把旧数字擦掉，再取新的。 */
function restartPolling() {
  if (stopPolling !== null) {
    stopPolling();
    stopPolling = null;
  }
  lastSnapshot = null;
  const sessionId = activeSessionId();
  for (const panel of panels) panel.render(blankSnapshot(sessionId));
  if (panels.size === 0) return;
  stopPolling = pollStatus({ render: broadcast }, sessionId === null ? {} : { sessionId });
}

/** 面板上的口径按钮：本会话 ↔ 全部会话。 */
function setScope(mode) {
  const next = mode === 'all' ? 'all' : 'session';
  if (next === scopeMode) return;
  scopeMode = next;
  storeScope(next);
  restartPolling();
}

function acquirePolling(panel) {
  panels.add(panel);
  if (stopPolling === null) restartPolling();
  const reusable = lastSnapshot !== null && lastSnapshot.sessionId === activeSessionId();
  if (reusable) panel.render(lastSnapshot.snapshot);
  return () => {
    panels.delete(panel);
    if (panels.size === 0 && stopPolling !== null) {
      stopPolling();
      stopPolling = null;
    }
  };
}

/**
 * 宿主把面板塞进「对话的滚动容器」里。切到本页签时那个容器还保留着上一次的
 * scrollTop（对话很长时它贴着底部），于是面板一打开就停在最下面 —— 用户看到
 * 的是「一进来就显示区域的最底下」。
 *
 * 挂载后把可滚动祖先归零。只做一次，不监听滚动，免得和用户抢滚动条。
 */
function resetScroll(node) {
  let element = node?.parentElement ?? null;
  let depth = 0;
  while (element !== null && element !== undefined && depth < 16) {
    if (element.scrollHeight > element.clientHeight + 4 && element.scrollTop > 0) {
      element.scrollTop = 0;
    }
    element = element.parentElement;
    depth += 1;
  }
}

function mount(host) {
  if (mounts.has(host)) return;
  let panel = null;
  try {
    panel = createPanel(host, { onScopeChange: setScope });
  } catch (error) {
    // 面板自己崩了也不能连累宿主渲染：把原因写出来，别白屏。
    console.error('[harnessmm] 面板挂载失败', error);
    const message = `HarnessMM 面板挂载失败：${error && error.message ? error.message : String(error)}`;
    // 面板渲染在 shadow root 里，写 host.textContent 会被影子树挡住 ——
    // 用户只会看到骨架屏永远停在「正在读取插件状态」，一个字的原因都看不到。
    // 所以必须写进影子树本身。
    const target = host.shadowRoot ?? host;
    const box = document.createElement('div');
    box.style.cssText = 'padding:18px;font:13px/1.7 system-ui,sans-serif;color:#b4232c;white-space:pre-wrap';
    box.textContent = message;
    target.replaceChildren(box);
    return;
  }
  const entry = { panel, release: acquirePolling(panel), observer: null };
  mounts.set(host, entry);

  // 立刻归零一次；宿主可能在挂载后才把滚动容器摆到底部，所以再补两次。
  resetScroll(host);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resetScroll(host));
  setTimeout(() => resetScroll(host), 250);

  // 宿主也可能不卸载组件、只切显示。那样 mount 不会再跑一次，
  // 所以用「从不可见变为可见」这个边沿再归零一次。
  if (typeof IntersectionObserver === 'function') {
    let wasVisible = false;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some(item => item.isIntersecting);
      if (visible && !wasVisible) resetScroll(host);
      wasVisible = visible;
    });
    observer.observe(host);
    entry.observer = observer;
  }
}

function unmount(host) {
  const entry = mounts.get(host);
  if (entry === undefined) return;
  mounts.delete(host);
  if (entry.observer !== null && entry.observer !== undefined) entry.observer.disconnect();
  entry.release();
  entry.panel.destroy();
}

/**
 * 类组件（不是函数组件）：React 18 不会执行 ref 回调返回的清理函数，
 * 用 componentWillUnmount 才能确定地拆掉 shadow root 和轮询。
 */
function makePanelComponent(HostReact) {
  return class HarnessMMPanel extends HostReact.Component {
    componentDidMount() {
      if (this.node) mount(this.node);
    }

    componentWillUnmount() {
      if (this.node) {
        unmount(this.node);
        this.node = null;
      }
    }

    render() {
      return HostReact.createElement('div', {
        // 在 ref 里直接挂载：不依赖 componentDidMount 与 ref 的先后顺序，
        // 也顺手处理宿主重渲染时换了节点的情况。
        ref: (node) => {
          if (this.node === node) return;
          if (this.node) unmount(this.node);
          this.node = node;
          if (node) mount(node);
        },
        style: ROOT_STYLE,
      });
    }
  };
}

const HarnessMMPanel = React === null
  // 兜底：至少给一行字，不留白屏。
  ? function HarnessMMUnavailable() { return 'HarnessMM：宿主没有提供 react 模块，面板无法渲染'; }
  : makePanelComponent(React);

export const name = 'harnessmm-panel';
export const inject = ['slots', 'sidebarRightTabs'];

export function apply(ctx) {
  if (React === null) {
    console.error('[harnessmm] 宿主没有提供 react 模块，面板无法渲染');
  }

  // 侧边栏入口：类型（含引导卡片）+ 面板主体，两段式注册。
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    title: () => 'HarnessMM',
    guide: [{
      id: 'panel',
      order: 40,
      title: () => 'HarnessMM 决策复用',
      description: () => '证书、回执与拒绝原因',
    }],
  }), 'harnessmm: panel tab type');

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: TAB_ID,
  }, HarnessMMPanel)), 'harnessmm: panel tab body');

  // 对话头部页签条：list 槽，身份是 id，顺序由 order 决定。
  ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: VIEW_ID,
    order: VIEW_ORDER,
    label: () => 'HarnessMM',
  }, HarnessMMPanel)), 'harnessmm: conversation view');

  /**
   * 跟随当前对话。
   *
   * uiSession.current 是宿主维护的「现在打开的是哪个会话」，切换对话时会通知
   * 订阅者。这里用 ctx.get 而不是 inject —— 万一某个版本没有这个服务，
   * 面板要照常显示（退回全部会话），不能整块不激活。
   */
  ctx.effect(() => {
    let stop = null;
    let timer = null;
    let tries = 0;

    const attach = () => {
      let source = null;
      try {
        source = ctx.get?.('uiSession')?.current ?? null;
      } catch {
        source = null;
      }
      if (source === null || typeof source.subscribe !== 'function') {
        // 服务可能比插件晚注册：退避重试，最多约 20 秒。
        if (tries < 80) {
          tries += 1;
          timer = setTimeout(attach, 250);
        }
        return;
      }

      const read = () => {
        let next = null;
        try {
          const binding = typeof source.getSnapshot === 'function' ? source.getSnapshot() : source.value;
          const key = binding?.key;
          next = typeof key === 'string' && key !== '' ? key : null;
        } catch {
          next = null;
        }
        if (next === currentSessionId) return;
        currentSessionId = next;
        restartPolling();
      };

      read();
      stop = source.subscribe(read);
    };

    attach();
    return () => {
      if (timer !== null) clearTimeout(timer);
      if (typeof stop === 'function') stop();
    };
  }, 'harnessmm: follow current session');
}
