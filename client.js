/* HarnessMM 面板客户端 —— 由 build-client.mjs 生成，勿手改 */
window.__ModuleLoader__.load({id:'harnessmm-dsh',factory:function(require){
var __hmmRequire = typeof require === 'function' ? require : null;
var HarnessMMClient = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	// panel-css.js
	/**
	* 面板样式表。
	*
	* 这个文件曾在仓库里丢失（发布包里只带构建产物，所以一直没被发现），
	* 现从已构建的 client.js 里的 PANEL_CSS 字面量逐字节还原。
	* 改样式请直接改这里，然后跑 node build-client.mjs。
	*/
	const PANEL_CSS = ":root{\n  --bg:#f7f8fa; --card:#ffffff; --border:#e8eaed; --border-soft:#f0f2f4;\n  --text:#1f2328; --muted:#6e7781; --dim:#9aa4b2; --pill:#f4f5f7; --hover:#f8f9fb;\n  --emerald:#10b981; --teal:#14b8a6; --blue:#3b82f6; --cyan:#06b6d4;\n  --violet:#8b5cf6; --pink:#ec4899; --orange:#f97316; --amber:#f59e0b;\n  --red:#ef4444; --slate:#94a3b8;\n  --r:12px;\n  --mono:'Cascadia Code','Consolas','SF Mono','DejaVu Sans Mono',monospace;\n  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;\n}\n*{box-sizing:border-box;margin:0;padding:0}\nhtml,body{background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased;font-size:13px}\nbody{padding:16px 18px 60px}\n\n/* 状态条 */\n.statusbar{\n  display:flex;align-items:center;gap:10px;background:var(--card);\n  border:1px solid var(--border);border-radius:var(--r);\n  padding:11px 14px;margin-bottom:14px;border-left:3px solid var(--slate);\n  transition:border-left-color .3s ease;\n}\n.statusbar[data-s=\"B\"]{border-left-color:var(--amber)}\n.statusbar[data-s=\"C\"]{border-left-color:var(--emerald)}\n.sb-dot{width:7px;height:7px;border-radius:50%;background:var(--slate);flex:none;transition:background .3s}\n.statusbar[data-s=\"B\"] .sb-dot{background:var(--amber)}\n.statusbar[data-s=\"C\"] .sb-dot{background:var(--emerald);animation:pulse 1.8s infinite}\n@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}\n.sb-title{font-size:13px;font-weight:650}\n.sb-sub{font-size:12px;color:var(--muted);flex:1}\n.sb-btn{\n  font-family:inherit;font-size:11.5px;padding:5px 11px;border-radius:7px;\n  border:1px solid var(--border);background:var(--card);color:var(--muted);\n  cursor:pointer;transition:all .15s;white-space:nowrap;\n}\n.sb-btn:hover{background:var(--hover);color:var(--text)}\n\n/* 状态切换 */\n.switcher{display:flex;gap:6px;margin-bottom:14px;align-items:center;font-size:11px;color:var(--dim)}\n.sw{\n  font-family:inherit;font-size:11.5px;padding:5px 12px;border-radius:7px;\n  border:1px solid var(--border);background:var(--card);color:var(--muted);\n  cursor:pointer;transition:all .15s;\n}\n.sw:hover{background:var(--hover)}\n.sw.on{background:#eef2ff;border-color:#c7d2fe;color:#3730a3;font-weight:600}\n\n/* 栅格 */\n.grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}\n.col-main{display:flex;flex-direction:column;gap:14px;min-width:0}\n.col-side{display:flex;flex-direction:column;gap:14px;min-width:0}\n.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;min-width:0}\n\n/* 卡片 */\n.card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;min-width:0}\n.ch{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}\n.ch svg{width:15px;height:15px;flex:none;color:var(--muted)}\n.ch h2{font-size:13px;font-weight:650;flex:1;min-width:80px}\n.ch .meta{font-size:11.5px;color:var(--dim);font-variant-numeric:tabular-nums;white-space:nowrap}\n.ch .meta b{color:var(--muted);font-weight:600}\n\n/* 药丸 */\n.pills{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}\n.pill{background:var(--pill);border-radius:10px;padding:11px 15px;min-width:104px;transition:background .2s}\n.pill .pv{font-size:22px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.5px}\n.pill .pl{font-size:11.5px;color:var(--muted);margin-top:3px}\n.pill.hi .pv{color:var(--emerald)}\n.pill.dim .pv{color:var(--dim)}\n.pill.warn .pv{color:var(--amber)}\n\n/* 分节 */\n.sect{display:flex;align-items:baseline;gap:8px;margin-bottom:9px}\n.sect h3{font-size:12.5px;font-weight:600}\n.sect .n{margin-left:auto;font-size:11.5px;color:var(--dim);font-variant-numeric:tabular-nums}\n.divider{height:1px;background:var(--border-soft);margin:16px 0}\n\n/* 图例 */\n.legend{display:flex;flex-wrap:wrap;gap:6px 18px}\n.li{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}\n.li .d{width:7px;height:7px;border-radius:2px;flex:none}\n.li b{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}\n\n/* 值得注意 */\n.nb{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border-soft)}\n.nb:last-child{border-bottom:0}\n.nb .d{width:7px;height:7px;border-radius:2px;flex:none}\n.nb .k{color:var(--muted);flex:1}\n.nb .v{color:var(--text);font-weight:650;font-family:var(--mono);font-size:11.5px}\n.nb .v em{font-style:normal;color:var(--dim);font-weight:400}\n\n/* 条形图 */\n.bars{display:flex;flex-direction:column;gap:11px}\n.bar-row{display:grid;grid-template-columns:132px 1fr 30px;gap:10px;align-items:center}\n.bar-row .bn{font-family:var(--mono);font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.bar-row .bt{height:7px;background:var(--pill);border-radius:4px;overflow:hidden}\n.bar-row .bf{height:100%;border-radius:4px;width:0;transition:width .6s cubic-bezier(.4,0,.2,1)}\n.bar-row .bv{font-size:11.5px;text-align:right;color:var(--dim);font-variant-numeric:tabular-nums}\n.bar-row .bv.hot{color:var(--red);font-weight:600}\n\n/* 环形图 */\n.donut-wrap{display:flex;align-items:center;gap:20px}\n.donut{position:relative;flex:none}\n.donut .ctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}\n.donut .ctr .big{font-size:19px;font-weight:700;letter-spacing:-.4px}\n.donut .ctr .sm{font-size:10.5px;color:var(--dim);margin-top:1px}\n.donut-legend{display:flex;flex-direction:column;gap:7px;flex:1;min-width:0}\n.dl{display:flex;align-items:center;gap:7px;font-size:12px}\n.dl .d{width:7px;height:7px;border-radius:2px;flex:none}\n.dl .nm{color:var(--muted);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.dl .pc{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}\n\n/* DAG */\n.dag{position:relative;height:196px;margin:2px 0 4px}\n.dag svg.lines{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}\n.dn{\n  position:absolute;transform:translate(-50%,-50%);background:var(--card);\n  border:1px solid var(--border);border-radius:9px;padding:8px 10px;width:104px;\n  box-shadow:0 1px 2px rgba(16,24,40,.04);transition:all .18s;\n}\n.dn:hover{border-color:#c7d2fe;box-shadow:0 2px 8px rgba(16,24,40,.08)}\n.dn .dk{font-size:9px;letter-spacing:.3px;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:3px}\n.dn .dt{font-size:11.5px;font-weight:650;display:block}\n.dn .do{font-size:10px;color:var(--muted);display:block;margin-top:2px}\n.dn[data-st=\"done\"] .dk{color:var(--cyan)}\n.dn[data-st=\"run\"] .dk{color:var(--amber)}\n.dn[data-st=\"hit\"]{border-color:#a7f3d0;background:#f0fdf9}\n.dn[data-st=\"hit\"] .dk{color:var(--emerald)}\n\n/* 证书行 */\n.rows{display:flex;flex-direction:column}\n.row{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--border-soft);font-size:12px;transition:background .15s}\n.row:last-child{border-bottom:0}\n.row:hover{background:var(--hover);border-radius:6px}\n.row .ck{color:var(--emerald);flex:none;font-size:11px}\n.row .cid{font-family:var(--mono);font-size:11px;font-weight:700;flex:none;min-width:16px}\n.row .ct{font-family:var(--mono);font-size:11.5px;color:var(--muted);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.row .cg{\n  font-size:10.5px;padding:2px 7px;border-radius:5px;flex:none;\n  background:#fffbeb;border:1px solid #fde68a;color:#92400e;\n  font-family:var(--mono);white-space:nowrap;\n}\n.row .chv{color:var(--dim);font-size:10px;flex:none;transition:transform .2s ease}\n.row.open .chv{transform:rotate(90deg)}\n\n/* ============ 证书展开 ============ */\n.cert-block{border-bottom:1px solid var(--border-soft)}\n.cert-block:last-child{border-bottom:0}\n.cert-block .row{border-bottom:0;cursor:pointer}\n.cert-block .row.open{background:var(--hover);border-radius:6px}\n.cd{\n  overflow:hidden;max-height:0;opacity:0;padding:0 10px;\n  transition:max-height .4s cubic-bezier(.4,0,.2,1),opacity .25s ease,padding .3s ease;\n}\n.cd.open{max-height:700px;opacity:1;padding:2px 10px 14px}\n.cd-grid{display:flex;flex-direction:column;gap:10px}\n.cd-k{font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--dim);margin-bottom:4px}\n.cd-v{\n  font-family:var(--mono);font-size:10.8px;line-height:1.65;color:var(--text);\n  background:var(--pill);border-radius:6px;padding:7px 9px;\n  white-space:pre-wrap;word-break:break-all;\n}\n.cd-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.cd-kv{display:flex;gap:8px;font-size:10.8px;font-family:var(--mono);padding:2.5px 0}\n.cd-kv .kk{color:var(--dim);flex:none;min-width:118px}\n.cd-kv .vv{color:var(--text);word-break:break-all}\n.cd-kv .vv.ok{color:var(--emerald);font-weight:600}\n@keyframes flashRow{\n  0%{background:transparent}\n  12%{background:#d1fae5}\n  65%{background:#ecfdf5}\n  100%{background:transparent}\n}\n.cert-block.flash .row{animation:flashRow 1.9s ease}\n\n/* 趋势 */\n.chart{position:relative;margin-top:4px}\n.chart svg{display:block;width:100%;height:auto}\n.axis{display:flex;justify-content:space-between;font-size:10.5px;color:var(--dim);margin-top:7px;font-variant-numeric:tabular-nums}\n\n/* 开关组 */\n.seg{display:inline-flex;gap:2px;padding:2px;background:var(--pill);border-radius:8px}\n.seg button{font-family:inherit;font-size:11px;padding:4px 10px;border-radius:6px;border:0;background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}\n.seg button.on{background:var(--card);color:var(--text);font-weight:600;box-shadow:0 1px 2px rgba(16,24,40,.06)}\n\n/* ============ 筛选 chips ============ */\n.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}\n.chip{\n  font-family:inherit;font-size:11.5px;padding:4px 10px;border-radius:7px;\n  border:1px solid var(--border);background:var(--card);color:var(--muted);\n  cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;\n}\n.chip:hover{background:var(--hover)}\n.chip.on{background:#eef2ff;border-color:#c7d2fe;color:#3730a3;font-weight:600}\n.chip .n{font-size:10.5px;opacity:.7;font-variant-numeric:tabular-nums}\n.chip .dt{width:6px;height:6px;border-radius:2px;flex:none}\n\n/* ============ 事件行 ============ */\n.events{display:flex;flex-direction:column}\n.evrow{\n  display:flex;align-items:center;gap:10px;padding:7px 6px;\n  border-bottom:1px solid var(--border-soft);font-size:12px;\n  transition:background .15s;\n}\n.evrow:last-child{border-bottom:0}\n.evrow:hover{background:var(--hover);border-radius:6px}\n.evi{width:14px;text-align:center;font-size:11px;flex:none;font-weight:700}\n.evk{font-size:10.5px;padding:1.5px 7px;border-radius:4px;flex:none;min-width:42px;text-align:center;font-weight:600}\n.evd{\n  flex:1;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\n  font-family:var(--mono);font-size:11px;min-width:0;\n}\n.evp{color:var(--dim);font-size:10.5px;flex:none;font-variant-numeric:tabular-nums;font-family:var(--mono)}\n.evt{color:var(--dim);font-size:10.5px;flex:none;font-variant-numeric:tabular-nums;min-width:52px;text-align:right}\n.evfoot{padding-top:10px;font-size:11px;color:var(--dim);text-align:center}\n.evrow.linkable{cursor:pointer}\n.evrow.linkable:hover{background:#ecfdf5;border-radius:6px}\n.evgo{font-size:10px;color:var(--emerald);flex:none;opacity:0;transition:opacity .15s}\n.evrow.linkable:hover .evgo{opacity:1}\n\n/* ============ 趋势 tooltip ============ */\n.tip{\n  position:absolute;pointer-events:none;opacity:0;z-index:10;\n  background:#1f2328;color:#fff;font-size:11px;line-height:1.55;\n  padding:8px 11px;border-radius:8px;white-space:nowrap;\n  transform:translate(-50%,-114%);transition:opacity .12s ease;\n  box-shadow:0 4px 14px rgba(0,0,0,.2);\n}\n.tip.on{opacity:1}\n.tip .th{font-weight:700;margin-bottom:4px;color:#a7f3d0;font-size:11px}\n.tip .tv{display:flex;justify-content:space-between;gap:16px;color:#cbd5e1}\n.tip .tv b{color:#fff;font-weight:600}\n.guide{stroke:#10b981;stroke-width:1;stroke-dasharray:3 3;opacity:0;transition:opacity .12s}\n.guide.on{opacity:.45}\n\n/* 侧栏 */\n.kv{display:flex;align-items:center;gap:9px;padding:7px 0;font-size:12px}\n.kv .k{color:var(--muted);flex:none;min-width:76px}\n.kv .v{margin-left:auto;color:var(--text);font-weight:600;font-family:var(--mono);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.about{font-size:12px;line-height:1.75;color:var(--muted)}\n.about b{color:var(--text);font-weight:650}\n.about code{font-family:var(--mono);font-size:11px;background:var(--pill);padding:1px 4px;border-radius:3px}\n.note{margin-top:10px;padding:10px 12px;border-radius:9px;background:var(--pill);font-size:11.5px;line-height:1.7;color:var(--muted)}\n.note b{color:var(--text)}\n.empty{padding:22px 4px;text-align:center;font-size:12px;color:var(--dim);line-height:1.7}\n\n@media(max-width:1180px){\n  .grid{grid-template-columns:minmax(0,1fr)}\n  .col-side{flex-direction:row;flex-wrap:wrap}\n  .col-side .card{flex:1;min-width:280px}\n}\n@media(max-width:820px){\n  .row2{grid-template-columns:1fr}\n  .pills{gap:8px}\n  .pill{flex:1;min-width:0;padding:10px 12px}\n  .pill .pv{font-size:19px}\n  .evp{display:none}\n}\n\n/* ---- 追加：在 DSH 里以 shadow root 挂载时的容器样式 ---- */\n.hmm-root{\n  \n  --bg:#f7f8fa; --card:#ffffff; --border:#e8eaed; --border-soft:#f0f2f4;\n  --text:#1f2328; --muted:#6e7781; --dim:#9aa4b2; --pill:#f4f5f7; --hover:#f8f9fb;\n  --emerald:#10b981; --teal:#14b8a6; --blue:#3b82f6; --cyan:#06b6d4;\n  --violet:#8b5cf6; --pink:#ec4899; --orange:#f97316; --amber:#f59e0b;\n  --red:#ef4444; --slate:#94a3b8;\n  --r:12px;\n  --mono:'Cascadia Code','Consolas','SF Mono','DejaVu Sans Mono',monospace;\n  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;\n\n  container-type:inline-size;\n  box-sizing:border-box;\n  background:var(--bg);color:var(--text);font-family:var(--sans);\n  -webkit-font-smoothing:antialiased;font-size:14px;line-height:1.6;\n  padding:20px 22px 64px;min-height:100%;\n}\n.hmm-root *{box-sizing:border-box;margin:0;padding:0}\n.hmm-root .card,.hmm-root .statusbar{background:var(--card)}\n\n/* 溯源徽标：每个卡片右上角的「源」 */\n.src{\n  font-family:var(--mono);font-size:10px;line-height:1.4;\n  color:var(--dim);border:1px solid var(--border);border-radius:5px;\n  padding:1px 6px;cursor:help;white-space:nowrap;max-width:260px;\n  overflow:hidden;text-overflow:ellipsis;\n}\n.src:hover{color:var(--muted);border-color:#d8dde3}\n\n/* 状态胶囊：当前相位只读展示 */\n.sw.cur{background:#eef2ff;border-color:#c7d2fe;color:#3730a3;font-weight:600;cursor:default}\n.sw.idle{cursor:default;opacity:.55}\n\n/* 空态居中 */\n.empty-c{display:flex;align-items:center;justify-content:center;padding:22px 10px;text-align:center;\n  font-size:12px;color:var(--dim);line-height:1.7}\n\n/* 证书证明区：等宽数字 */\n.cd-kv .vv{font-family:var(--mono);font-size:10.5px;word-break:break-all}\n.cd-v{max-height:220px;overflow:auto}\n\n/* 动作库图：深链横向滚动，节点不互相挤压 */\n.hmm-root .dag{overflow-x:auto;overflow-y:hidden;padding-bottom:2px}\n.hmm-root .dag-canvas{position:relative;min-width:100%}\n.hmm-root .dn{width:auto;min-width:76px;max-width:104px;padding:7px 9px}\n.hmm-root .dn .dt{font-size:11px}\n.hmm-root .kv .v{min-width:0}\n\n/* 证书行：守卫摘要过长时截断，不撑破卡片 */\n.hmm-root .row .cg{min-width:0;max-width:52%;overflow:hidden;text-overflow:ellipsis}\n.hmm-root .row .ct{min-width:40px}\n\n/* 数据溯源清单：标签一行、路径一行，窄栏里也能读 */\n.prov{padding:7px 0;border-bottom:1px solid var(--border-soft)}\n.prov:last-child{border-bottom:0}\n.prov-k{font-size:11.5px;color:var(--muted);margin-bottom:2px}\n.prov-v{font-family:var(--mono);font-size:10px;color:var(--text);line-height:1.5;word-break:break-all}\n\n/* ============================================================\n   排版层：把 mockup 的紧凑密度调成 dsh-context 那种呼吸感\n   —— 正文 14px、卡片 20/22 内边距、块间距 16px、统计块 28px 数字。\n   一律挂在 .hmm-root 下，shadow 与独立页都生效。\n   ============================================================ */\n.hmm-root{font-size:14px;line-height:1.6}\n.hmm-root .grid{grid-template-columns:minmax(0,1fr) 360px;gap:16px}\n.hmm-root .col-main,.hmm-root .col-side{gap:16px}\n.hmm-root .row2{gap:16px}\n.hmm-root .card{padding:20px 22px;border-radius:14px}\n.hmm-root .ch{gap:9px;margin-bottom:16px}\n.hmm-root .ch svg{width:16px;height:16px}\n.hmm-root .ch h2{font-size:15px;font-weight:650;letter-spacing:-.1px}\n.hmm-root .ch .meta{font-size:12.5px}\n\n.hmm-root .statusbar{padding:12px 16px;gap:10px;margin-bottom:16px;border-radius:12px}\n.hmm-root .sb-title{font-size:14px}\n.hmm-root .sb-sub{font-size:12.5px;line-height:1.55}\n.hmm-root .switcher{font-size:12px;gap:8px;margin-bottom:16px}\n.hmm-root .sw{padding:4px 10px;font-size:12px;border-radius:7px}\n\n.hmm-root .pills{gap:14px;margin-bottom:20px}\n.hmm-root .pill{padding:14px 18px;min-width:118px;border-radius:12px}\n.hmm-root .pill .pv{font-size:28px;line-height:1.05;letter-spacing:-.8px}\n.hmm-root .pill .pl{font-size:12.5px;margin-top:5px}\n/* 每块一个固定色，跟 dsh-context 的统计块一致：数字本身带色，零值也不发灰 */\n.hmm-root .pill.tone-blue .pv{color:var(--blue)}\n.hmm-root .pill.tone-emerald .pv{color:var(--emerald)}\n.hmm-root .pill.tone-violet .pv{color:var(--violet)}\n.hmm-root .pill.tone-amber .pv{color:var(--amber)}\n.hmm-root .pill.tone-slate .pv{color:var(--text)}\n.hmm-root .pill.dim{background:var(--pill)}\n.hmm-root .pill.dim .pv{color:#9aa4b2}\n\n.hmm-root .sect{margin-bottom:12px;gap:10px}\n.hmm-root .sect h3{font-size:13.5px}\n.hmm-root .sect .n{font-size:12.5px}\n.hmm-root .divider{margin:20px 0}\n\n.hmm-root .legend{gap:9px 22px}\n.hmm-root .li{font-size:13px;gap:8px}\n.hmm-root .li .d{width:8px;height:8px}\n.hmm-root .nb{padding:10px 0;font-size:13px;gap:10px}\n.hmm-root .nb .v{font-size:12.5px}\n\n.hmm-root .rows{margin-top:2px}\n.hmm-root .row{padding:12px 6px;font-size:13px;gap:12px}\n.hmm-root .row .cid{font-size:12px}\n.hmm-root .row .ct{font-size:12.5px}\n.hmm-root .row .ck,.hmm-root .row .chv{font-size:12px}\n\n.hmm-root .bar-row{grid-template-columns:168px 1fr 34px;gap:12px}\n.hmm-root .bar-row .bn{font-size:12px}\n.hmm-root .bar-row .bt{height:8px;border-radius:5px}\n.hmm-root .bar-row .bv{font-size:12.5px}\n\n.hmm-root .donut-wrap{gap:24px}\n.hmm-root .donut .ctr .big{font-size:24px}\n.hmm-root .donut .ctr .sm{font-size:11.5px;margin-top:2px}\n.hmm-root .donut-legend{gap:11px}\n.hmm-root .dl{font-size:13px;gap:8px}\n.hmm-root .dl .d{width:8px;height:8px}\n\n.hmm-root .dn{padding:9px 11px;min-width:84px;max-width:116px}\n.hmm-root .dn .dk{font-size:10px;margin-bottom:4px}\n.hmm-root .dn .dt{font-size:12px}\n.hmm-root .dn .do{font-size:11px;margin-top:3px}\n\n.hmm-root .evrow{padding:12px 8px;gap:10px}\n.hmm-root .evk{font-size:11px;padding:2px 8px;min-width:48px}\n.hmm-root .evd{font-size:12.5px}\n.hmm-root .evp,.hmm-root .evt{font-size:11.5px}\n.hmm-root .evi{font-size:12px}\n.hmm-root .evfoot{font-size:12px;padding-top:12px}\n\n.hmm-root .chips{gap:8px;margin-bottom:14px}\n.hmm-root .chip{font-size:12.5px;padding:5px 10px;border-radius:8px}\n.hmm-root .chip .n{font-size:11px}\n\n.hmm-root .kv{padding:9px 0;font-size:13px;gap:10px}\n.hmm-root .kv .k{min-width:82px}\n.hmm-root .kv .v{font-size:12.5px}\n.hmm-root .about{font-size:13px;line-height:1.85}\n.hmm-root .about code{font-size:11.5px}\n.hmm-root .note{margin-top:12px;padding:12px 14px;font-size:12.5px;line-height:1.8;border-radius:10px}\n.hmm-root .empty{padding:26px 6px;font-size:13px;line-height:1.8}\n.hmm-root .empty-c{padding:30px 12px;font-size:13px;line-height:1.8}\n\n.hmm-root .axis{font-size:11.5px;margin-top:9px}\n/* 没有数据时不要把空图框撑着：只留一行说明 */\n.hmm-root .chart.is-empty svg{display:none}\n.hmm-root .chart.is-empty{margin-top:0}\n.hmm-root .chart.is-empty .axis{justify-content:center;font-size:13px;padding:26px 0;margin-top:0}\n.hmm-root .cd-k{font-size:10.5px;margin-bottom:5px}\n.hmm-root .cd-kv{font-size:11.5px;padding:4px 0;gap:10px}\n.hmm-root .cd-kv .kk{min-width:126px}\n.hmm-root .cd-grid{gap:12px}\n.hmm-root .cd.open{padding:4px 12px 18px}\n.hmm-root .seg button{font-size:12px;padding:5px 11px}\n\n.hmm-root .src{font-size:11px;padding:2px 7px;max-width:300px}\n.hmm-root .prov{padding:10px 0}\n.hmm-root .prov-k{font-size:12.5px;margin-bottom:3px}\n/* 只在放不下时才断词，优先在空格处换行，长标识符不会被切成两截 */\n.hmm-root .prov-v{font-size:11.5px;line-height:1.65;word-break:normal;overflow-wrap:break-word}\n\n@container (max-width:980px){\n  .hmm-root .grid{grid-template-columns:minmax(0,1fr)}\n  .hmm-root .col-side{flex-direction:row;flex-wrap:wrap}\n  .hmm-root .col-side>.card{flex:1 1 300px}\n}\n@container (max-width:760px){\n  .hmm-root .row2{grid-template-columns:1fr}\n}\n";
	// view.js
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
	const PHASE = {
		A: {
			name: "未激活",
			title: "未激活",
			sub: "插件已启用，但本次会话尚未产出合格动作库。这不是故障。",
			btn: "什么样的任务会触发？",
			target: "about"
		},
		B: {
			name: "已授权未命中",
			title: "已授权 · 等待命中",
			sub: "已记录动作库，但还没有一次守卫命中。",
			btn: "查看动作库",
			target: "bankCard"
		},
		C: {
			name: "正在复用",
			title: "正在复用",
			sub: "守卫已命中并真实执行，证书已签发。",
			btn: "查看证书",
			target: "certCard"
		}
	};
	const EV_KIND = {
		author: {
			label: "授权",
			fg: "#92400e",
			bg: "#fffbeb",
			bd: "#fde68a",
			dot: "var(--amber)",
			icon: "+"
		},
		admit: {
			label: "准入",
			fg: "#5b21b6",
			bg: "#f5f3ff",
			bd: "#ddd6fe",
			dot: "var(--violet)",
			icon: "→"
		},
		substitute: {
			label: "替换",
			fg: "#065f46",
			bg: "#ecfdf5",
			bd: "#a7f3d0",
			dot: "var(--emerald)",
			icon: "✓"
		},
		reject: {
			label: "拒绝",
			fg: "#991b1b",
			bg: "#fef2f2",
			bd: "#fecaca",
			dot: "var(--red)",
			icon: "✗"
		},
		defer: {
			label: "延迟",
			fg: "#475569",
			bg: "#f8fafc",
			bd: "#e2e8f0",
			dot: "var(--slate)",
			icon: "⏸"
		}
	};
	const REASON_COLOR = {
		guard_false: "var(--red)",
		dependency_missing: "var(--orange)",
		ambiguous_eligible: "var(--amber)",
		required_field_missing: "var(--violet)",
		native_error: "var(--slate)",
		invalid_guard: "var(--pink)",
		non_json_receipt: "var(--cyan)",
		missing_receipt: "var(--blue)",
		public_bytes_exceeded: "var(--teal)"
	};
	const GUARD_COLOR = {
		return_code: "var(--emerald)",
		stdout_contains: "var(--blue)",
		stdout_equals: "var(--cyan)",
		stderr_empty: "var(--teal)",
		json_equals: "var(--violet)"
	};
	const PALETTE = [
		"var(--emerald)",
		"var(--blue)",
		"var(--amber)",
		"var(--violet)",
		"var(--pink)",
		"var(--cyan)",
		"var(--orange)",
		"var(--teal)",
		"var(--slate)",
		"var(--red)"
	];
	const TONE_COLOR = {
		ok: "var(--emerald)",
		warn: "var(--amber)",
		bad: "var(--red)",
		info: "var(--blue)",
		muted: "var(--slate)"
	};
	/** 工具名 → 请求类型（展示用归类，图例 title 里写明原始工具名）。 */
	const KIND_GROUPS = [
		["文件读取", [
			"read",
			"read_file",
			"cat",
			"view",
			"head",
			"tail"
		]],
		["命令执行", [
			"pwsh",
			"terminal",
			"bash",
			"shell",
			"exec",
			"run",
			"npm"
		]],
		["搜索", [
			"grep",
			"glob",
			"search",
			"find",
			"rg"
		]],
		["编辑写入", [
			"edit",
			"write",
			"apply_patch",
			"patch",
			"multi_edit"
		]],
		["网络", [
			"web_fetch",
			"web_search",
			"fetch",
			"browser"
		]]
	];
	const esc = (value) => String(value === null || value === void 0 ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	const num = (value) => Number.isFinite(value) ? value : 0;
	const asArray = (value) => Array.isArray(value) ? value : [];
	const obj = (value) => value !== null && typeof value === "object" ? value : {};
	function pretty(value, limit = 2400) {
		if (value === null || value === void 0) return "—";
		let text;
		try {
			text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
		} catch (error) {
			text = String(value);
		}
		if (typeof text !== "string") return "—";
		return text.length > limit ? `${text.slice(0, limit)}\n…（已截断，共 ${text.length} 字符，完整内容见审计日志）` : text;
	}
	function clockOf(at) {
		if (typeof at !== "string" || at === "") return "—";
		const date = new Date(at);
		if (Number.isNaN(date.getTime())) return at;
		return date.toLocaleTimeString("zh-CN", { hour12: false });
	}
	function agoOf(at, now) {
		if (typeof at !== "string" || at === "") return null;
		const date = new Date(at);
		if (Number.isNaN(date.getTime())) return null;
		const seconds = Math.max(0, Math.round((now - date.getTime()) / 1e3));
		if (seconds < 60) return `${seconds} 秒前`;
		if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前`;
		return `${Math.round(seconds / 3600)} 小时前`;
	}
	function guardText(guard) {
		const value = obj(guard);
		const keys = Object.keys(value);
		if (keys.length === 0) return "—";
		return keys.map((key) => `${key}=${JSON.stringify(value[key])}`).join(" · ");
	}
	function kindOf(tool) {
		const name = String(tool ?? "").toLowerCase();
		for (const [kind, names] of KIND_GROUPS) if (names.some((candidate) => name === candidate || name.startsWith(`${candidate}_`))) return kind;
		return "其他";
	}
	function groupKinds(tools) {
		const map = /* @__PURE__ */ new Map();
		for (const item of tools) {
			const kind = kindOf(item.name);
			const bucket = map.get(kind) ?? {
				name: kind,
				count: 0,
				tools: []
			};
			bucket.count += num(item.count);
			bucket.tools.push(`${item.name} ×${item.count}`);
			map.set(kind, bucket);
		}
		return [...map.values()].sort((left, right) => right.count - left.count);
	}
	const cardHead = (icon, title, meta, source) => `
  <header class="ch">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
    <h2>${title}</h2>
    ${meta === "" ? "" : `<span class="meta">${meta}</span>`}
    ${source === "" ? "" : `<span class="src" title="${esc(source.title)}">源 ${esc(source.label)}</span>`}
  </header>`;
	const ICONS = {
		chart: "<path d=\"M3 3v18h18\"/><path d=\"m19 9-5 5-4-4-3 3\"/>",
		info: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 8v5\"/><path d=\"M12 16h.01\"/>",
		shield: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/>",
		grid: "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/>",
		cert: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		trend: "<path d=\"M3 3v18h18\"/><path d=\"m7 14 4-4 4 3 5-6\"/>",
		pulse: "<path d=\"M22 12h-4l-3 9L9 3l-3 9H2\"/>",
		bulb: "<path d=\"M9 18h6\"/><path d=\"M10 22h4\"/><path d=\"M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z\"/>"
	};
	const SCOPE_CSS = `
.sb-scope{
  font-family:inherit;font-size:11.5px;padding:5px 11px;border-radius:999px;
  border:1px solid var(--border);background:var(--pill);color:var(--muted);
  cursor:pointer;transition:all .15s;white-space:nowrap;
}
.sb-scope:hover{background:var(--hover);color:var(--text)}
.sb-scope[data-scope="session"]{background:var(--card);color:var(--text);border-color:var(--emerald)}
.sb-scope[data-scope="session"]::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--emerald);margin-right:6px;vertical-align:1px}
`;
	const SKELETON = `
<div class="hmm-root">
  <div class="switcher" id="phasebar"></div>

  <div class="statusbar" id="statusbar" data-s="A">
    <span class="sb-dot"></span>
    <span class="sb-title" id="sbTitle">—</span>
    <span class="sb-sub" id="sbSub">正在读取插件状态…</span>
    <button class="sb-scope" id="sbScope" type="button" title="切换统计口径：本会话 / 全部会话">本会话</button>
    <button class="sb-btn" id="sbBtn" type="button">—</button>
  </div>

  <div class="grid">
    <div class="col-main">

      <section class="card" id="statCard">
        ${cardHead(ICONS.chart, "决策复用统计", "<span id=\"statMeta\">本会话</span>", {
		label: "index.js:counters",
		title: "本会话计数来自 index.js:sessionCounters，切到「全部会话」时改用 index.js:counters。随 DSH 进程重启归零；守卫命中率由 substitutions / (substitutions + deferrals + uncertified) 计算。"
	})}
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
          ${cardHead(ICONS.info, "为什么没命中", "<b id=\"rejTotal\">0</b> 次拒绝", {
		label: "pre-admission.rejected[]",
		title: "admissions 中 gdr/pre-admission 事件的 rejected[].reason 逐条计数。"
	})}
          <div class="bars" id="bars"></div>
        </section>

        <section class="card" id="guardCard">
          ${cardHead(ICONS.shield, "守卫字段使用分布", "<b id=\"guardTotal\">0</b> 个守卫", {
		label: "certificate.guard",
		title: "统计证书里 guard 对象实际使用的字段；只统计已经命中的证书。"
	})}
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
          ${cardHead(ICONS.grid, "当前动作库", "链深 <b id=\"bankDepth\">—</b>", {
		label: "controller.sessions[*].banks",
		title: "engine.js 里 GuardedReuseController 的 banks（Map<sha256, bank>）。链深按候选依赖图从 root 起算。"
	})}
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
          ${cardHead(ICONS.cert, "替换证书", "<b id=\"certTotal\">0</b> 条", {
		label: "admissions:substitution-certificate",
		title: "admissions 中 kind === 'gdr/substitution-certificate' 的事件；展开可看到原生回执原文与 sha256 证明。"
	})}
          <div class="rows" id="certRows"><div class="empty-c">暂无证书<br>证书只在守卫命中且动作真实执行后才签发</div></div>
        </section>
      </div>

      <section class="card" id="trendCard">
        ${cardHead(ICONS.trend, "决策复用趋势", "", {
		label: "certificates[*].steps_after",
		title: "横轴是证书里的真实步号（steps_after），不是估算的时间桶。"
	})}
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
        ${cardHead(ICONS.pulse, "决策复用事件", "<b id=\"evTotal\">0</b> 条 <span id=\"evSource\">· 审计日志同步</span>", {
		label: "admissions",
		title: "admissions 环形缓冲（上限 2000 条，超出后丢弃最旧记录）。完整记录另见 harnessmm-audit.jsonl。"
	})}
        <div class="chips" id="evChips"></div>
        <div class="events" id="evRows"></div>
        <div class="evfoot" id="evFoot"></div>
      </section>

    </div>

    <div class="col-side">
      <section class="card" id="metaCard">
        ${cardHead(ICONS.info, "插件信息", "", "")}
        <div class="kv"><span class="k">插件</span><span class="v">harnessmm-dsh</span></div>
        <div class="kv"><span class="k">策略</span><span class="v" id="metaPolicy">—</span></div>
        <div class="kv"><span class="k">上限</span><span class="v" id="metaLimit">—</span></div>
        <div class="kv"><span class="k">最小链深</span><span class="v" id="metaChain">—</span></div>
        <div class="kv"><span class="k">运行</span><span class="v" id="metaUptime">—</span></div>
        <div class="kv"><span class="k">审计</span><span class="v" id="metaAudit" style="font-size:10.5px">—</span></div>
      </section>

      <section class="card" id="provCard">
        ${cardHead(ICONS.cert, "数据溯源", "", "")}
        <p class="about" style="margin-bottom:8px;font-size:11.5px;color:var(--muted)">
          面板上每个数字都能追到下面这一行；悬停可看完整路径。
        </p>
        <div id="provList"></div>
      </section>

      <section class="card">
        ${cardHead(ICONS.shield, "这个插件在做什么", "", "")}
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
        ${cardHead(ICONS.bulb, "什么样的任务会触发", "", "")}        <div class="sect" style="margin-bottom:6px"><h3 style="font-size:12px;color:var(--emerald)">适合</h3></div>
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
	/**
	* 在 host 上挂一个面板，返回 { render(snapshot), destroy() }。
	* 重复 render 同一份快照是幂等的；不同快照才会重绘。
	*/
	function createPanel(host, options = {}) {
		const shadow = options.shadow !== false && typeof host.attachShadow === "function";
		const root = shadow ? host.shadowRoot ?? host.attachShadow({ mode: "open" }) : host;
		root.innerHTML = `${shadow ? `<style>${PANEL_CSS}${SCOPE_CSS}</style>` : ""}${SKELETON}`;
		const scope = root.querySelector(".hmm-root");
		const byId = (id) => root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
		const el = {
			phasebar: byId("phasebar"),
			statusbar: byId("statusbar"),
			sbTitle: byId("sbTitle"),
			sbSub: byId("sbSub"),
			sbScope: byId("sbScope"),
			statMeta: byId("statMeta"),
			sbBtn: byId("sbBtn"),
			toolTotal: byId("toolTotal"),
			toolLegend: byId("toolLegend"),
			kindTotal: byId("kindTotal"),
			kindLegend: byId("kindLegend"),
			notable: byId("notable"),
			rejTotal: byId("rejTotal"),
			bars: byId("bars"),
			guardTotal: byId("guardTotal"),
			donutSegs: byId("donutSegs"),
			donutBig: byId("donutBig"),
			donutLegend: byId("donutLegend"),
			bankDepth: byId("bankDepth"),
			dag: byId("dag"),
			dagLines: byId("dagLines"),
			dagNodes: byId("dagNodes"),
			certTotal: byId("certTotal"),
			certRows: byId("certRows"),
			chart: byId("chart"),
			tip: byId("tip"),
			guide: byId("guide"),
			hoverDot: byId("hoverDot"),
			trendLine: byId("trendLine"),
			trendArea: byId("trendArea"),
			trendDots: byId("trendDots"),
			trendAxis: byId("trendAxis"),
			evTotal: byId("evTotal"),
			evSource: byId("evSource"),
			evChips: byId("evChips"),
			evRows: byId("evRows"),
			evFoot: byId("evFoot"),
			metaPolicy: byId("metaPolicy"),
			metaLimit: byId("metaLimit"),
			metaChain: byId("metaChain"),
			metaUptime: byId("metaUptime"),
			metaAudit: byId("metaAudit"),
			provList: byId("provList")
		};
		for (const key of Object.keys(el)) {
			const node = el[key];
			if (node !== null && typeof node === "object" && "innerHTML" in node) el[key] = lazyHTML(node);
		}
		const state = {
			filter: "all",
			open: /* @__PURE__ */ new Set(),
			trend: null,
			signature: "",
			data: null
		};
		el.certRows.addEventListener("click", (event) => {
			const row = event.target.closest ? event.target.closest("[data-cert]") : null;
			if (row === null) return;
			const key = row.dataset.cert;
			const detail = byId(`cd-${key}`);
			if (detail === null) return;
			const open = detail.classList.toggle("open");
			row.classList.toggle("open", open);
			if (open) state.open.add(key);
			else state.open.delete(key);
		});
		el.evRows.addEventListener("click", (event) => {
			const row = event.target.closest ? event.target.closest(".evrow.linkable") : null;
			if (row === null) return;
			const key = row.dataset.cert;
			const block = byId(`cert-${key}`);
			if (block === null) return;
			const detail = byId(`cd-${key}`);
			const head = block.querySelector(".row");
			if (detail !== null && !detail.classList.contains("open")) {
				detail.classList.add("open");
				if (head !== null) head.classList.add("open");
				state.open.add(key);
			}
			block.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			block.classList.remove("flash");
			block.offsetWidth;
			block.classList.add("flash");
			setTimeout(() => block.classList.remove("flash"), 2e3);
		});
		el.evChips.addEventListener("click", (event) => {
			const chip = event.target.closest ? event.target.closest("[data-f]") : null;
			if (chip === null) return;
			state.filter = chip.dataset.f;
			if (state.data !== null) {
				renderChips(state.data);
				renderEvents(state.data);
			}
		});
		el.sbScope.addEventListener("click", () => {
			const next = state.data?.scope === "session" ? "all" : "session";
			if (typeof options.onScopeChange === "function") options.onScopeChange(next);
		});
		el.sbBtn.addEventListener("click", () => {
			const phase = PHASE[state.data?.phase] ?? PHASE.A;
			const target = byId(phase.target);
			if (target !== null) target.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
		});
		const hideTip = () => {
			el.tip.classList.remove("on");
			el.guide.classList.remove("on");
			el.hoverDot.setAttribute("opacity", "0");
		};
		el.chart.addEventListener("mousemove", (event) => {
			const trend = state.trend;
			if (trend === null || trend.cumulative.length === 0) return;
			const rect = el.trendLine.ownerSVGElement.getBoundingClientRect();
			const rel = (event.clientX - rect.left) / rect.width;
			if (rel < -.02 || rel > 1.02) {
				hideTip();
				return;
			}
			const values = trend.cumulative;
			const index = Math.max(0, Math.min(values.length - 1, Math.round(rel * (values.length - 1))));
			const max = Math.max(1, ...values);
			const x = index / (values.length - 1) * 820;
			const y = 160 - values[index] / max * 152;
			el.guide.setAttribute("x1", x);
			el.guide.setAttribute("x2", x);
			el.guide.classList.add("on");
			el.hoverDot.setAttribute("cx", x);
			el.hoverDot.setAttribute("cy", y);
			el.hoverDot.setAttribute("opacity", "1");
			const step = trend.steps[index] ?? index + 1;
			el.tip.innerHTML = `<div class="th">第 ${esc(step)} 步</div><div class="tv"><span>本步跳过</span><b>${esc(trend.delta[index] ?? 0)} 次</b></div><div class="tv"><span>累计</span><b>${esc(values[index])} 次</b></div>`;
			el.tip.classList.add("on");
			const chartRect = el.chart.getBoundingClientRect();
			el.tip.style.left = `${rect.left - chartRect.left + x / 820 * rect.width}px`;
			el.tip.style.top = `${rect.top - chartRect.top + y / 168 * rect.height}px`;
		});
		el.chart.addEventListener("mouseleave", hideTip);
		function renderPhase(data) {
			const phase = data.phase === "B" || data.phase === "C" ? data.phase : "A";
			const info = PHASE[phase];
			el.statusbar.dataset.s = data.offline === void 0 ? phase : "A";
			el.sbTitle.textContent = data.offline === void 0 ? info.title : "读取失败";
			el.sbBtn.textContent = data.offline === void 0 ? info.btn : "什么样的任务会触发？";
			if (data.offline !== void 0) el.sbSub.textContent = `无法读取 /plugins/harnessmm/status：${data.offline}（宿主插件可能未启动或路由未注册）`;
			const scoped = data.scope === "session";
			const short = obj(data.session).short;
			const scopeLabel = scoped ? short === void 0 || short === null ? "本会话" : `本会话 · ${short}` : "全部会话";
			el.sbScope.textContent = scopeLabel;
			el.sbScope.dataset.scope = scoped ? "session" : "all";
			el.sbScope.title = scoped ? "只统计当前这个对话；点击切换为全部会话" : "统计全部对话；点击切换回本会话";
			el.statMeta.textContent = scopeLabel;
			const counters = obj(obj(data.status).counters);
			const banks = asArray(data.banks);
			const certs = asArray(data.certificates);
			const rate = obj(data.diagnostics).guardHitRate;
			const last = obj(data.diagnostics).lastGuardFailure;
			const parts = [];
			const subject = scoped ? "本次会话" : "全部会话累计";
			if (phase === "C") {
				parts.push(`${subject}已跳过 ${num(counters.substitutions)} 次推理请求`);
				parts.push(`守卫命中率 ${rate === null || rate === void 0 ? "—" : `${rate}%`}`);
				const ago = agoOf(certs.length > 0 ? certs[certs.length - 1].at : null, Date.now());
				if (ago !== null) parts.push(`最近一次 ${ago}`);
			} else if (phase === "B") {
				const depths = asArray(obj(data.diagnostics).bankChainDepths).filter((depth) => depth > 0);
				parts.push(`已记录 ${banks.length} 个动作库${depths.length > 0 ? `（链深 ${depths.join(" / ")}）` : ""}`);
				parts.push("当前 0 次替换");
				if (last !== null) {
					const reasons = asArray(last.reasons).map((item) => item.reason).join("、");
					parts.push(`最近一次守卫未命中：${reasons === "" ? "未知原因" : reasons}`);
				} else parts.push("尚未出现守卫求值");
			} else {
				parts.push(`${subject}已记录 ${num(counters.requests)} 次推理请求`);
				parts.push("0 个合格动作库");
				parts.push("这不是故障：探索性任务本来就不该被复用");
			}
			if (data.offline === void 0) el.sbSub.textContent = parts.join(" · ");
			if (data.offline === void 0 && data.loading === true) el.sbSub.textContent = scoped ? "正在读取本会话…" : "正在读取全部会话…";
			if (data.offline === void 0 && scoped && obj(data.session).known === false) {
				el.statusbar.dataset.s = "A";
				el.sbSub.textContent = `本会话还没有被插件记录（宿主会话 ${short ?? "未知"}）。新建对话、还没发过消息时就是这种状态。`;
			}
			el.phasebar.innerHTML = "<span>当前状态：</span>" + [
				"A",
				"B",
				"C"
			].map((key) => {
				return `<button class="sw ${key === phase ? "cur" : "idle"}" type="button" title="${esc(key === "A" ? "未激活：没有动作库" : key === "B" ? "已授权未命中：有动作库但没有一次守卫命中" : "正在复用：守卫已命中并真实执行")}" data-phase="${key}">${key} · ${esc(PHASE[key].name)}</button>`;
			}).join("") + "<span style=\"margin-left:6px\">由真实计数器推导</span>";
		}
		function renderPills(data) {
			const counters = obj(obj(data.status).counters);
			const depths = asArray(obj(data.diagnostics).bankChainDepths).filter((depth) => depth > 0);
			const depth = depths.length === 0 ? null : Math.round(depths.reduce((sum, item) => sum + item, 0) / depths.length * 10) / 10;
			const rate = obj(data.diagnostics).guardHitRate;
			const rows = [
				[
					"v1",
					"p1",
					"blue",
					num(counters.substitutions),
					false
				],
				[
					"v2",
					"p2",
					"emerald",
					num(counters.certificates),
					false
				],
				[
					"v3",
					"p3",
					"violet",
					asArray(data.banks).length,
					false
				],
				[
					"v4",
					"p4",
					"slate",
					depth === null ? "—" : depth,
					depth === null
				],
				[
					"v5",
					"p5",
					"amber",
					rate === null || rate === void 0 ? "—" : `${rate}%`,
					rate === null || rate === void 0
				]
			];
			for (const [valueId, pillId, tone, value, dim] of rows) {
				const valueEl = byId(valueId);
				const pillEl = byId(pillId);
				if (valueEl === null || pillEl === null) continue;
				valueEl.textContent = String(value);
				pillEl.className = dim ? "pill dim" : `pill tone-${tone}`;
			}
		}
		function renderLegend(target, total, items, emptyText) {
			const totalEl = byId(total);
			if (totalEl !== null) totalEl.textContent = String(items.reduce((sum, item) => sum + item.count, 0));
			target.innerHTML = items.length === 0 ? `<span class="li" style="color:var(--dim)">${esc(emptyText)}</span>` : items.map((item, index) => `<span class="li"${item.tools ? ` title="${esc(item.tools.join("、"))}"` : ""}><span class="d" style="background:${PALETTE[index % PALETTE.length]}"></span>${esc(item.name)} <b>${esc(item.count)}</b></span>`).join("");
		}
		function renderNotable(data) {
			const items = asArray(obj(data.diagnostics).notable);
			el.notable.innerHTML = items.length === 0 ? "<div class=\"empty\" style=\"padding:10px\">暂无异常</div>" : items.map((item) => `<div class="nb"><span class="d" style="background:${TONE_COLOR[item.tone] ?? "var(--slate)"}"></span><span class="k">${esc(item.key)}</span><span class="v">${esc(item.value)}${item.note ? ` <em>${esc(item.note)}</em>` : ""}</span></div>`).join("");
		}
		function renderBars(data) {
			const rejection = asArray(obj(data.diagnostics).rejection).filter((item) => num(item.count) > 0).sort((left, right) => right.count - left.count);
			const total = asArray(obj(data.provenance).rejection ? [obj(data.provenance).rejection] : []).map((item) => num(item.total))[0] ?? rejection.reduce((sum, item) => sum + num(item.count), 0);
			el.rejTotal.textContent = String(total);
			if (rejection.length === 0) {
				el.bars.innerHTML = "<div class=\"empty-c\">还没有守卫拒绝记录<br>守卫全部通过时这里保持为空</div>";
				return;
			}
			const max = Math.max(1, ...rejection.map((item) => num(item.count)));
			el.bars.innerHTML = rejection.map((item) => {
				const value = num(item.count);
				const pct = value / max * 100;
				const color = REASON_COLOR[item.reason] ?? "var(--slate)";
				return `<div class="bar-row"><span class="bn" title="${esc(item.reason)}">${esc(item.reason)}</span><div class="bt"><div class="bf" style="width:${pct.toFixed(1)}%;background:${color}"></div></div><span class="bv${value ? " hot" : ""}">${value}</span></div>`;
			}).join("");
		}
		function renderDonut(data) {
			const fields = asArray(obj(data.distributions).guardFields);
			const total = fields.reduce((sum, item) => sum + num(item.count), 0);
			el.guardTotal.textContent = String(total);
			el.donutBig.textContent = String(total);
			const radius = 52;
			const circumference = 2 * Math.PI * radius;
			let offset = 0;
			let segments = "";
			let legend = "";
			for (const item of fields) {
				const value = num(item.count);
				const share = total === 0 ? 0 : value / total;
				const length = share * circumference;
				const color = GUARD_COLOR[item.field] ?? "var(--slate)";
				if (length > 0) segments += `<circle cx="66" cy="66" r="${radius}" fill="none" stroke="${color}" stroke-width="15" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 66 66)" style="transition:all .5s ease"/>`;
				offset += length;
				legend += `<div class="dl"><span class="d" style="background:${color}"></span><span class="nm">${esc(item.field)}</span><span class="pc">${total === 0 ? 0 : Math.round(share * 100)}%</span></div>`;
			}
			el.donutSegs.innerHTML = segments;
			el.donutLegend.innerHTML = legend;
		}
		function renderDag(data) {
			const bank = asArray(data.banks).filter((bank) => asArray(bank.candidates).length > 0).slice().sort((left, right) => num(right.chainDepth) - num(left.chainDepth))[0];
			el.bankDepth.textContent = bank === void 0 ? "—" : String(num(bank.chainDepth));
			if (bank === void 0) {
				el.dagNodes.innerHTML = "<div class=\"empty-c\" style=\"position:absolute;inset:0\">尚未记录动作库<br>模型写出合格 CHISEL_PLAN 后出现</div>";
				el.dagLines.innerHTML = "";
				return;
			}
			const candidates = asArray(bank.candidates).slice(0, 8);
			const byId2 = /* @__PURE__ */ new Map();
			const nodes = [{
				id: "root",
				label: "root",
				tool: bank.root?.name ?? "root",
				after: null,
				status: "done"
			}];
			for (const candidate of candidates) nodes.push({
				id: String(candidate.id ?? "?"),
				label: `候选 ${candidate.id ?? "?"}`,
				tool: String(candidate.tool ?? ""),
				after: candidate.after === null || candidate.after === void 0 ? "root" : String(candidate.after),
				status: num(obj(data.status).counters.substitutions) > 0 ? "hit" : "run"
			});
			for (const node of nodes) byId2.set(node.id, node);
			const depthOf = /* @__PURE__ */ new Map([["root", 0]]);
			for (let pass = 0; pass < nodes.length; pass += 1) for (const node of nodes) {
				if (node.id === "root") continue;
				const parent = depthOf.get(node.after);
				if (parent === void 0) continue;
				depthOf.set(node.id, Math.max(depthOf.get(node.id) ?? 0, parent + 1));
			}
			const maxDepth = Math.max(1, ...depthOf.values());
			const rows = /* @__PURE__ */ new Map();
			for (const node of nodes) {
				const depth = depthOf.get(node.id) ?? 0;
				const bucket = rows.get(depth) ?? [];
				bucket.push(node);
				rows.set(depth, bucket);
			}
			const available = el.dag.clientWidth || 440;
			const spacing = Math.max(80, Math.min(118, (available - 96) / Math.max(1, maxDepth)));
			const canvasWidth = Math.max(available, 62 + maxDepth * spacing + 62);
			const canvasHeight = 196;
			const placed = [];
			for (const [depth, bucket] of [...rows.entries()].sort((left, right) => left[0] - right[0])) bucket.forEach((node, index) => {
				const x = 62 + depth * spacing;
				const y = bucket.length === 1 ? 98 : 34 + index / (bucket.length - 1) * 128;
				placed.push({
					...node,
					x,
					y
				});
			});
			const placedById = new Map(placed.map((node) => [node.id, node]));
			const hit = num(obj(data.status).counters.substitutions) > 0;
			const edges = placed.filter((node) => node.id !== "root").map((node) => {
				const from = placedById.get(node.after) ?? placedById.get("root");
				if (from === void 0) return "";
				const mid = (from.x + node.x) / 2;
				return `<path d="M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${node.y}, ${node.x} ${node.y}" fill="none" stroke="${hit ? "rgba(16,185,129,.45)" : "rgba(148,163,184,.4)"}" stroke-width="1"/>`;
			}).join("");
			el.dagLines.innerHTML = "";
			el.dagNodes.innerHTML = `<div class="dag-canvas" style="width:${canvasWidth}px;height:${canvasHeight}px"><svg class="lines" viewBox="0 0 ${canvasWidth} ${canvasHeight}" preserveAspectRatio="none">${edges}</svg>` + placed.map((node) => `<div class="dn" data-st="${node.status}" style="left:${node.x}px;top:${node.y}px"><span class="dk">${esc(node.label)}</span><span class="dt">${esc(node.tool)}</span><span class="do">${esc(node.id === "root" ? "已执行" : `after ${node.after}`)}</span></div>`).join("") + "</div>";
		}
		function renderCerts(data) {
			const certificates = asArray(data.certificates).slice().reverse();
			el.certTotal.textContent = String(certificates.length);
			if (certificates.length === 0) {
				el.certRows.innerHTML = "<div class=\"empty-c\">暂无证书<br>证书只在守卫命中且动作真实执行后才签发</div>";
				return;
			}
			el.certRows.innerHTML = certificates.map((certificate, index) => {
				const key = `${certificate.candidateId ?? "?"}-${certificates.length - index}`;
				const open = state.open.has(key);
				const proof = [
					["native_receipt_sha256", certificate.receiptSha256 ?? "—"],
					["bank_sha256", certificate.bankSha256 ?? "—"],
					["call_id", certificate.callId ?? "—"],
					["steps", `${num(certificate.stepsBefore)} → ${num(certificate.stepsAfter)}`],
					["valid_substitution", certificate.validSubstitution ? "true" : "false"],
					["is_error", certificate.isError ? "true" : "false"],
					["at", certificate.at ?? "—"],
					["session", certificate.session ?? "—"]
				].map(([label, value]) => `<div class="cd-kv"><span class="kk">${esc(label)}</span><span class="vv${label === "valid_substitution" && certificate.validSubstitution ? " ok" : ""}">${esc(value)}</span></div>`).join("");
				return `<div class="cert-block" id="cert-${esc(key)}">
        <div class="row${open ? " open" : ""}" data-cert="${esc(key)}">
          <span class="ck">✓</span>
          <span class="cid">${esc(certificate.candidateId ?? "?")}</span>
          <span class="ct">${esc(certificate.tool ?? "—")}</span>
          <span class="cg">${esc(guardText(certificate.guard))}</span>
          <span class="chv">›</span>
        </div>
        <div class="cd${open ? " open" : ""}" id="cd-${esc(key)}">
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
			}).join("");
		}
		function renderTrend(data) {
			const trend = obj(data.trend);
			const values = asArray(trend.cumulative);
			state.trend = {
				steps: asArray(trend.steps),
				cumulative: values,
				delta: asArray(trend.delta)
			};
			hideTip();
			if (values.length === 0) {
				el.chart.classList.add("is-empty");
				el.trendLine.setAttribute("d", "");
				el.trendArea.setAttribute("d", "");
				el.trendDots.innerHTML = "";
				el.trendAxis.innerHTML = "<span style=\"color:var(--dim)\">还没有替换发生，趋势为空</span>";
				return;
			}
			el.chart.classList.remove("is-empty");
			const max = Math.max(1, ...values);
			const stepX = values.length === 1 ? 0 : 820 / (values.length - 1);
			const points = values.map((value, index) => [index * stepX, 160 - value / max * 152]);
			const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
			el.trendLine.setAttribute("d", line);
			el.trendArea.setAttribute("d", `${line} L 820 168 L 0 168 Z`);
			el.trendDots.innerHTML = points.map(([x, y], index) => values[index] === 0 ? "" : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#fff" stroke="#10b981" stroke-width="1.6"/>`).join("");
			const steps = asArray(trend.steps);
			const picks = [
				0,
				Math.floor((steps.length - 1) / 3),
				Math.floor((steps.length - 1) * 2 / 3),
				steps.length - 1
			];
			el.trendAxis.innerHTML = picks.map((index) => `<span>第 ${esc(steps[index] ?? index + 1)} 步</span>`).join("");
		}
		function renderChips(data) {
			const counts = obj(obj(data.events).counts);
			const defs = [
				[
					"all",
					"全部",
					null,
					num(obj(data.events).total)
				],
				[
					"author",
					"授权",
					EV_KIND.author.dot,
					num(counts.author)
				],
				[
					"admit",
					"准入",
					EV_KIND.admit.dot,
					num(counts.admit)
				],
				[
					"substitute",
					"替换",
					EV_KIND.substitute.dot,
					num(counts.substitute)
				],
				[
					"reject",
					"拒绝",
					EV_KIND.reject.dot,
					num(counts.reject)
				],
				[
					"defer",
					"延迟",
					EV_KIND.defer.dot,
					num(counts.defer)
				]
			];
			el.evChips.innerHTML = defs.map(([key, label, dot, count]) => `<button class="chip${state.filter === key ? " on" : ""}" type="button" data-f="${key}">${dot ? `<span class="dt" style="background:${dot}"></span>` : ""}${esc(label)}<span class="n">${esc(count)}</span></button>`).join("");
		}
		/** 一条 gdr 事件 → 一行人话 + 关联证书 key。 */
		function describeEvent(event) {
			const raw = obj(event.raw);
			const kind = event.class ?? "";
			if (kind === "substitute") {
				const candidate = raw.candidate_id ?? "?";
				const tool = raw.exact_native_tool ?? "—";
				const guard = guardText(raw.guard);
				return {
					text: `候选 ${candidate} · ${tool}${guard === "—" ? "" : ` · ${guard}`}`,
					cert: `${candidate}-`
				};
			}
			if (kind === "admit") {
				const rejected = asArray(raw.rejected);
				if (rejected.length === 0) return {
					text: `root 回执 · ${num(raw.eligible_count) || asArray(raw.eligible).length} 候选合格`,
					cert: null
				};
				return {
					text: `${rejected.map((item) => item.reason).filter((item) => typeof item === "string").join("、") || "未命中"} · ${rejected.length} 候选不合格`,
					cert: null
				};
			}
			if (kind === "author") {
				const depth = num(raw.chain_depth) || num(raw.depth);
				const candidates = asArray(raw.candidates).length || num(raw.candidate_count);
				return {
					text: `动作库 · 链深 ${depth || "—"} · ${candidates || "—"} 候选${raw.reason ? ` · ${raw.reason}` : ""}`,
					cert: null
				};
			}
			if (kind === "reject") return {
				text: raw.reason ? `未认证执行 · ${raw.reason}` : "未认证执行",
				cert: null
			};
			if (kind === "defer") return {
				text: raw.reason ? `歧义延迟 · ${raw.reason}` : "歧义延迟 · 交还模型",
				cert: null
			};
			return {
				text: String(raw.kind ?? "未知事件"),
				cert: null
			};
		}
		function renderEvents(data) {
			const events = asArray(obj(data.events).recent);
			const total = num(obj(data.events).total);
			el.evTotal.textContent = String(total);
			const rehydrated = num(obj(data.status).rehydrated);
			if (el.evSource !== null && el.evSource !== void 0) el.evSource.textContent = rehydrated > 0 ? `· 含启动恢复 ${rehydrated} 条` : "· 审计日志同步";
			const rows = (state.filter === "all" ? events : events.filter((event) => event.class === state.filter)).slice(-200).reverse();
			if (rows.length === 0) {
				el.evRows.innerHTML = "<div class=\"empty-c\">暂无事件<br>模型第一次进入决策点后开始记录</div>";
				el.evFoot.textContent = "";
				return;
			}
			const certKeys = asArray(data.certificates).slice().reverse().map((certificate, index) => `${certificate.candidateId ?? "?"}-${asArray(data.certificates).length - index}`);
			el.evRows.innerHTML = rows.map((event) => {
				const kind = EV_KIND[event.class] ?? {
					label: "事件",
					fg: "var(--muted)",
					bg: "var(--pill)",
					bd: "var(--border)",
					dot: "var(--slate)",
					icon: "·"
				};
				const described = describeEvent(event);
				let certKey = null;
				if (described.cert !== null) certKey = certKeys.find((key) => key.startsWith(described.cert)) ?? null;
				const session = event.session === null || event.session === void 0 ? "—" : String(event.session);
				const position = session.length > 6 ? `…${session.slice(-6)}` : session;
				return `<div class="evrow${certKey === null ? "" : " linkable"}"${certKey === null ? "" : ` data-cert="${esc(certKey)}"`}><span class="evi" style="color:${kind.dot}">${kind.icon}</span><span class="evk" style="color:${kind.fg};background:${kind.bg};border:1px solid ${kind.bd}">${esc(kind.label)}</span><span class="evd">${esc(described.text)}</span><span class="evp">${esc(position)}</span><span class="evt">${esc(clockOf(event.at))}</span>${certKey === null ? "" : "<span class=\"evgo\">跳转 ›</span>"}</div>`;
			}).join("");
			el.evFoot.textContent = rows.length < total ? `显示最近 ${rows.length} 条 / 共 ${total} 条 · 完整记录见审计日志` : `共 ${total} 条 · 完整记录见审计日志`;
		}
		function renderMeta(data) {
			const status = obj(data.status);
			const policy = obj(status.policy);
			const audit = obj(obj(data.provenance).audit);
			el.metaPolicy.textContent = policy.version === void 0 ? "—" : `policy v${policy.version}`;
			el.metaLimit.textContent = `${num(policy.maximum_candidates) || "—"} 候选 · ${num(policy.maximum_fast_steps) || "—"} 步`;
			el.metaChain.textContent = String(num(status.minimumChain));
			const uptime = num(status.uptimeSeconds);
			el.metaUptime.textContent = uptime < 60 ? `${uptime} 秒` : uptime < 3600 ? `${Math.round(uptime / 60)} 分钟` : `${Math.round(uptime / 3600)} 小时`;
			const path = typeof audit.path === "string" ? audit.path : "";
			el.metaAudit.textContent = path === "" ? "—" : path.split(/[\\/]/).pop();
			el.metaAudit.setAttribute("title", path);
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
				[
					"跳过推理 / 证书",
					counters.source,
					counters.note
				],
				[
					"替换证书",
					obj(prov.certificates).source,
					null
				],
				[
					"当前动作库",
					obj(prov.banks).source,
					null
				],
				[
					"为什么没命中",
					rejection.source,
					null
				],
				[
					"趋势",
					trend.source,
					null
				],
				[
					"事件",
					admissions.source === void 0 ? null : `${admissions.source}（${num(admissions.count)}/${num(admissions.capacity)}）`,
					null
				],
				[
					"审计日志",
					typeof audit.path === "string" ? audit.path : null,
					null
				]
			].filter(([, value]) => typeof value === "string" && value !== "");
			el.provList.innerHTML = rows.map(([label, value, note]) => `<div class="prov"><div class="prov-k">${esc(label)}</div><div class="prov-v" title="${esc(note === null ? value : `${value} · ${note}`)}">${esc(value)}</div></div>`).join("");
		}
		function render(data) {
			state.data = data;
			renderPhase(data);
			renderPills(data);
			renderLegend(el.toolLegend, "toolTotal", asArray(obj(data.distributions).tools), "尚无替换发生");
			renderLegend(el.kindLegend, "kindTotal", groupKinds(asArray(obj(data.distributions).tools)), "尚无替换发生");
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
				else host.innerHTML = "";
			}
		};
	}
	/**
	* 「内容没变就不写 DOM」。
	*
	* render() 每次都会把 13 个区块全部重建，而轮询是 2 秒一次、侧栏和对话页签各一份。
	* 推理期间 `requests` 每走一步就 +1，指纹一变就整块重写 innerHTML —— 结果是面板
	* 一直在闪、鼠标悬停被打断、事件列表的滚动位置也丢。
	*
	* 这里给每个区块节点套一层 innerHTML 代理：值完全相同就跳过，一个字节都不写。
	* 值变了照旧覆盖，行为与原来一致。
	*/
	function lazyHTML(node) {
		if (node === null || node === void 0) return node;
		let last;
		let primed = false;
		return new Proxy(node, {
			/**
			* 原生 DOM 方法对 `this` 做品牌检查（brand check），必须把方法绑回真节点。
			* 不绑的话 `el.evRows.addEventListener(...)` 里的 this 是 Proxy，会抛
			* `Illegal invocation` —— createPanel 在绑定事件时当场炸掉，面板只剩骨架屏，
			* 而且错误写进 host.textContent 会被 shadow root 挡住，用户什么都看不到。
			* 这个 get 陷阱就是为此存在的。
			*/
			get(target, prop) {
				const value = target[prop];
				return typeof value === "function" ? value.bind(target) : value;
			},
			set(target, prop, value) {
				if (prop === "innerHTML") {
					if (primed && last === value) return true;
					last = value;
					primed = true;
				}
				target[prop] = value;
				return true;
			}
		});
	}
	/**
	* 快照指纹：用来判断「这份快照值得重绘吗」。
	*
	* 不能直接比响应原文 —— `generatedAt` 每次都是新的毫秒时间戳，
	* `status.uptimeSeconds` 每轮询一次就 +2，文本永远不同，于是每 2 秒全量重绘一次
	* （整个事件表 + DAG canvas 重建），既费 CPU 又会打断鼠标悬停。
	*
	* 所以指纹里剔掉 `generatedAt`，并把 `uptimeSeconds` 按分钟取整：
	* 运行时长仍然会更新，但最多一分钟一次。
	*/
	function signatureOf(snapshot) {
		if (snapshot === null || typeof snapshot !== "object") return String(snapshot);
		const { generatedAt, ...rest } = snapshot;
		const status = rest.status ?? {};
		const uptime = Math.floor((Number(status.uptimeSeconds) || 0) / 60);
		return JSON.stringify({
			...rest,
			status: {
				...status,
				uptimeSeconds: uptime
			}
		});
	}
	/**
	* 轮询 /plugins/harnessmm/status，把每份新快照交给面板。
	* 指纹没变就不重绘（见 signatureOf），避免无谓的整块重建。
	*
	* `options.sessionId` 存在时只取那一个对话的账；不存在时是全局视图。
	*/
	function pollStatus(panel, options = {}) {
		const base = options.url ?? "/plugins/harnessmm/status";
		const sessionId = typeof options.sessionId === "string" && options.sessionId !== "" ? options.sessionId : null;
		const url = sessionId === null ? base : `${base}?session=${encodeURIComponent(sessionId)}`;
		const interval = options.interval ?? 2e3;
		let signature = "";
		let stopped = false;
		let timer = null;
		const tick = async () => {
			try {
				const response = await fetch(url, {
					cache: "no-store",
					credentials: "same-origin",
					headers: { accept: "application/json" }
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const text = await response.text();
				if (stopped) return;
				const data = JSON.parse(text);
				const next = signatureOf(data);
				if (next !== signature) {
					signature = next;
					panel.render(data);
				}
			} catch (error) {
				if (stopped) return;
				const message = String(error?.message ?? error);
				if (`offline:${message}` !== signature) {
					signature = `offline:${message}`;
					try {
						panel.render(offline(message));
					} catch (renderError) {
						console.error("[harnessmm] 面板渲染失败", renderError);
					}
				}
			} finally {
				if (!stopped) timer = setTimeout(tick, interval);
			}
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
			schema: "harnessmm-panel/offline",
			phase: "A",
			offline: reason,
			provenance: { audit: { path: null } },
			status: {
				counters: {},
				policy: {},
				minimumChain: 0,
				uptimeSeconds: 0,
				sessions: 0,
				pendingActions: 0
			},
			diagnostics: {
				rejection: [],
				notable: [],
				bankChainDepths: [],
				guardHitRate: null,
				lastGuardFailure: null
			},
			banks: [],
			certificates: [],
			distributions: {
				tools: [],
				sessions: [],
				guardFields: []
			},
			trend: {
				steps: [],
				cumulative: [],
				delta: []
			},
			events: {
				total: 0,
				counts: {},
				recent: []
			}
		};
	}
	/**
	* 切换会话时的占位快照：结构齐全、数字清零，只说明「正在读取」。
	*
	* 用它先把上一个对话的数字擦掉，否则切过去会看到别人的账 —— 那正是这一版
	* 要修的问题。复用 offline() 的骨架，保证任何渲染分支都不会读到 undefined。
	*/
	function blankSnapshot(sessionId = null) {
		const base = offline("正在读取…");
		delete base.offline;
		base.schema = "harnessmm-panel/blank";
		base.loading = true;
		base.scope = sessionId === null ? "all" : "session";
		base.session = sessionId === null ? null : {
			id: sessionId,
			short: String(sessionId).slice(0, 8),
			known: true
		};
		base.knownSessions = [];
		base.status.counters = {
			requests: 0,
			substitutions: 0,
			certificates: 0,
			uncertified: 0,
			banksAuthored: 0,
			banksRejected: 0,
			deferrals: 0,
			invalidBanks: 0
		};
		return base;
	}
	// client-src.js
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
	const TAB_ID = "harnessmm-dsh";
	const TAB_KIND = "harnessmm";
	const VIEW_ID = "harnessmm";
	const VIEW_ORDER = 40;
	/** 宿主 require，由 build-client.mjs 在外层工厂函数里注入。 */
	const hostRequire = typeof __hmmRequire === "function" ? __hmmRequire : null;
	const React = (() => {
		if (hostRequire === null) return null;
		try {
			return hostRequire("react");
		} catch (error) {
			console.error("[harnessmm] require(\"react\") 失败", error);
			return null;
		}
	})();
	/** 挂载实例与共享轮询（引用计数 + 一份最新快照）。 */
	const mounts = /* @__PURE__ */ new Map();
	const panels = /* @__PURE__ */ new Set();
	let stopPolling = null;
	/** 只回放给同一个口径的快照，避免把上一个对话的账画到新面板上。 */
	let lastSnapshot = null;
	/** 'session' 跟随当前对话；'all' 统计全部对话。 */
	let scopeMode = readStoredScope();
	/** 当前打开的对话 id，由 uiSession 服务提供。 */
	let currentSessionId = null;
	const SCOPE_KEY = "harnessmm.scope";
	function readStoredScope() {
		try {
			return globalThis.localStorage?.getItem(SCOPE_KEY) === "all" ? "all" : "session";
		} catch {
			return "session";
		}
	}
	function storeScope(mode) {
		try {
			globalThis.localStorage?.setItem(SCOPE_KEY, mode);
		} catch {}
	}
	/** 当前请求口径：跟会话时带 id，全部会话时不带。 */
	function activeSessionId() {
		return scopeMode === "session" ? currentSessionId : null;
	}
	const ROOT_STYLE = {
		display: "block",
		width: "100%",
		height: "100%",
		minHeight: "520px",
		overflow: "auto",
		background: "transparent"
	};
	function broadcast(snapshot) {
		lastSnapshot = {
			sessionId: activeSessionId(),
			snapshot
		};
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
		const next = mode === "all" ? "all" : "session";
		if (next === scopeMode) return;
		scopeMode = next;
		storeScope(next);
		restartPolling();
	}
	function acquirePolling(panel) {
		panels.add(panel);
		if (stopPolling === null) restartPolling();
		if (lastSnapshot !== null && lastSnapshot.sessionId === activeSessionId()) panel.render(lastSnapshot.snapshot);
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
		while (element !== null && element !== void 0 && depth < 16) {
			if (element.scrollHeight > element.clientHeight + 4 && element.scrollTop > 0) element.scrollTop = 0;
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
			console.error("[harnessmm] 面板挂载失败", error);
			const message = `HarnessMM 面板挂载失败：${error && error.message ? error.message : String(error)}`;
			const target = host.shadowRoot ?? host;
			const box = document.createElement("div");
			box.style.cssText = "padding:18px;font:13px/1.7 system-ui,sans-serif;color:#b4232c;white-space:pre-wrap";
			box.textContent = message;
			target.replaceChildren(box);
			return;
		}
		const entry = {
			panel,
			release: acquirePolling(panel),
			observer: null
		};
		mounts.set(host, entry);
		resetScroll(host);
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resetScroll(host));
		setTimeout(() => resetScroll(host), 250);
		if (typeof IntersectionObserver === "function") {
			let wasVisible = false;
			const observer = new IntersectionObserver((entries) => {
				const visible = entries.some((item) => item.isIntersecting);
				if (visible && !wasVisible) resetScroll(host);
				wasVisible = visible;
			});
			observer.observe(host);
			entry.observer = observer;
		}
	}
	function unmount(host) {
		const entry = mounts.get(host);
		if (entry === void 0) return;
		mounts.delete(host);
		if (entry.observer !== null && entry.observer !== void 0) entry.observer.disconnect();
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
				return HostReact.createElement("div", {
					ref: (node) => {
						if (this.node === node) return;
						if (this.node) unmount(this.node);
						this.node = node;
						if (node) mount(node);
					},
					style: ROOT_STYLE
				});
			}
		};
	}
	const HarnessMMPanel = React === null ? function HarnessMMUnavailable() {
		return "HarnessMM：宿主没有提供 react 模块，面板无法渲染";
	} : makePanelComponent(React);
	const name = "harnessmm-panel";
	const inject = ["slots", "sidebarRightTabs"];
	function apply(ctx) {
		if (React === null) console.error("[harnessmm] 宿主没有提供 react 模块，面板无法渲染");
		ctx.effect(() => ctx.sidebarRightTabs.register({
			id: TAB_ID,
			kind: TAB_KIND,
			title: () => "HarnessMM",
			guide: [{
				id: "panel",
				order: 40,
				title: () => "HarnessMM 决策复用",
				description: () => "证书、回执与拒绝原因"
			}]
		}), "harnessmm: panel tab type");
		ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
			name: "sidebar.right.pane.tab",
			key: TAB_ID
		}, HarnessMMPanel)), "harnessmm: panel tab body");
		ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
			name: "conversation.view",
			id: VIEW_ID,
			order: VIEW_ORDER,
			label: () => "HarnessMM"
		}, HarnessMMPanel)), "harnessmm: conversation view");
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
					source = ctx.get?.("uiSession")?.current ?? null;
				} catch {
					source = null;
				}
				if (source === null || typeof source.subscribe !== "function") {
					if (tries < 80) {
						tries += 1;
						timer = setTimeout(attach, 250);
					}
					return;
				}
				const read = () => {
					let next = null;
					try {
						const key = (typeof source.getSnapshot === "function" ? source.getSnapshot() : source.value)?.key;
						next = typeof key === "string" && key !== "" ? key : null;
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
				if (typeof stop === "function") stop();
			};
		}, "harnessmm: follow current session");
	}
	exports.apply = apply;
	exports.inject = inject;
	exports.name = name;
	return exports;
})({});

var m = HarnessMMClient;
return { name: m.name, inject: m.inject, apply: m.apply };
}});
