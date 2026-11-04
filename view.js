/**
 * HarnessMM 面板视图层 —— 全插件唯一一份 UI 实现。
 *
 * 两个宿主共用：
 *   1. 独立页 panel.html（Host 路由 /plugins/harnessmm/panel 直接提供）
 *   2. DSH 客户端 client.js（对话页签 + 右侧栏，挂在 shadow root 里，不污染宿主样式）
 *
 * 设计原则（对应「每一步都有源可查」）：
 *   - 每个数字都来自 /plugins/harnessmm/status 的某个具体字段，卡片右上角的
 *     「源」徽标写明出处（快照里的 provenance 块）。
 *   - 证书行可展开到原生回执原文、守卫求值结果与 sha256 证明。
 *   - 事件行能跳到对应证书并高亮，形成「事件 → 证书 → 回执」的闭环。
 *
 * 只读：不产生任何新状态，只把快照画出来。
 */
import { PANEL_CSS } from './panel-css.js';

/* ------------------------------------------------------------------ 常量 */

const PHASE = {
  A: {
    name: '未激活',
    title: '未激活',
    sub: '插件已启用，但本次会话尚未产出合格动作库。这不是故障。',
    btn: '什么样的任务会触发？',
    target: 'about',
  },
  B: {
    name: '已授权未命中',
    title: '已授权 · 等待命中',
    sub: '已记录动作库，但还没有一次守卫命中。',
    btn: '查看动作库',
    target: 'bankCard',
  },
  C: {
    name: '正在复用',
    title: '正在复用',
    sub: '守卫已命中并真实执行，证书已签发。',
    btn: '查看证书',
    target: 'certCard',
  },
};

const EV_KIND = {
  author: { label: '授权', fg: '#92400e', bg: '#fffbeb', bd: '#fde68a', dot: 'var(--amber)', icon: '+' },
  admit: { label: '准入', fg: '#5b21b6', bg: '#f5f3ff', bd: '#ddd6fe', dot: 'var(--violet)', icon: '→' },
  substitute: { label: '替换', fg: '#065f46', bg: '#ecfdf5', bd: '#a7f3d0', dot: 'var(--emerald)', icon: '✓' },
  reject: { label: '拒绝', fg: '#991b1b', bg: '#fef2f2', bd: '#fecaca', dot: 'var(--red)', icon: '✗' },
  defer: { label: '延迟', fg: '#475569', bg: '#f8fafc', bd: '#e2e8f0', dot: 'var(--slate)', icon: '⏸' },
};

const REASON_COLOR = {
  guard_false: 'var(--red)',
  dependency_missing: 'var(--orange)',
  ambiguous_eligible: 'var(--amber)',
  required_field_missing: 'var(--violet)',
  native_error: 'var(--slate)',
  invalid_guard: 'var(--pink)',
  non_json_receipt: 'var(--cyan)',
  missing_receipt: 'var(--blue)',
  public_bytes_exceeded: 'var(--teal)',
};

const GUARD_COLOR = {
  return_code: 'var(--emerald)',
  stdout_contains: 'var(--blue)',
  stdout_equals: 'var(--cyan)',
  stderr_empty: 'var(--teal)',
  json_equals: 'var(--violet)',
};

const PALETTE = [
  'var(--emerald)', 'var(--blue)', 'var(--amber)', 'var(--violet)', 'var(--pink)',
  'var(--cyan)', 'var(--orange)', 'var(--teal)', 'var(--slate)', 'var(--red)',
];

const TONE_COLOR = {
  ok: 'var(--emerald)',
  warn: 'var(--amber)',
  bad: 'var(--red)',
  info: 'var(--blue)',
  muted: 'var(--slate)',
};

/** 工具名 → 请求类型（展示用归类，图例 title 里写明原始工具名）。 */
const KIND_GROUPS = [
  ['文件读取', ['read', 'read_file', 'cat', 'view', 'head', 'tail']],
  ['命令执行', ['pwsh', 'terminal', 'bash', 'shell', 'exec', 'run', 'npm']],
  ['搜索', ['grep', 'glob', 'search', 'find', 'rg']],
  ['编辑写入', ['edit', 'write', 'apply_patch', 'patch', 'multi_edit']],
  ['网络', ['web_fetch', 'web_search', 'fetch', 'browser']],
];

/* ------------------------------------------------------------------ 工具 */

const esc = (value) => String(value === null || value === undefined ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const num = (value) => (Number.isFinite(value) ? value : 0);

const asArray = (value) => (Array.isArray(value) ? value : []);

const obj = (value) => (value !== null && typeof value === 'object' ? value : {});

function pretty(value, limit = 2400) {
  if (value === null || value === undefined) return '—';
  let text;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch (error) {
    text = String(value);
  }
  if (typeof text !== 'string') return '—';
  return text.length > limit ? `${text.slice(0, limit)}\n…（已截断，共 ${text.length} 字符，完整内容见审计日志）` : text;
}

function clockOf(at) {
  if (typeof at !== 'string' || at === '') return '—';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

function agoOf(at, now) {
  if (typeof at !== 'string' || at === '') return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds} 秒前`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前`;
  return `${Math.round(seconds / 3600)} 小时前`;
}

function guardText(guard) {
  const value = obj(guard);
  const keys = Object.keys(value);
  if (keys.length === 0) return '—';
  return keys.map((key) => `${key}=${JSON.stringify(value[key])}`).join(' · ');
}

function kindOf(tool) {
  const name = String(tool ?? '').toLowerCase();
  for (const [kind, names] of KIND_GROUPS) {
    if (names.some((candidate) => name === candidate || name.startsWith(`${candidate}_`))) return kind;
  }
  return '其他';
}

function groupKinds(tools) {
  const map = new Map();
  for (const item of tools) {
    const kind = kindOf(item.name);
    const bucket = map.get(kind) ?? { name: kind, count: 0, tools: [] };
    bucket.count += num(item.count);
    bucket.tools.push(`${item.name} ×${item.count}`);
    map.set(kind, bucket);
  }
  return [...map.values()].sort((left, right) => right.count - left.count);
}

/* ------------------------------------------------------------------ 骨架 */

const cardHead = (icon, title, meta, source) => `
  <header class="ch">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
    <h2>${title}</h2>
    ${meta === '' ? '' : `<span class="meta">${meta}</span>`}
    ${source === '' ? '' : `<span class="src" title="${esc(source.title)}">源 ${esc(source.label)}</span>`}
  </header>`;

const ICONS = {
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  cert: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
  trend: '<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-6"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
};

const SKELETON = `
<div class="hmm-root">
  <div class="switcher" id="phasebar"></div>

  <div class="statusbar" id="statusbar" data-s="A">
    <span class="sb-dot"></span>
    <span class="sb-title" id="sbTitle">—</span>
    <span class="sb-sub" id="sbSub">正在读取插件状态…</span>
    <button class="sb-btn" id="sbBtn" type="button">—</button>
  </div>

  <div class="grid">
    <div class="col-main">

      <section class="card" id="statCard">
        ${cardHead(ICONS.chart, '决策复用统计', '本会话', { label: 'index.js:counters', title: '进程内存计数器（counters）。随 DSH 进程重启归零；守卫命中率由 substitutions / (substitutions + deferrals + uncertified) 计算。' })}
        <div class="pills">
          <div class="pill dim" id="p1"><div class="pv" id="v1">0</div><div class="pl">跳过推理</div></div>
          <div class="pill dim" id="p2"><div class="pv" id="v2">0</div><div class="pl">签发证书</div></div>
          <div class="pill dim" id="p3"><div class="pv" id="v3">0</div><div class="pl">动作库</div></div>
          <div class="pill dim" id="p4"><div class="pv" id="v4">—</div><div class="pl">平均链深</div></div>
          <div class="pill dim" id="p5"><div class="pv" id="v5">—</div><div class="pl">守卫命中率</div></div>
        </div>

        <div class="sect"><h3>被替换的工具</h3><span class="n" id="toolTotal">0</span></div>
        <div class="legend" id="toolLegend"><span class="li" style="color:var(--dim)">尚无替换发生</span></div>

        <div class="divider"></div>

        <div class="sect"><h3>跳过请求的类型</h3><span class="n" id="kindTotal">0</span></div>
        <div class="legend" id="kindLegend"><span class="li" style="color:var(--dim)">尚无替换发生</span></div>

        <div class="divider"></div>

        <div class="sect"><h3>值得注意</h3></div>
        <div id="notable"><div class="empty" style="padding:10px">暂无异常</div></div>
      </section>

      <div class="row2">
        <section class="card" id="rejectCard">
          ${cardHead(ICONS.info, '为什么没命中', '<b id="rejTotal">0</b> 次拒绝', { label: 'pre-admission.rejected[]', title: 'admissions 中 gdr/pre-admission 事件的 rejected[].reason 逐条计数。' })}
          <div class="bars" id="bars"></div>
        </section>

        <section class="card" id="guardCard">
          ${cardHead(ICONS.shield, '守卫字段使用分布', '<b id="guardTotal">0</b> 个守卫', { label: 'certificate.guard', title: '统计证书里 guard 对象实际使用的字段；只统计已经命中的证书。' })}
          <div class="donut-wrap">
            <div class="donut">
              <svg width="132" height="132" viewBox="0 0 132 132">
                <circle cx="66" cy="66" r="52" fill="none" stroke="#f0f2f4" stroke-width="15"/>
                <g id="donutSegs"></g>
              </svg>
              <div class="ctr"><div class="big" id="donutBig">0</div><div class="sm">个守卫</div></div>
            </div>
            <div class="donut-legend" id="donutLegend"></div>
          </div>
        </section>
      </div>

      <div class="row2">
        <section class="card" id="bankCard">
          ${cardHead(ICONS.grid, '当前动作库', '链深 <b id="bankDepth">—</b>', { label: 'controller.sessions[*].banks', title: 'engine.js 里 GuardedReuseController 的 banks（Map<sha256, bank>）。链深按候选依赖图从 root 起算。' })}
          <div class="dag" id="dag">
            <svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" id="dagLines"></svg>
            <div id="dagNodes"></div>
          </div>
          <div class="legend" style="margin-top:10px">
            <span class="li"><span class="d" style="background:var(--cyan)"></span>root 已执行</span>
            <span class="li"><span class="d" style="background:var(--amber)"></span>待命中</span>
            <span class="li"><span class="d" style="background:var(--emerald)"></span>已命中替换</span>
          </div>
        </section>

        <section class="card" id="certCard">
          ${cardHead(ICONS.cert, '替换证书', '<b id="certTotal">0</b> 条', { label: 'admissions:substitution-certificate', title: "admissions 中 kind === 'gdr/substitution-certificate' 的事件；展开可看到原生回执原文与 sha256 证明。" })}
          <div class="rows" id="certRows"><div class="empty-c">暂无证书<br>证书只在守卫命中且动作真实执行后才签发</div></div>
        </section>
      </div>

      <section class="card" id="trendCard">
        ${cardHead(ICONS.trend, '决策复用趋势', '', { label: 'certificates[*].steps_after', title: '横轴是证书里的真实步号（steps_after），不是估算的时间桶。' })}
        <div class="chart" id="chart">
          <svg viewBox="0 0 820 168" preserveAspectRatio="none" id="trendSvg">
            <defs>
              <linearGradient id="gEm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity=".28"/>
                <stop offset="100%" stop-color="#10b981" stop-opacity=".02"/>
              </linearGradient>
            </defs>
            <g stroke="#f0f2f4" stroke-width="1">
              <line x1="0" y1="40" x2="820" y2="40"/><line x1="0" y1="80" x2="820" y2="80"/>
              <line x1="0" y1="120" x2="820" y2="120"/><line x1="0" y1="160" x2="820" y2="160"/>
            </g>
            <path id="trendArea" fill="url(#gEm)" d=""/>
            <line class="guide" id="guide" x1="0" y1="0" x2="0" y2="168"/>
            <path id="trendLine" fill="none" stroke="#10b981" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" d=""/>
            <g id="trendDots"></g>
            <circle id="hoverDot" r="4.5" fill="#10b981" stroke="#fff" stroke-width="2" opacity="0"/>
          </svg>
          <div class="tip" id="tip"></div>
          <div class="axis" id="trendAxis"></div>
        </div>
      </section>

      <section class="card" id="eventCard">
        ${cardHead(ICONS.pulse, '决策复用事件', '<b id="evTotal">0</b> 条 · 审计日志同步', { label: 'admissions', title: 'admissions 环形缓冲（上限 2000 条，超出后丢弃最旧记录）。完整记录另见 harnessmm-audit.jsonl。' })}
        <div class="chips" id="evChips"></div>
        <div class="events" id="evRows"></div>
        <div class="evfoot" id="evFoot"></div>
      </section>

    </div>

    <div class="col-side">
      <section class="card" id="metaCard">
        ${cardHead(ICONS.info, '插件信息', '', '')}
        <div class="kv"><span class="k">插件</span><span class="v">dsh-plugin-harnessmm</span></div>
        <div class="kv"><span class="k">策略</span><span class="v" id="metaPolicy">—</span></div>
        <div class="kv"><span class="k">上限</span><span class="v" id="metaLimit">—</span></div>
        <div class="kv"><span class="k">最小链深</span><span class="v" id="metaChain">—</span></div>
        <div class="kv"><span class="k">运行</span><span class="v" id="metaUptime">—</span></div>
        <div class="kv"><span class="k">审计</span><span class="v" id="metaAudit" style="font-size:10.5px">—</span></div>
      </section>

      <section class="card" id="provCard">
        ${cardHead(ICONS.cert, '数据溯源', '', '')}
        <p class="about" style="margin-bottom:8px;font-size:11.5px;color:var(--muted)">
          面板上每个数字都能追到下面这一行；悬停可看完整路径。
        </p>
        <div id="provList"></div>
      </section>

      <section class="card">
        ${cardHead(ICONS.shield, '这个插件在做什么', '', '')}
        <p class="about">
          模型已经知道接下来三步要做什么，但每调一次工具都要重新发一次完整请求。
          <b>HarnessMM 把这些已决定好的动作存下来，等守卫条件满足就直接执行，跳过那次推理请求。</b>
        </p>
        <div class="note">
          <b>为什么安全</b><br>
          守卫只能是 <code>return_code</code> / <code>stdout</code> / <code>stderr</code> / <code>json</code>
          的确定性比较，对「上一条真实回执」求值。两个候选同时合格时交还模型，绝不猜。
        </div>
        <div class="note">
          <b>诚实边界</b><br>
          证书只记录「确实被跳过的一次推理回调」。插件不折算 token、不估算金额。
        </div>
      </section>

      <section class="card" id="aboutCard">
        ${cardHead(ICONS.bulb, '什么样的任务会触发', '', '')}        <div class="sect" style="margin-bottom:6px"><h3 style="font-size:12px;color:var(--emerald)">适合</h3></div>
        <div class="legend" style="margin-bottom:14px">
          <span class="li">大量已知文件读取</span>
          <span class="li">编辑 → 编译 → 测试 循环</span>
          <span class="li">批量 checkout</span>
          <span class="li">规格明确的长程任务</span>
        </div>
        <div class="sect" style="margin-bottom:6px"><h3 style="font-size:12px;color:var(--red)">不适合</h3></div>
        <div class="legend">
          <span class="li">探索性任务</span>
          <span class="li">每步依赖上一步输出的调试</span>
          <span class="li">无法提前写出三个字面动作的任务</span>
        </div>
      </section>
    </div>
  </div>
</div>`;

/* ------------------------------------------------------------------ 视图 */

/**
 * 在 host 上挂一个面板，返回 { render(snapshot), destroy() }。
 * 重复 render 同一份快照是幂等的；不同快照才会重绘。
 */
export function createPanel(host, options = {}) {
  const shadow = options.shadow !== false && typeof host.attachShadow === 'function';
  // 页签切走再切回来时宿主节点可能被复用：shadow root 只能创建一次，
  // 已经有了就直接复用，否则会抛 "Shadow root cannot be created on a host
  // which already hosts a shadow tree"，面板会白掉。
  const root = shadow ? (host.shadowRoot ?? host.attachShadow({ mode: 'open' })) : host;
  root.innerHTML = `${shadow ? `<style>${PANEL_CSS}</style>` : ''}${SKELETON}`;

  const scope = root.querySelector('.hmm-root');
  const byId = (id) => (root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`));
  const el = {
    phasebar: byId('phasebar'),
    statusbar: byId('statusbar'),
    sbTitle: byId('sbTitle'),
    sbSub: byId('sbSub'),
    sbBtn: byId('sbBtn'),
    toolTotal: byId('toolTotal'),
    toolLegend: byId('toolLegend'),
    kindTotal: byId('kindTotal'),
    kindLegend: byId('kindLegend'),
    notable: byId('notable'),
    rejTotal: byId('rejTotal'),
    bars: byId('bars'),
    guardTotal: byId('guardTotal'),
    donutSegs: byId('donutSegs'),
    donutBig: byId('donutBig'),
    donutLegend: byId('donutLegend'),
    bankDepth: byId('bankDepth'),
    dag: byId('dag'),
    dagLines: byId('dagLines'),
    dagNodes: byId('dagNodes'),
    certTotal: byId('certTotal'),
    certRows: byId('certRows'),
    chart: byId('chart'),
    tip: byId('tip'),
    guide: byId('guide'),
    hoverDot: byId('hoverDot'),
    trendLine: byId('trendLine'),
    trendArea: byId('trendArea'),
    trendDots: byId('trendDots'),
    trendAxis: byId('trendAxis'),
    evTotal: byId('evTotal'),
    evChips: byId('evChips'),
    evRows: byId('evRows'),
    evFoot: byId('evFoot'),
    metaPolicy: byId('metaPolicy'),
    metaLimit: byId('metaLimit'),
    metaChain: byId('metaChain'),
    metaUptime: byId('metaUptime'),
    metaAudit: byId('metaAudit'),
    provList: byId('provList'),
  };

  const state = { filter: 'all', open: new Set(), trend: null, signature: '', data: null };

  /* ------------------------------------------------------ 静态交互绑定 */

  el.certRows.addEventListener('click', (event) => {
    const row = event.target.closest ? event.target.closest('[data-cert]') : null;
    if (row === null) return;
    const key = row.dataset.cert;
    const detail = byId(`cd-${key}`);
    if (detail === null) return;
    const open = detail.classList.toggle('open');
    row.classList.toggle('open', open);
    if (open) state.open.add(key);
    else state.open.delete(key);
  });

  el.evRows.addEventListener('click', (event) => {
    const row = event.target.closest ? event.target.closest('.evrow.linkable') : null;
    if (row === null) return;
    const key = row.dataset.cert;
    const block = byId(`cert-${key}`);
    if (block === null) return;
    const detail = byId(`cd-${key}`);
    const head = block.querySelector('.row');
    if (detail !== null && !detail.classList.contains('open')) {
      detail.classList.add('open');
      if (head !== null) head.classList.add('open');
      state.open.add(key);
    }
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
    block.classList.remove('flash');
    void block.offsetWidth;
    block.classList.add('flash');
    setTimeout(() => block.classList.remove('flash'), 2000);
  });

  el.evChips.addEventListener('click', (event) => {
    const chip = event.target.closest ? event.target.closest('[data-f]') : null;
    if (chip === null) return;
    state.filter = chip.dataset.f;
    if (state.data !== null) {
      renderChips(state.data);
      renderEvents(state.data);
    }
  });

  el.sbBtn.addEventListener('click', () => {
    const phase = PHASE[state.data?.phase] ?? PHASE.A;
    const target = byId(phase.target);
    if (target !== null) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const hideTip = () => {
    el.tip.classList.remove('on');
    el.guide.classList.remove('on');
    el.hoverDot.setAttribute('opacity', '0');
  };

  el.chart.addEventListener('mousemove', (event) => {
    const trend = state.trend;
    if (trend === null || trend.cumulative.length === 0) return;
    const svg = el.trendLine.ownerSVGElement;
    const rect = svg.getBoundingClientRect();
    const rel = (event.clientX - rect.left) / rect.width;
    if (rel < -0.02 || rel > 1.02) { hideTip(); return; }
    const values = trend.cumulative;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(rel * (values.length - 1))));
    const max = Math.max(1, ...values);
    const x = (index / (values.length - 1)) * 820;
    const y = 168 - 8 - (values[index] / max) * (168 - 16);
    el.guide.setAttribute('x1', x);
    el.guide.setAttribute('x2', x);
    el.guide.classList.add('on');
    el.hoverDot.setAttribute('cx', x);
    el.hoverDot.setAttribute('cy', y);
    el.hoverDot.setAttribute('opacity', '1');
    const step = trend.steps[index] ?? index + 1;
    el.tip.innerHTML = `<div class="th">第 ${esc(step)} 步</div>`
      + `<div class="tv"><span>本步跳过</span><b>${esc(trend.delta[index] ?? 0)} 次</b></div>`
      + `<div class="tv"><span>累计</span><b>${esc(values[index])} 次</b></div>`;
    el.tip.classList.add('on');
    const chartRect = el.chart.getBoundingClientRect();
    el.tip.style.left = `${(rect.left - chartRect.left) + (x / 820) * rect.width}px`;
    el.tip.style.top = `${(rect.top - chartRect.top) + (y / 168) * rect.height}px`;
  });
  el.chart.addEventListener('mouseleave', hideTip);

  /* ------------------------------------------------------------ 渲染 */

  function renderPhase(data) {
    const phase = data.phase === 'B' || data.phase === 'C' ? data.phase : 'A';
    const info = PHASE[phase];
    el.statusbar.dataset.s = data.offline === undefined ? phase : 'A';
    el.sbTitle.textContent = data.offline === undefined ? info.title : '读取失败';
    el.sbBtn.textContent = data.offline === undefined ? info.btn : '什么样的任务会触发？';
    if (data.offline !== undefined) {
      el.sbSub.textContent = `无法读取 /plugins/harnessmm/status：${data.offline}（宿主插件可能未启动或路由未注册）`;
    }

    const counters = obj(obj(data.status).counters);
    const banks = asArray(data.banks);
    const certs = asArray(data.certificates);
    const rate = obj(data.diagnostics).guardHitRate;
    const last = obj(data.diagnostics).lastGuardFailure;
    const parts = [];
    if (phase === 'C') {
      parts.push(`本次会话已跳过 ${num(counters.substitutions)} 次推理请求`);
      parts.push(`守卫命中率 ${rate === null || rate === undefined ? '—' : `${rate}%`}`);
      const ago = agoOf(certs.length > 0 ? certs[certs.length - 1].at : null, Date.now());
      if (ago !== null) parts.push(`最近一次 ${ago}`);
    } else if (phase === 'B') {
      const depths = asArray(obj(data.diagnostics).bankChainDepths).filter((depth) => depth > 0);
      parts.push(`已记录 ${banks.length} 个动作库${depths.length > 0 ? `（链深 ${depths.join(' / ')}）` : ''}`);
      parts.push('当前 0 次替换');
      if (last !== null) {
        const reasons = asArray(last.reasons).map((item) => item.reason).join('、');
        parts.push(`最近一次守卫未命中：${reasons === '' ? '未知原因' : reasons}`);
      } else {
        parts.push('尚未出现守卫求值');
      }
    } else {
      parts.push(`本次会话已记录 ${num(counters.requests)} 次推理请求`);
      parts.push('0 个合格动作库');
      parts.push('这不是故障：探索性任务本来就不该被复用');
    }
    if (data.offline === undefined) el.sbSub.textContent = parts.join(' · ');

    el.phasebar.innerHTML = '<span>当前状态：</span>' + ['A', 'B', 'C'].map((key) => {
      const active = key === phase;
      const title = key === 'A' ? '未激活：没有动作库' : key === 'B' ? '已授权未命中：有动作库但没有一次守卫命中' : '正在复用：守卫已命中并真实执行';
      return `<button class="sw ${active ? 'cur' : 'idle'}" type="button" title="${esc(title)}" data-phase="${key}">${key} · ${esc(PHASE[key].name)}</button>`;
    }).join('') + '<span style="margin-left:6px">由真实计数器推导</span>';
  }

  function renderPills(data) {
    const counters = obj(obj(data.status).counters);
    const depths = asArray(obj(data.diagnostics).bankChainDepths).filter((depth) => depth > 0);
    const depth = depths.length === 0 ? null : Math.round((depths.reduce((sum, item) => sum + item, 0) / depths.length) * 10) / 10;
    const rate = obj(data.diagnostics).guardHitRate;
    const rows = [
      ['v1', 'p1', 'blue', num(counters.substitutions), false],
      ['v2', 'p2', 'emerald', num(counters.certificates), false],
      ['v3', 'p3', 'violet', asArray(data.banks).length, false],
      ['v4', 'p4', 'slate', depth === null ? '—' : depth, depth === null],
      ['v5', 'p5', 'amber', rate === null || rate === undefined ? '—' : `${rate}%`, rate === null || rate === undefined],
    ];
    for (const [valueId, pillId, tone, value, dim] of rows) {
      const valueEl = byId(valueId);
      const pillEl = byId(pillId);
      if (valueEl === null || pillEl === null) continue;
      valueEl.textContent = String(value);
      pillEl.className = dim ? 'pill dim' : `pill tone-${tone}`;
    }
  }

  function renderLegend(target, total, items, emptyText) {
    const totalEl = byId(total);
    if (totalEl !== null) totalEl.textContent = String(items.reduce((sum, item) => sum + item.count, 0));
    target.innerHTML = items.length === 0
      ? `<span class="li" style="color:var(--dim)">${esc(emptyText)}</span>`
      : items.map((item, index) => `<span class="li"${item.tools ? ` title="${esc(item.tools.join('、'))}"` : ''}><span class="d" style="background:${PALETTE[index % PALETTE.length]}"></span>${esc(item.name)} <b>${esc(item.count)}</b></span>`).join('');
  }

  function renderNotable(data) {
    const items = asArray(obj(data.diagnostics).notable);
    el.notable.innerHTML = items.length === 0
      ? '<div class="empty" style="padding:10px">暂无异常</div>'
      : items.map((item) => `<div class="nb"><span class="d" style="background:${TONE_COLOR[item.tone] ?? 'var(--slate)'}"></span><span class="k">${esc(item.key)}</span><span class="v">${esc(item.value)}${item.note ? ` <em>${esc(item.note)}</em>` : ''}</span></div>`).join('');
  }

  function renderBars(data) {
    const rejection = asArray(obj(data.diagnostics).rejection).filter((item) => num(item.count) > 0)
      .sort((left, right) => right.count - left.count);
    const total = asArray(obj(data.provenance).rejection ? [obj(data.provenance).rejection] : [])
      .map((item) => num(item.total))[0] ?? rejection.reduce((sum, item) => sum + num(item.count), 0);
    el.rejTotal.textContent = String(total);
    if (rejection.length === 0) {
      el.bars.innerHTML = '<div class="empty-c">还没有守卫拒绝记录<br>守卫全部通过时这里保持为空</div>';
      return;
    }
    const max = Math.max(1, ...rejection.map((item) => num(item.count)));
    el.bars.innerHTML = rejection.map((item) => {
      const value = num(item.count);
      const pct = (value / max) * 100;
      const color = REASON_COLOR[item.reason] ?? 'var(--slate)';
      return `<div class="bar-row"><span class="bn" title="${esc(item.reason)}">${esc(item.reason)}</span>`
        + `<div class="bt"><div class="bf" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>`
        + `<span class="bv${value ? ' hot' : ''}">${value}</span></div>`;
    }).join('');
  }

  function renderDonut(data) {
    const fields = asArray(obj(data.distributions).guardFields);
    const total = fields.reduce((sum, item) => sum + num(item.count), 0);
    el.guardTotal.textContent = String(total);
    el.donutBig.textContent = String(total);
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    let segments = '';
    let legend = '';
    for (const item of fields) {
      const value = num(item.count);
      const share = total === 0 ? 0 : value / total;
      const length = share * circumference;
      const color = GUARD_COLOR[item.field] ?? 'var(--slate)';
      if (length > 0) {
        segments += `<circle cx="66" cy="66" r="${radius}" fill="none" stroke="${color}" stroke-width="15"`
          + ` stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"`
          + ' transform="rotate(-90 66 66)" style="transition:all .5s ease"/>';
      }
      offset += length;
      legend += `<div class="dl"><span class="d" style="background:${color}"></span>`
        + `<span class="nm">${esc(item.field)}</span><span class="pc">${total === 0 ? 0 : Math.round(share * 100)}%</span></div>`;
    }
    el.donutSegs.innerHTML = segments;
    el.donutLegend.innerHTML = legend;
  }

  function renderDag(data) {
    const banks = asArray(data.banks);
    const withCandidates = banks.filter((bank) => asArray(bank.candidates).length > 0);
    const bank = withCandidates.slice().sort((left, right) => num(right.chainDepth) - num(left.chainDepth))[0];
    el.bankDepth.textContent = bank === undefined ? '—' : String(num(bank.chainDepth));
    if (bank === undefined) {
      el.dagNodes.innerHTML = '<div class="empty-c" style="position:absolute;inset:0">尚未记录动作库<br>模型写出合格 CHISEL_PLAN 后出现</div>';
      el.dagLines.innerHTML = '';
      return;
    }

    const candidates = asArray(bank.candidates).slice(0, 8);
    const byId2 = new Map();
    const nodes = [{ id: 'root', label: 'root', tool: bank.root?.name ?? 'root', after: null, status: 'done' }];
    for (const candidate of candidates) {
      nodes.push({
        id: String(candidate.id ?? '?'),
        label: `候选 ${candidate.id ?? '?'}`,
        tool: String(candidate.tool ?? ''),
        after: candidate.after === null || candidate.after === undefined ? 'root' : String(candidate.after),
        status: num(obj(data.status).counters.substitutions) > 0 ? 'hit' : 'run',
      });
    }
    for (const node of nodes) byId2.set(node.id, node);

    const depthOf = new Map([['root', 0]]);
    for (let pass = 0; pass < nodes.length; pass += 1) {
      for (const node of nodes) {
        if (node.id === 'root') continue;
        const parent = depthOf.get(node.after);
        if (parent === undefined) continue;
        depthOf.set(node.id, Math.max(depthOf.get(node.id) ?? 0, parent + 1));
      }
    }
    const maxDepth = Math.max(1, ...depthOf.values());
    const rows = new Map();
    for (const node of nodes) {
      const depth = depthOf.get(node.id) ?? 0;
      const bucket = rows.get(depth) ?? [];
      bucket.push(node);
      rows.set(depth, bucket);
    }
    // 按层排布：一列一层；宽度够就撑满，不够就横向滚动，节点不互相挤压。
    const available = el.dag.clientWidth || 440;
    const spacing = Math.max(80, Math.min(118, (available - 96) / Math.max(1, maxDepth)));
    const canvasWidth = Math.max(available, 62 + maxDepth * spacing + 62);
    const canvasHeight = 196;
    const placed = [];
    for (const [depth, bucket] of [...rows.entries()].sort((left, right) => left[0] - right[0])) {
      bucket.forEach((node, index) => {
        const x = 62 + depth * spacing;
        const y = bucket.length === 1 ? 98 : 34 + (index / (bucket.length - 1)) * 128;
        placed.push({ ...node, x, y });
      });
    }
    const placedById = new Map(placed.map((node) => [node.id, node]));
    const hit = num(obj(data.status).counters.substitutions) > 0;

    const edges = placed.filter((node) => node.id !== 'root').map((node) => {
      const from = placedById.get(node.after) ?? placedById.get('root');
      if (from === undefined) return '';
      const mid = (from.x + node.x) / 2;
      return `<path d="M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${node.y}, ${node.x} ${node.y}" fill="none" stroke="${hit ? 'rgba(16,185,129,.45)' : 'rgba(148,163,184,.4)'}" stroke-width="1"/>`;
    }).join('');

    el.dagLines.innerHTML = '';
    el.dagNodes.innerHTML = `<div class="dag-canvas" style="width:${canvasWidth}px;height:${canvasHeight}px">`
      + `<svg class="lines" viewBox="0 0 ${canvasWidth} ${canvasHeight}" preserveAspectRatio="none">${edges}</svg>`
      + placed.map((node) => `<div class="dn" data-st="${node.status}" style="left:${node.x}px;top:${node.y}px">`
        + `<span class="dk">${esc(node.label)}</span><span class="dt">${esc(node.tool)}</span>`
        + `<span class="do">${esc(node.id === 'root' ? '已执行' : `after ${node.after}`)}</span></div>`).join('')
      + '</div>';
  }

  function renderCerts(data) {
    const certificates = asArray(data.certificates).slice().reverse();
    el.certTotal.textContent = String(certificates.length);
    if (certificates.length === 0) {
      el.certRows.innerHTML = '<div class="empty-c">暂无证书<br>证书只在守卫命中且动作真实执行后才签发</div>';
      return;
    }
    el.certRows.innerHTML = certificates.map((certificate, index) => {
      const key = `${certificate.candidateId ?? '?'}-${certificates.length - index}`;
      const open = state.open.has(key);
      const proof = [
        ['native_receipt_sha256', certificate.receiptSha256 ?? '—'],
        ['bank_sha256', certificate.bankSha256 ?? '—'],
        ['call_id', certificate.callId ?? '—'],
        ['steps', `${num(certificate.stepsBefore)} → ${num(certificate.stepsAfter)}`],
        ['valid_substitution', certificate.validSubstitution ? 'true' : 'false'],
        ['is_error', certificate.isError ? 'true' : 'false'],
        ['at', certificate.at ?? '—'],
        ['session', certificate.session ?? '—'],
      ].map(([label, value]) => `<div class="cd-kv"><span class="kk">${esc(label)}</span><span class="vv${label === 'valid_substitution' && certificate.validSubstitution ? ' ok' : ''}">${esc(value)}</span></div>`).join('');
      return `<div class="cert-block" id="cert-${esc(key)}">
        <div class="row${open ? ' open' : ''}" data-cert="${esc(key)}">
          <span class="ck">✓</span>
          <span class="cid">${esc(certificate.candidateId ?? '?')}</span>
          <span class="ct">${esc(certificate.tool ?? '—')}</span>
          <span class="cg">${esc(guardText(certificate.guard))}</span>
          <span class="chv">›</span>
        </div>
        <div class="cd${open ? ' open' : ''}" id="cd-${esc(key)}">
          <div class="cd-grid">
            <div>
              <div class="cd-k">exact_arguments</div>
              <div class="cd-v">${esc(pretty(certificate.arguments))}</div>
            </div>
            <div class="cd-2">
              <div>
                <div class="cd-k">guard</div>
                <div class="cd-v">${esc(pretty(certificate.guard))}</div>
              </div>
              <div>
                <div class="cd-k">guard_fields（求值结果）</div>
                <div class="cd-v">${esc(pretty(certificate.guardFields))}</div>
              </div>
            </div>
            <div>
              <div class="cd-k">native_receipt（真实回执）</div>
              <div class="cd-v">${esc(pretty(certificate.receipt))}</div>
            </div>
            <div>
              <div class="cd-k">证明</div>
              ${proof}
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function renderTrend(data) {
    const trend = obj(data.trend);
    const values = asArray(trend.cumulative);
    state.trend = { steps: asArray(trend.steps), cumulative: values, delta: asArray(trend.delta) };
    hideTip();
    if (values.length === 0) {
      el.chart.classList.add('is-empty');
      el.trendLine.setAttribute('d', '');
      el.trendArea.setAttribute('d', '');
      el.trendDots.innerHTML = '';
      el.trendAxis.innerHTML = '<span style="color:var(--dim)">还没有替换发生，趋势为空</span>';
      return;
    }
    el.chart.classList.remove('is-empty');
    const max = Math.max(1, ...values);
    const stepX = values.length === 1 ? 0 : 820 / (values.length - 1);
    const points = values.map((value, index) => [index * stepX, 168 - 8 - (value / max) * (168 - 16)]);
    const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    el.trendLine.setAttribute('d', line);
    el.trendArea.setAttribute('d', `${line} L 820 168 L 0 168 Z`);
    el.trendDots.innerHTML = points.map(([x, y], index) => (values[index] === 0 ? ''
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#fff" stroke="#10b981" stroke-width="1.6"/>`)).join('');
    const steps = asArray(trend.steps);
    const picks = [0, Math.floor((steps.length - 1) / 3), Math.floor(((steps.length - 1) * 2) / 3), steps.length - 1];
    el.trendAxis.innerHTML = picks.map((index) => `<span>第 ${esc(steps[index] ?? index + 1)} 步</span>`).join('');
  }

  function renderChips(data) {
    const counts = obj(obj(data.events).counts);
    const total = num(obj(data.events).total);
    const defs = [
      ['all', '全部', null, total],
      ['author', '授权', EV_KIND.author.dot, num(counts.author)],
      ['admit', '准入', EV_KIND.admit.dot, num(counts.admit)],
      ['substitute', '替换', EV_KIND.substitute.dot, num(counts.substitute)],
      ['reject', '拒绝', EV_KIND.reject.dot, num(counts.reject)],
      ['defer', '延迟', EV_KIND.defer.dot, num(counts.defer)],
    ];
    el.evChips.innerHTML = defs.map(([key, label, dot, count]) => `<button class="chip${state.filter === key ? ' on' : ''}" type="button" data-f="${key}">`
      + `${dot ? `<span class="dt" style="background:${dot}"></span>` : ''}${esc(label)}<span class="n">${esc(count)}</span></button>`).join('');
  }

  /** 一条 gdr 事件 → 一行人话 + 关联证书 key。 */
  function describeEvent(event) {
    const raw = obj(event.raw);
    const kind = event.class ?? '';
    if (kind === 'substitute') {
      const candidate = raw.candidate_id ?? '?';
      const tool = raw.exact_native_tool ?? '—';
      const guard = guardText(raw.guard);
      return {
        text: `候选 ${candidate} · ${tool}${guard === '—' ? '' : ` · ${guard}`}`,
        cert: `${candidate}-`,
      };
    }
    if (kind === 'admit') {
      const rejected = asArray(raw.rejected);
      if (rejected.length === 0) {
        const eligible = num(raw.eligible_count) || asArray(raw.eligible).length;
        return { text: `root 回执 · ${eligible} 候选合格`, cert: null };
      }
      const reasons = rejected.map((item) => item.reason).filter((item) => typeof item === 'string');
      return { text: `${reasons.join('、') || '未命中'} · ${rejected.length} 候选不合格`, cert: null };
    }
    if (kind === 'author') {
      const depth = num(raw.chain_depth) || num(raw.depth);
      const candidates = asArray(raw.candidates).length || num(raw.candidate_count);
      return { text: `动作库 · 链深 ${depth || '—'} · ${candidates || '—'} 候选${raw.reason ? ` · ${raw.reason}` : ''}`, cert: null };
    }
    if (kind === 'reject') {
      return { text: raw.reason ? `未认证执行 · ${raw.reason}` : '未认证执行', cert: null };
    }
    if (kind === 'defer') {
      return { text: raw.reason ? `歧义延迟 · ${raw.reason}` : '歧义延迟 · 交还模型', cert: null };
    }
    return { text: String(raw.kind ?? '未知事件'), cert: null };
  }

  function renderEvents(data) {
    const events = asArray(obj(data.events).recent);
    const total = num(obj(data.events).total);
    el.evTotal.textContent = String(total);
    const filtered = state.filter === 'all' ? events : events.filter((event) => event.class === state.filter);
    const rows = filtered.slice(-200).reverse();
    if (rows.length === 0) {
      el.evRows.innerHTML = '<div class="empty-c">暂无事件<br>模型第一次进入决策点后开始记录</div>';
      el.evFoot.textContent = '';
      return;
    }
    // 证书 key 前缀匹配：替换事件用 candidate_id 关联到最新一条同候选证书
    const certKeys = asArray(data.certificates).slice().reverse()
      .map((certificate, index) => `${certificate.candidateId ?? '?'}-${asArray(data.certificates).length - index}`);
    el.evRows.innerHTML = rows.map((event) => {
      const kind = EV_KIND[event.class] ?? { label: '事件', fg: 'var(--muted)', bg: 'var(--pill)', bd: 'var(--border)', dot: 'var(--slate)', icon: '·' };
      const described = describeEvent(event);
      let certKey = null;
      if (described.cert !== null) {
        certKey = certKeys.find((key) => key.startsWith(described.cert)) ?? null;
      }
      const session = event.session === null || event.session === undefined ? '—' : String(event.session);
      const position = session.length > 6 ? `…${session.slice(-6)}` : session;
      return `<div class="evrow${certKey === null ? '' : ' linkable'}"${certKey === null ? '' : ` data-cert="${esc(certKey)}"`}>`
        + `<span class="evi" style="color:${kind.dot}">${kind.icon}</span>`
        + `<span class="evk" style="color:${kind.fg};background:${kind.bg};border:1px solid ${kind.bd}">${esc(kind.label)}</span>`
        + `<span class="evd">${esc(described.text)}</span>`
        + `<span class="evp">${esc(position)}</span>`
        + `<span class="evt">${esc(clockOf(event.at))}</span>`
        + `${certKey === null ? '' : '<span class="evgo">跳转 ›</span>'}</div>`;
    }).join('');

    el.evFoot.textContent = rows.length < total
      ? `显示最近 ${rows.length} 条 / 共 ${total} 条 · 完整记录见审计日志`
      : `共 ${total} 条 · 完整记录见审计日志`;
  }

  function renderMeta(data) {
    const status = obj(data.status);
    const policy = obj(status.policy);
    const audit = obj(obj(data.provenance).audit);
    el.metaPolicy.textContent = policy.version === undefined ? '—' : `policy v${policy.version}`;
    el.metaLimit.textContent = `${num(policy.maximum_candidates) || '—'} 候选 · ${num(policy.maximum_fast_steps) || '—'} 步`;
    el.metaChain.textContent = String(num(status.minimumChain));
    const uptime = num(status.uptimeSeconds);
    el.metaUptime.textContent = uptime < 60 ? `${uptime} 秒` : uptime < 3600 ? `${Math.round(uptime / 60)} 分钟` : `${Math.round(uptime / 3600)} 小时`;
    const path = typeof audit.path === 'string' ? audit.path : '';
    el.metaAudit.textContent = path === '' ? '—' : path.split(/[\\/]/).pop();
    el.metaAudit.setAttribute('title', path);
  }

  function renderProvenance(data) {
    if (el.provList === null) return;
    const prov = obj(data.provenance);
    const counters = obj(prov.counters);
    const admissions = obj(prov.admissions);
    const rejection = obj(prov.rejection);
    const trend = obj(prov.trend);
    const audit = obj(prov.audit);
    const rows = [
      ['跳过推理 / 证书', counters.source, counters.note],
      ['替换证书', obj(prov.certificates).source, null],
      ['当前动作库', obj(prov.banks).source, null],
      ['为什么没命中', rejection.source, null],
      ['趋势', trend.source, null],
      ['事件', admissions.source === undefined ? null : `${admissions.source}（${num(admissions.count)}/${num(admissions.capacity)}）`, null],
      ['审计日志', typeof audit.path === 'string' ? audit.path : null, null],
    ].filter(([, value]) => typeof value === 'string' && value !== '');
    el.provList.innerHTML = rows.map(([label, value, note]) => '<div class="prov">'
      + `<div class="prov-k">${esc(label)}</div>`
      + `<div class="prov-v" title="${esc(note === null ? value : `${value} · ${note}`)}">${esc(value)}</div>`
      + '</div>').join('');
  }

  function render(data) {
    state.data = data;
    renderPhase(data);
    renderPills(data);
    renderLegend(el.toolLegend, 'toolTotal', asArray(obj(data.distributions).tools), '尚无替换发生');
    renderLegend(el.kindLegend, 'kindTotal', groupKinds(asArray(obj(data.distributions).tools)), '尚无替换发生');
    renderNotable(data);
    renderBars(data);
    renderDonut(data);
    renderDag(data);
    renderCerts(data);
    renderTrend(data);
    renderChips(data);
    renderEvents(data);
    renderMeta(data);
    renderProvenance(data);
    return scope;
  }

  return {
    element: scope,
    render,
    destroy() {
      if (shadow) host.shadowRoot?.replaceChildren();
      else host.innerHTML = '';
    },
  };
}

/**
 * 轮询 /plugins/harnessmm/status，把每份新快照交给面板。
 * 同一份快照（文本完全一致）不会触发重绘，避免打断展开/悬停状态。
 */
export function pollStatus(panel, options = {}) {
  const url = options.url ?? '/plugins/harnessmm/status';
  const interval = options.interval ?? 2000;
  let signature = '';
  let stopped = false;
  let timer = null;

  const tick = async () => {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (stopped) return;
      if (text !== signature) {
        signature = text;
        panel.render(JSON.parse(text));
      }
    } catch (error) {
      if (stopped) return;
      const message = String(error?.message ?? error);
      if (`offline:${message}` !== signature) {
        signature = `offline:${message}`;
        panel.render(offline(message));
      }
    }
    if (!stopped) timer = setTimeout(tick, interval);
  };

  tick();
  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
  };
}

/** 读不到快照时的降级快照：界面结构不变，数字全部清零并说明原因。 */
function offline(reason) {
  return {
    schema: 'harnessmm-panel/offline',
    phase: 'A',
    offline: reason,
    provenance: { audit: { path: null } },
    status: { counters: {}, policy: {}, minimumChain: 0, uptimeSeconds: 0, sessions: 0, pendingActions: 0 },
    diagnostics: { rejection: [], notable: [], bankChainDepths: [], guardHitRate: null, lastGuardFailure: null },
    banks: [],
    certificates: [],
    distributions: { tools: [], sessions: [], guardFields: [] },
    trend: { steps: [], cumulative: [], delta: [] },
    events: { total: 0, counts: {}, recent: [] },
  };
}

export { PANEL_CSS };
