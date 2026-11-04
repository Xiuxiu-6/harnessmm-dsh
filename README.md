# dsh-plugin-harnessmm

**Guarded decision reuse for the DeepSeek Harness.** The model writes down already-decided
tool actions once; when the previous tool result satisfies the guard it wrote for them,
those actions run through the native tools **without another reasoning request**.

> This is a derivative work of [HarnessMM](https://github.com/YuhuaJiang2002/HarnessMM)
> by Yuhua Jiang (Apache-2.0). See [Provenance](#provenance) — the attribution is not
> boilerplate. This plugin re-implements one part of that research codebase for a general
> harness, and it does **not** inherit its benchmark claims.

---

## The problem

An agent loop pays a full model request before every tool call, even when the model already
knows exactly what the next three calls are:

```
step 1  request → "read a.ts, then b.ts, then run the tests"   ← pays once
step 2  request → "ok, read a.ts"                               ← pays again, said nothing new
step 3  request → "ok, read b.ts"                               ← pays again
step 4  request → "ok, run the tests"                           ← pays again
```

Steps 2–4 are not decisions. They are the model re-deriving something it already decided.

## What this plugin does

```
slow actor (one request, already paid for)
  ├─ visible text: <CHISEL_PLAN>{candidates:[...]}</CHISEL_PLAN>
  └─ one native tool call                        ← the "root"
        │
        ▼  real tool result (the receipt)
  guard checked deterministically against the receipt
        │
        ├─ holds  → run the stored action through the SAME native tool
        │           no model request at all  →  certificate
        └─ else   → the slow actor runs normally
```

Three moments:

| Moment | Boundary | What happens |
| --- | --- | --- |
| **Author** | `llm/stream` | After the model answers, its `<CHISEL_PLAN>` bank is validated against the live tool catalog and recorded. |
| **Substitute** | `llm/stream` | If exactly one stored action's guard holds, the request is answered with that exact tool call and **no model call happens**. |
| **Certify** | `tools/post-execute` | The action runs through the original tool definition; a certificate is recorded only after the real result is in hand. |

Anything else — no bank, failed guard, ambiguous successors, graph exhausted, a native
error, a non-conversation request, or the plugin disabled — calls `next()` unchanged, so
the harness behaves exactly as it would without the plugin.

## The decision-reuse panel

The plugin ships a read-only observability panel. Nothing to install separately, nothing
to configure — restart the harness and it is there.

**Two ways to open it:**

1. **Right sidebar tab** — a `HarnessMM` tab in the conversation's right sidebar.
2. **Standalone page** — open `http://127.0.0.1:<your dsh port>/plugins/harnessmm/panel`
   in any browser tab. Useful when you want the panel full-width, or when the sidebar is
   not available.

**What it shows, and where each number comes from:**

| Panel figure | Source in this plugin |
| --- | --- |
| Requests intercepted | `counters.requests`, incremented at the `llm/stream` boundary |
| Reasoning skipped | `counters.substitutions` |
| Certificates issued | `counters.certificates`, from `gdr/substitution-certificate` records |
| Action banks | `counters.banksAuthored` |
| Guard hit rate | `substitutions / (substitutions + deferrals + uncertified)` |
| Why nothing matched | `rejected[].reason` inside `gdr/pre-admission` records |
| Guard field mix | keys of `certificates[].guard` |
| Tools replaced | `certificates[].exact_native_tool` |
| Action-bank DAG | `GuardedReuseController.sessions[*].banks` |
| Substitution certificates | `gdr/substitution-certificate` records |
| Trend curve | `certificates[].steps_after` — real step numbers, not estimates |
| Event stream | the full admissions ring buffer |
| Audit trail | line count of `$DSH_HOME/harnessmm-audit.jsonl` |

The panel carries a **Data provenance** card that prints these sources live, so any figure
on screen can be traced back to the field it came from. Every number is read-only: the
three routes are `GET` only and never mutate plugin state.

**Three states, derived from real counters — there is no manual switch:**

```
substitutions > 0  → "Reusing"            (value being delivered)
banksAuthored > 0  → "Armed · Awaiting Match"  (banks exist, guards not holding)
otherwise          → "Enabled · no bank yet"
```

The third state is deliberately not "all zeros": it reports how many requests were
intercepted, because that number is what proves the plugin is running. A session where the
model never authors a valid `<CHISEL_PLAN>` shows normal behaviour, and the panel says so
explicitly instead of looking broken.

**Routes:**

| Route | Returns |
| --- | --- |
| `GET /plugins/harnessmm/status` | the full snapshot as JSON (`harnessmm-panel/v1`) |
| `GET /plugins/harnessmm/panel` | the panel page (self-contained HTML, no external assets) |
| `GET /plugins/harnessmm/health` | `{ ok, schema, uptimeSeconds }` |

All three sit behind the harness's own authentication fence: an unauthenticated request
gets `401`/`403`, and a disposing Connection gets `503`. Bare web-server routes do not
inherit that fence on their own, so the panel registers through an authenticated wrapper.

**Honest boundary:** the panel reports counts, never token or cost savings. The certificate
records one actually bypassed reasoning callback, and the panel says exactly that — it does
not convert that into a claimed saving.

## Why a substitution is safe

- **Literal only.** A candidate must validate against the live JSON Schema of the tool it
  names. Placeholders, unknown tools and repeated roots are rejected.
- **Receipt-guarded.** A guard is a conjunction of `return_code`, `stdout_contains`,
  `stdout_equals`, `stderr_empty`, or `json_equals`, checked against the immediate native
  receipt. Semantic guards ("the code is correct") are not expressible.
- **No guessing.** Two eligible successors defer to the model instead of picking one.
- **Nothing is claimed.** A certificate records one actually bypassed reasoning callback —
  not an estimate of counterfactual token savings.
- **The request is never rewritten.** The plan tag stays in the conversation as ordinary
  assistant text, so every request remains a pure function of the durable session log.
- **No extra model call, ever.** There is no selector model. A request is either answered
  from an already-decided action or it is not answered by this plugin at all.

## Install

```sh
dsh plugin --profile <your-profile> add github:Xiuxiu-6/harnessmm-dsh
```

Or install the local directory:

```sh
dsh plugin --profile <your-profile> add /path/to/harnessmm-dsh
```

Requires Node.js ≥ 22 and DeepSeek Harness ≥ 0.2.1-rc.1.

## Configuration

Set these under the `harnessmm-guarded-reuse` row in your profile's `cordis.patch.yml`:

```yaml
- id: harnessmm-guarded-reuse
  name: 'dsh-plugin-harnessmm'
  config:
    enabled: true
    minimumChain: 2
```

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Master switch; `false` passes everything through. |
| `minimumChain` | integer 1–16 | `2` | Literal future callbacks a bank needs before it may replace reasoning. |
| `maximumCandidates` | integer 1–16 | `16` | Largest bank the model may author (A–P). |
| `maximumFastSteps` | integer 1–16 | `8` | Consecutive substitutions before control returns to the model. |
| `injectPlanInstruction` | boolean | `true` | Add the authorship instruction to the system prompt. |
| `auditLog` | boolean | `true` | Append a JSONL audit trail to `$DSH_HOME/harnessmm-audit.jsonl`. |

## Checking that it works

The plugin registers two tools:

- **`harnessmm_status`** — counters for substitutions, certificates, authored and rejected
  banks, deferrals, and pending actions.
- **`harnessmm_receipts`** — what ran through which tool, with exact arguments, guard, and
  native receipt hash.

Empty counters on a new session are normal: they stay at zero until the model authors a
bank whose guard holds.

**When it helps:** long, repetitive, well-specified work — many known file reads, edit →
compile → test cycles, batch checkouts. **When it does nothing:** exploration, debugging
where each step depends on the previous output, and any task where the model cannot name
three literal next actions in advance. A session that never authors an eligible bank simply
sees normal behaviour.

## What this plugin does not do

- It does not choose tools for you, judge your code, or decide when a task is done.
- It does not compress, summarize, or rewrite your conversation.
- It does not call a model of its own.
- It makes no claim about measured token savings in your session. The published HarnessMM
  benchmark numbers are for its research harness, not for this plugin — no number here has
  been reproduced against this integration.

## Provenance

Derived from **[HarnessMM: Recursive Self-Improvement for Harness Token
Efficiency](https://github.com/YuhuaJiang2002/HarnessMM)** by Yuhua Jiang, Chang Xu,
Feifei Gao and Li Zhao — [arXiv:2610.32813](https://arxiv.org/abs/2610.32813).

```
@misc{jiang2026harnessmmrecursiveselfimprovementharness,
  title={HarnessMM: Recursive Self-Improvement for Harness Token Efficiency},
  author={Yuhua Jiang and Chang Xu and Feifei Gao and Li Zhao},
  year={2026},
  eprint={2610.32813},
  archivePrefix={arXiv},
  primaryClass={cs.AI},
  url={https://arxiv.org/abs/2610.32813},
}
```

This plugin ports the **Guarded Decision Reuse (GDR)** and **Certified Callback
Substitution (CCS)** contracts from the upstream modules
`integrations/deepseek_harness/sar_v2.mjs` and `cot_jev.mjs` (the `ExecutableSubdag`
controller and its v6 authored-bank contract). It is not the upstream repository and does
not include its Python research runners, benchmark controllers, RSI loops or datasets.
The precise list of changes is in [NOTICE](NOTICE). If you use this plugin, please cite
the original paper above.

If you want the research code itself — benchmarks, controllers, reproduction scripts —
go to [the upstream repository](https://github.com/YuhuaJiang2002/HarnessMM).

## Development

```sh
npm test     # 26 tests: engine contract + Host wiring
npm run check
```

The tests drive the plugin with a minimal Context and a real waterfall dispatcher; they make
no model calls. `Config` is a Schemastery schema because the Loader validates through
`Config['~standard'].validate()`. Since `@deepseek-ai/schemastery` ships inside the harness
rather than on npm, `npm test` registers `tests/register-vendor.mjs` to resolve the vendored
copy in `.vendor-tools/` (test-only; never part of the published package).

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
HarnessMM is Copyright 2026 PhiAgent-0 contributors.

---

## 中文说明

**DeepSeek Harness 的守卫式决策复用插件。** 模型一次性写下已经决定好的后续工具动作；当上一个工具的真实结果满足模型自己写的守卫条件时，这些动作直接通过原生工具执行，**不再发起一次推理请求**。

三种情形：**授权**（模型回答后，动作库被校验并记录）、**替换**（恰好一个动作的守卫命中，该请求不再发给模型，直接执行）、**签发证书**（动作经由原生工具跑完并拿到真实结果后，才记录一条替换证书）。

其余情况——没有动作库、守卫不命中、有歧义、图已耗尽、原生报错、非对话请求、插件关闭——一律原样交给 `next()`，行为与未安装本插件完全一致。

**决策复用面板：** 插件自带一个只读观测面板，无需额外安装、无需配置，重启后即出现。

两种打开方式：

1. **右侧栏 tab** —— 会话右侧栏多一个 `HarnessMM` tab。
2. **独立页面** —— 浏览器打开 `http://127.0.0.1:<你的 dsh 端口>/plugins/harnessmm/panel`。想要全宽查看、或侧栏不可用时用这个。

面板显示五颗指标药丸（拦截请求 / 跳过推理 / 签发证书 / 动作库 / 守卫命中率）、拒绝原因分布、守卫字段环形图、动作库候选 DAG、可展开的替换证书、累计趋势曲线，以及完整事件流。

**每个数字都可溯源：** 面板右侧有「数据溯源」卡片，实时列出每个数字来自哪个字段——
`counters`（拦截/跳过/证书/动作库）、`admissions` 中 `gdr/pre-admission` 的 `rejected[].reason`（拒绝分布）、
`controller.sessions[*].banks`（动作库）、`gdr/substitution-certificate`（证书）、
`certificates[].steps_after`（趋势，真实步号而非估算）、`harnessmm-audit.jsonl` 行数（审计）。

三条路由全部只读（仅 `GET`），且都走宿主的认证围栏：未认证返回 `401`/`403`，Connection 正在销毁返回 `503`。

**三态由真实计数器推导，没有手动开关：** `substitutions > 0` 是「正在复用」；`banksAuthored > 0` 是「已授权·等待命中」；否则是「已启用·尚未产出动作库」。第三种状态刻意不显示「全 0」，而是报告拦截了多少次请求——因为这个数字才证明插件在工作。

**诚实边界：** 面板只报次数，不折算 token、不估算金额。证书记录的是「一次确实被跳过的推理回调」，面板就这么写。

**替换为什么安全：** 每个候选动作都必须通过其所声明工具在线 JSON Schema 的校验；守卫只能是 `return_code` / `stdout_contains` / `stdout_equals` / `stderr_empty` / `json_equals` 的合取，对「上一条原生结果」做确定性判断，"代码写对了"这类语义守卫无法表达；两个候选同时合格时不猜，交还模型；证书只记录「确实被跳过的一次推理回调」，绝不声称节省了多少 token；请求内容从不被改写。

**安装：**

```sh
dsh plugin --profile <你的 profile> add github:Xiuxiu-6/harnessmm-dsh
```

**什么时候有用：** 长程、重复、规格明确的任务——大量已知文件读取、编辑→编译→测试循环、批量 checkout。
**什么时候没用：** 探索性任务、每步都依赖上一步输出的调试、以及模型无法提前写出三个字面动作的任务。没有产出合格动作库的会话，表现与平时完全一样。

配置项与英文部分一致（`enabled` / `minimumChain` / `maximumCandidates` / `maximumFastSteps` / `injectPlanInstruction` / `auditLog`），写入 profile 的 `cordis.patch.yml` 即可。

用 `harnessmm_status` 查看计数器，用 `harnessmm_receipts` 查看替换证书。新会话计数器为 0 是正常的。

**来源：** 本插件改编自 [HarnessMM](https://github.com/YuhuaJiang2002/HarnessMM)（作者 Yuhua Jiang、Chang Xu、Feifei Gao、Li Zhao，[arXiv:2610.32813](https://arxiv.org/abs/2610.32813)，Copyright 2026 PhiAgent-0 contributors，Apache-2.0），移植了其中的守卫式决策复用（GDR）与认证回调替换（CCS）契约。本插件**不是**上游仓库，也不包含其 Python 研究代码、基准控制器、RSI 循环与数据集；具体改动清单见 [NOTICE](NOTICE)。使用本插件请引用原论文。

本项目采用 Apache-2.0 许可证。
