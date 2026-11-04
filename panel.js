/**
 * Host 侧面板装配：注册只读数据路由 + 面板页面路由。
 *
 * 挂载方式（在 index.js 的 apply() 末尾加两行）：
 *
 *   import { installPanel } from './panel.js';
 *   installPanel(ctx, { controller, counters, policy, minimumChain, config: resolved, admissions, startedAt });
 *
 * 设计原则：
 *   - 只读。任何路由都不修改插件状态。
 *   - webServer 用双键探测 + 延迟重试（headless profile 不挂载，不能阻塞启动）。
 *   - 所有路由经 authenticatedWebRoutes 包装。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildSnapshot } from './snapshot.js';
import { authenticatedWebRoutes, sendJson, sendHtml } from './web-routes.js';

/** Web 服务键候选，新键优先（0.2.x 用 webServer，更早用 httpServer）。 */
const WEB_SERVER_KEYS = ['webServer', 'httpServer'];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PANEL_FILE = path.join(HERE, 'panel.html');

/** 审计文件行数（best effort，失败返回 null）。 */
export function countAuditLines(auditPath) {
  try {
    if (!auditPath || !existsSync(auditPath)) return null;
    const text = readFileSync(auditPath, 'utf8');
    if (!text) return 0;
    let n = 0;
    for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 10) n += 1;
    if (text.charCodeAt(text.length - 1) !== 10) n += 1;
    return n;
  } catch {
    return null;
  }
}

/** 读取面板 HTML（每次请求都读，便于开发期直接改文件看效果）。 */
function readPanelHtml() {
  try {
    return readFileSync(PANEL_FILE, 'utf8');
  } catch (error) {
    return `<!doctype html><meta charset="utf-8"><title>HarnessMM 面板</title>
<body style="font:13px/1.7 monospace;padding:24px;background:#f7f8fa;color:#1f2328">
<h2>面板资源缺失</h2>
<p>找不到 <code>${PANEL_FILE}</code></p>
<p>${String(error?.message ?? error)}</p>
</body>`;
  }
}

/**
 * 装配面板。返回 disposer。
 * @param {object} ctx  Cordis 上下文
 * @param {object} deps 插件内部引用（只读使用）
 */
export function installPanel(ctx, deps) {
  let installed = false;
  let disposed = false;
  const timers = [];

  /**
   * 装配面板。任何异常都在这里吞掉 —— 面板是可选的观测层，
   * 它坏了绝不能让决策复用本身失效。失败只记一条日志，核心功能照常。
   */
  const tryInstall = () => {
    if (installed || disposed) return true;

    try {
      return doInstall();
    } catch (error) {
      installed = true;   // 不再重试，避免刷日志
      console.warn('[harnessmm] panel surface unavailable:', String(error?.message ?? error));
      return true;
    }
  };

  const doInstall = () => {
    if (installed || disposed) return true;

    const rawWebServer = ctx.get(WEB_SERVER_KEYS[0]) ?? ctx.get(WEB_SERVER_KEYS[1]);
    if (rawWebServer === undefined) return false;

    const server = authenticatedWebRoutes(rawWebServer, () => ctx.get('connection'));
    installed = true;

    /* ---------------- 1. 快照 JSON ---------------- */
    ctx.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/harnessmm/status',
      handler: async (req, res) => {
        try {
          const auditPath = deps.auditPath ?? auditPathOf();
          const snapshot = buildSnapshot({
            controller: deps.controller,
            counters: deps.counters,
            policy: deps.policy,
            minimumChain: deps.minimumChain,
            config: deps.config,
            admissions: deps.admissions,
            startedAt: deps.startedAt,
            auditPath,
            auditLines: countAuditLines(auditPath),
          });
          sendJson(res, 200, snapshot);
        } catch (error) {
          sendJson(res, 500, {
            error: 'snapshot_failed',
            message: String(error?.message ?? error),
          });
        }
      },
    }), 'harnessmm-panel: status route');

    /* ---------------- 2. 面板页面 ---------------- */
    ctx.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/harnessmm/panel',
      handler: async (req, res) => {
        sendHtml(res, 200, readPanelHtml());
      },
    }), 'harnessmm-panel: page route');

    /* ---------------- 3. 健康检查 ---------------- */
    ctx.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/harnessmm/health',
      handler: async (req, res) => {
        sendJson(res, 200, {
          ok: true,
          schema: 'harnessmm-panel/v1',
          uptimeSeconds: Math.round((Date.now() - (deps.startedAt ?? Date.now())) / 1000),
        });
      },
    }), 'harnessmm-panel: health route');

    return true;
  };

  // 立即尝试；未就绪则短轮询重试（最多 60 次 × 500ms = 30s）
  if (!tryInstall()) {
    let attempt = 0;
    const tick = () => {
      if (disposed) return;
      attempt += 1;
      if (tryInstall() || attempt >= 60) return;
      timers.push(setTimeout(tick, 500));
    };
    timers.push(setTimeout(tick, 500));
  }

  return () => {
    disposed = true;
    for (const t of timers) clearTimeout(t);
  };
}

/** 审计文件默认位置，与 index.js 的 auditPath() 保持一致。 */
function auditPathOf() {
  const home = process.env.DSH_HOME || process.env.USERPROFILE || process.env.HOME || process.cwd();
  return `${home}/harnessmm-audit.jsonl`.replace(/\\/g, '/');
}
