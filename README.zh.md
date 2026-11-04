# HarnessMM 决策复用面板

给 `harnessmm-dsh` 加一个只读的可视化面板，**面板上每个数字都能追溯到插件的具体内部状态**。

---

## 1. 架构

```
┌─────────────────────────────────────────────────────────────┐
│  Host 进程（插件所在进程）                                    │
│                                                             │
│  index.js ──┬─ controller (GuardedReuseController)          │
│             ├─ counters   (8 个计数器)                       │
│             └─ admissions (环形缓冲，上限 2000)              │
│                    │                                        │
│                    ▼                                        │
│              snapshot.js  ← 纯函数聚合，带 provenance        │
│                    │                                        │
│              panel.js     ← 注册 3 条只读路由                │
│                    │                                        │
│         ┌──────────┼──────────┐                             │
│         ▼          ▼          ▼                             │
│   /status     /panel      /health                           │
│    (JSON)    (HTML)      (JSON)                             │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
        浏览器打开 /panel → 每 2s 拉 /status → 渲染
        或 DSH 右侧栏 tab（client.js 内嵌 iframe）
```

**关键取舍**：面板本体是 Host 直接提供的完整 HTML 页面，不是浏览器侧重写的 UI。这样：

- 面板可以**独立在浏览器打开**（新标签页），不依赖 DSH 客户端环境
- 客户端 bundle 只需一个 `<iframe>`，浏览器侧不可测的表面积压到最小
- UI 与数据格式在 Host 侧就能完整测试

---

## 2. 数据溯源对照表

面板上每个数字的出处，代码里也逐项写进了快照的 `provenance` 字段。

| 面板显示 | 数据来源 | 代码位置 | 生命周期 |
|---|---|---|---|
| **拦截请求** | `counters.requests` | `index.js` `llm/stream` 边界计数 | 进程重启归零 |
| **跳过推理** | `counters.substitutions` | 同上，替换分支计数 | 进程重启归零 |
| **签发证书** | `counters.certificates` | `record()` 收到 `gdr/substitution-certificate` | 进程重启归零 |
| **动作库** | `counters.banksAuthored` | `record()` 收到 `gdr/bank-authored` 且 `admitted=true` | 进程重启归零 |
| **守卫命中率** | `substitutions / (substitutions + deferrals + uncertified)` | `snapshot.js:guardHitRate` | 同上 |
| **为什么没命中** | `admissions` 中 `gdr/pre-admission` 的 `rejected[].reason` | `snapshot.js:rejectionBreakdown` | 缓冲 2000 条 |
| **守卫字段分布** | `certificates[].guard` 的键 | `snapshot.js:guardFieldUsage` | 同上 |
| **被替换的工具** | `certificates[].exact_native_tool` | `snapshot.js:toolUsage` | 同上 |
| **按会话分布** | `certificates[].session` | `snapshot.js:sessionUsage` | 同上 |
| **动作库 DAG** | `controller.sessions[*].banks`（Map） | `snapshot.js:collectBanks` | 进程内存 |
| **替换证书** | `admissions` 中 `gdr/substitution-certificate` | `snapshot.js:collectCertificates` | 缓冲 2000 条 |
| **趋势曲线** | `certificates[].steps_after`（真实步号） | `snapshot.js:trendSeries` | 同上 |
| **事件流** | `admissions` 全量 | `snapshot.js:eventClassCounts` | 缓冲 2000 条 |
| **审计行数** | `$DSH_HOME/harnessmm-audit.jsonl` 行数 | `panel.js:countAuditLines` | 磁盘持久 |

**9 种事件 → 5 个分类**（分类表在 `snapshot.js:EVENT_CLASS`，键与插件实际记录的 `kind` 逐字对应）：

| 分类 | 包含事件 |
|---|---|
| 授权 | `gdr/bank-authored` · `gdr/bank-recovered` · `gdr/invalid-bank` |
| 准入 | `gdr/pre-admission` |
| 替换 | `gdr/compiled-native-action` · `gdr/substitution-certificate` |
| 拒绝 | `gdr/uncertified-execution` · `gdr/session-identity-mismatch` |
| 延迟 | `gdr/defer` |

---

## 3. 三态判定

面板状态完全由真实计数器推导，没有人工开关：

```js
substitutions > 0  → C 正在复用
banksAuthored > 0  → B 已授权·等待命中
否则               → A 已启用·尚未产出动作库
```

**A 态不是「全 0」**：它会显示「已拦截 N 次推理请求（M 个会话），但没有一次写出合格的 CHISEL_PLAN」。
这个数字来自 `counters.requests`，能证明插件确实在工作，避免用户误以为插件坏了。

---

## 4. 安装

### 4.1 一行安装（推荐）

在 DSH 的 **插件页 → 添加插件** 里填包名：

```
harnessmm-dsh
```

或者在终端里：

```
npm i harnessmm-dsh
```

装完重启 DSH，对话页签条会多出「决策复用」页签。

> 也可以填 GitHub 地址 `https://github.com/Xiuxiu-6/harnessmm-dsh`，装的是 main 最新代码；npm 版是稳定版。

### 4.2 手动复制（仅开发用）

把本目录下这些文件复制到
`~/.dsh/profiles/<你的 profile>/node_modules/harnessmm-dsh/`：

```
panel.js          新增
snapshot.js       新增
web-routes.js     新增
panel.html        新增
client.js         新增（已构建好，由 build-client.mjs 生成）
index.js          替换（按 INDEX-PATCH.md 改 2 行）
package.json      替换（加了 dsh.client 与 exports）
```

> `engine.js`、`cordis.patch.yml`、`locale/`、`icon.svg` **保持原样不动**。

### 4.3 改 index.js

见 [INDEX-PATCH.md](./INDEX-PATCH.md)，只需加 2 行。

### 4.4 重启

桌面端重启应用；CLI 端重启对应 profile 进程。

### 4.5 打开面板

两种方式：

**A. 独立浏览器标签页**（推荐先验证）

```
http://127.0.0.1:<你的 DSH 端口>/plugins/harnessmm/panel
```

端口看 DSH 启动时打印的 URL，或环境变量 `DSH_WEB_URL`。

**B. DSH 右侧栏 tab**

重启后右侧栏应出现「HarnessMM」tab。若未出现，见 §6 已知限制。

---

## 5. 验证

### 5.1 自动化测试（不需要装进 DSH）

```sh
node test-snapshot.mjs        # 聚合逻辑：驱动真实 engine.js 跑完整流程
node test-panel-contract.mjs  # 面板字段契约：验证 UI 读的字段都真实存在
node test-routes.mjs          # HTTP 路由：真服务器 + 真状态 + 认证围栏
node test-client.mjs          # 客户端 bundle：模拟宿主加载器
```

四套测试全部基于**已安装插件的真实 `engine.js`**，不 mock 引擎。

### 5.2 装好后手动验证

```sh
# 1. 健康检查
curl http://127.0.0.1:<port>/plugins/harnessmm/health
# → {"ok":true,"schema":"harnessmm-panel/v1","uptimeSeconds":...}

# 2. 快照（对照 harnessmm_status 工具输出，数字应一致）
curl http://127.0.0.1:<port>/plugins/harnessmm/status | head -c 600

# 3. 页面
curl -s http://127.0.0.1:<port>/plugins/harnessmm/panel | head -5
```

**交叉验证方法**：在对话里调 `harnessmm_status`，把返回的 `counters` 和面板上五颗药丸对比——应当完全一致。
面板的「数据溯源」卡片会直接列出 `admissions` 条数、缓冲容量、审计文件路径与行数。

### 5.3 安全性验证

未认证请求会被拦：

```sh
curl -i http://127.0.0.1:<port>/plugins/harnessmm/status
# 无有效 cookie 时应返回 401/403，而不是数据
```

裸 WebServer 路由**不继承** Connection 认证围栏，所以 `web-routes.js` 必须包一层。
`test-routes.mjs` 的第 4 组断言专门验证这条（401 / 403 / 503 三种情况）。

---

## 6. 已知限制（请先读）

### 6.1 已验证 vs 未验证

| 项 | 状态 |
|---|---|
| 聚合逻辑正确性 | ✅ 用真实 `engine.js` 端到端验证（60+ 断言） |
| 面板字段契约 | ✅ 两种真实快照（有数据 / 空数据）都验证 |
| HTTP 路由可用性 | ✅ 真 http 服务器 + 真状态 + 认证围栏 |
| 客户端 bundle 契约 | ✅ 模拟宿主加载器，确认注册 slot 并渲染 iframe |
| **实际装进 DSH 运行** | ❌ **未验证**（开发环境无法重启应用、无法写 profile 目录） |
| **浏览器渲染效果** | ❌ **未验证**（沙箱内无法启动浏览器） |

后两项需要你装好后实际确认。如果右侧栏 tab 没出现，优先用 §4.4 的 A 方式（独立页面）验证数据层是否正常。

### 6.2 数据生命周期

- `counters` 与 `admissions` 都在**进程内存**里，重启归零
- `admissions` 环形缓冲上限 2000 条，超出丢弃最旧
- 只有审计文件 `harnessmm-audit.jsonl` 是磁盘持久，但当前插件只在 `auditLog: true` 时写入
- 面板不读审计文件内容，只统计行数；历史数据回放不在本次范围

### 6.3 面板不做什么

- **不写任何状态**：三条路由全部只读，没有 POST
- **不折算 token 或金额**：插件本身声明「只记录确实被跳过的回调」，面板遵守这条
- **不改 `engine.js`**：聚合逻辑全在 `snapshot.js`，引擎零改动

---

## 7. 文件清单

| 文件 | 作用 | 行数 |
|---|---|---|
| `snapshot.js` | 纯函数聚合 + provenance 标注 | ~400 |
| `web-routes.js` | 认证路由包装（照抄 agent-teams 已验证实现） | ~120 |
| `panel.js` | Host 侧路由注册 + 审计行数统计 | ~160 |
| `panel.html` | 面板本体（无框架、无外部依赖） | ~900 |
| `client-src.js` | 客户端源码（iframe 嵌入） | ~45 |
| `build-client.mjs` | 构建 client.js | ~35 |
| `client.js` | 构建产物，宿主可直接加载 | 41 KB |
| `test-snapshot.mjs` | 聚合端到端测试 | ~250 |
| `test-panel-contract.mjs` | 字段契约测试 | ~220 |
| `test-routes.mjs` | HTTP 路由测试 | ~250 |
| `test-client.mjs` | 客户端契约测试 | ~90 |

---

## 8. 重新构建客户端

改了 `client-src.js` 后：

```sh
node build-client.mjs
node test-client.mjs
```

构建产物是 `window.__ModuleLoader__.load({id, factory})` 包裹的 IIFE，
格式对齐 `dsh-context@0.78.2` 的 `lib/client.js`。

---

## 9. 许可证

本面板代码沿用插件原有许可：Apache-2.0。
`web-routes.js` 的认证包装实现参照 `@nanmicoder/dsh-agent-teams`（MIT）。
