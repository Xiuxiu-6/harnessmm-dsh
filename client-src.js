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
import { createPanel, pollStatus } from './view.js';

const TAB_ID = 'dsh-plugin-harnessmm';
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
let lastSnapshot = null;

const ROOT_STYLE = {
  display: 'block',
  width: '100%',
  height: '100%',
  minHeight: '520px',
  overflow: 'auto',
  background: 'transparent',
};

function broadcast(snapshot) {
  lastSnapshot = snapshot;
  for (const panel of panels) panel.render(snapshot);
}

function acquirePolling(panel) {
  panels.add(panel);
  if (lastSnapshot !== null) panel.render(lastSnapshot);
  if (stopPolling === null) {
    stopPolling = pollStatus({ render: broadcast });
  }
  return () => {
    panels.delete(panel);
    if (panels.size === 0 && stopPolling !== null) {
      stopPolling();
      stopPolling = null;
    }
  };
}

function mount(host) {
  if (mounts.has(host)) return;
  let panel = null;
  try {
    panel = createPanel(host);
  } catch (error) {
    // 面板自己崩了也不能连累宿主渲染：把原因写在页签里，别白屏。
    console.error('[harnessmm] 面板挂载失败', error);
    host.textContent = `HarnessMM 面板挂载失败：${error && error.message ? error.message : String(error)}`;
    return;
  }
  mounts.set(host, { panel, release: acquirePolling(panel) });
}

function unmount(host) {
  const entry = mounts.get(host);
  if (entry === undefined) return;
  mounts.delete(host);
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
}
