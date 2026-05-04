# 探索报告: T1.1.4 workspace 读桥 — 事实核对、同类表面与 PRD 可达性

**日期**: 2026-05-03  
**探索者**: AI Explorer  
**方法论**: 向内以仓库源码与任务/挑战文档为主；向外未检索 OpenClaw 闭源宿主实现（该部分结论保持「不可静态闭合」）。**未使用** `find-skills` 增强（本议题以契约与代码路径为主，普通检索已足）。

---

## 1. 问题与范围

**核心问题**:

1. Round 11 / CH-11 中关于「CLI 链已存在」「插件惰性装配 readModels」「与 Quiet 同类的读面」「`explain` 的 `ok: true` 不对称」等判断是否**属实**？
2. T1.1.4 方案在架构上能否支撑**预定任务目标**；进一步能否支撑 **PRD 全部目标**？

**探索范围**:

- **包含**: `src/cli` 接线、`plugin/index.ts` 各 command 载荷语义、`.anws/v5/05_TASKS.md` T1.1.4 验收边界、`.anws/v5/01_PRD.md` 与 US-001/US-006 的对应关系、CH-11 对照表与代码一致性。
- **不包含**: OpenClaw 真实 VM/沙箱策略的线上文档取证（与 CH-11-01 一致：需 INT-S4 / 宿主冒烟）。

---

## 2. 问题分解

| 子问题 | 探索方向 | 预期产出 |
|--------|:--------:|---------|
| `createCliRuntimeDeps` → `heartbeatCheck({ readModels })` → `runHeartbeatCycle` 是否存在？ | 🔍 向内 | 证实/证伪 |
| 插件上 quiet/status/report/session/credential/fallback/explain/heartbeat_check 的 `ok`/语义是否与 CH-11 表一致？ | 🔍 向内 | 证实/修正 |
| `explain` 是否仍为 `ok: true` + `evaluated: false`？ | 🔍 向内 | 证实 |
| T1.1.4 与 PRD「全部目标」的关系？ | 🧠 收敛 | 边界陈述 |

### 探索进度表

| 子问题 | 状态 | 核心发现 |
|--------|:----:|---------|
| CLI 全链 | ✅ | `heartbeat-surface.ts` 在 `readModels` 存在且 `runtimeAvailable` 时走 `createWorkspaceHeartbeatRunner` → `runHeartbeatCycle`。 |
| 同类读面语义 | ✅ | 与 CH-11 表一致；`heartbeat_check` 与 `explain` 均为「carrier 侧易误判成功」族，但结构不同。 |
| explain 不对称 | ✅ | `buildExplainPayload` 仍为 `ok: true`（见 `plugin/index.ts` 约 371–391 行）。 |
| PRD 全部目标 | ✅ | T1.1.4 只覆盖 **OpenClaw 插件 + 已知 workspace** 下的读/决策链切片，不等价于整份 PRD。 |

---

## 3. 核心洞察 (Key Insights)

1. **CLI 链属实**: `createCliRuntimeDeps` 组装 `readModels`；`createOpsRouter` 接收 `readModels`；`heartbeatCheck` 在提供 `readModels` 时创建 `createWorkspaceHeartbeatRunner` 并 `await run(signal)`，与 `src/cli/index.ts`、`src/cli/ops/heartbeat-surface.ts`、`src/cli/ops/workspace-heartbeat-runner.ts` 一致。
2. **「与 Quiet 同类、要同一套桥」属实（按读模型语义）**: 在 carrier 模式下，`quiet`/`status`/`report`/`session`/`credential` 均通过 `ok: false` + 明确 `error.code` 拒绝 persisted read；`fallback` 在 ref 齐全时走 `createUnavailableActionError`，亦为 `ok: false`。它们桥接后应对齐 CLI 的 `loadQuiet` / `loadStatus` / `loadDailyReport` / `loadSession` / `loadCredential` / `showOperatorFallback` 等（与 T1.1.4 描述及 CH-11 表一致）。
3. **`explain` 不对称属实（CH-11-02）**: 有效 subject 解析后返回 **`ok: true`**，仅用 `data.evaluated: false` 与结论文本声明非 evidence-backed；与 `status`/`quiet` 等 **`ok: false`** 不同，人类或上层逻辑若只看 `ok` 仍可能误判。
4. **`heartbeat_check` 是另一类「假成功」风险**: 当前 carrier 实现 **`ok: true`** + `status: "runtime_carrier_only"` + `livedExperienceLoopClaimed: false`（约 442–471 行）。与 `quiet` 的 `ok: false` 不同，但同样存在「未进入 US-001 决策链却被标成功」的观感；T1.1.4 桥接后应使 `readModels` 路径下结果与 `HeartbeatSurfaceResult` 一致（任务已写 `livedExperienceLoopClaimed` 与事实一致）。
5. **PRD「全部目标」≠ 仅 T1.1.4**: PRD 另含主动联系投递（G4/US-004/US-007）、连接器与 life evidence 全链等。T1.1.4 解决的是 **REQ-019 / US-001 在插件宿主内「有 workspace 却无读模型」的缺口** 及 **US-006 在插件侧的 Quiet 诚实读/失败** 等；**不**单独闭合投递能力或平台侧集成。

---

## 4. 详细发现

### 4.1 CLI 链（向外宣称的架构可行性）

**探索方式**: 🔍 源码  

**发现**:

- `createCliRuntimeDeps` 构造 `stateDb`、`observabilityDb`、`readModels`（`src/cli/index.ts` 32–45）。
- `heartbeatCheck`：`!input.readModels` 时返回 `runtime_carrier_only`；否则 `createWorkspaceHeartbeatRunner(input.readModels)` 并 `await run(signal)`，surfaceMode 为 `workspace_full_runtime`（`src/cli/ops/heartbeat-surface.ts` 98–123）。
- `createWorkspaceHeartbeatRunner` 直接委托 `runHeartbeatCycle`（`src/cli/ops/workspace-heartbeat-runner.ts` 28–36）。

**结论**: 「链在 src/ 里已经存在」——**属实**。

### 4.2 插件同类读面与载荷形状

**探索方式**: 🔍 源码（`plugin/index.ts`）

| 命令 | 当前 carrier 要点 | 与「Quiet 同族」关系 |
|------|-------------------|---------------------|
| `quiet` | `ok: false`，`QUIET_READ_SURFACE_UNAVAILABLE` | 核心对象；桥后 `loadQuiet` |
| `status` | `ok: false`，`WORKSPACE_READ_SURFACE_UNAVAILABLE` | 同族；桥后 `loadStatus` |
| `report` / `session` / `credential` | `ok: false` + 各 code | 同族；桥后应对齐 CLI loaders |
| `fallback` | ref 缺失 `ok: false`；有 ref 时 `createUnavailableActionError` → `ok: false` | 同族；桥后 `showOperatorFallback` |
| `heartbeat_check` | **`ok: true`**，`runtime_carrier_only`，`livedExperienceLoopClaimed: false` | **桥接核心**；非「拒绝读」形状，而是「_ack 成功但未跑 loop」 |
| `explain` | **`ok: true`**，`data.evaluated: false` | **语义不对称（CH-11-02）** |

**来源**: `plugin/index.ts`（`buildQuietPayload`、`buildStatusPayload`、`buildReportPayload`、`buildSessionPayload`、`buildCredentialPayload`、`buildFallbackHostSafePayload`、`buildHeartbeatCheckPayload`、`buildExplainPayload`）。

### 4.3 CH-11-01（同步 register + 惰性 import + sql.js）

**探索方式**: 🔍 头注释 + 结构  

**发现**: 文件头注释明确写：保持 `register(api)` 同步、避免模块求值时拉取含异步 sql.js 引导的 CLI/DB 图（`plugin/index.ts` 1–17）。工具路径在 `execute` 前调用 `syncWorkspaceRootFromTool`（约 829–831 行），与「env/tool_args 再装配」叙事一致。

**结论**: **无法在静态中拍死宿主 VM 是否允许惰性加载** —— 与 CH-11-01 一致；需 INT-S4 + fixture 集成测。

### 4.4 T1.1.4 与 PRD 的映射

**探索方式**: 🔍 PRD + TASKS  

**发现**:

- **US-001**（`01_PRD.md`）: Given heartbeat 调 `heartbeat_check` 且 workspace 有可读 snapshot → 必须进入 decision loop。当前插件在未桥接时**不满足** Then；T1.1.4 在根已知 + DB 可打开时**意图上闭合**该缺口（与任务描述一致）。
- **US-006**（Quiet）: 插件侧原先 carrier 拒绝；T1.1.4 要求根已知时真实 Quiet 或诚实失败 —— **对齐**。
- **G4 / US-004 / US-007**（投递、宿主会话能力）: 不依赖 T1.1.4 单独完成；仍依赖 delivery 路径与 OpenClaw 能力验证。

**结论**: 方案能达成 **T1.1.4 所写验收与 REQ-019 在插件+workspace 组合下的子目标**；**不能**仅凭此项声称「PRD 全部目标已达成」。

---

## 5. 创意/方案清单（收敛项）

| 方案 | 创新性 | 可行性 | 影响力 | 推荐度 |
|------|:------:|:------:|:------:|:------:|
| 根已知时惰性 `import()` 打包 runtime + 装配 `createCliRuntimeDeps`（或等价窄入口） | ★★ | ★★★ | ★★★ | ⭐ 与任务默认一致 |
| Plan B：子进程调 workspace CLI | ★ | ★★★ | ★★ | ⭐ 沙箱失败时 |
| 将 `explain` / 未桥接时 `heartbeat_check` 的 `ok` 与 `status` 同构收敛 | ★ | ★★★ | ★★ | ⭐ CH-11-02 与可读性 |

---

## 6. 行动建议

| 优先级 | 建议 | 理由 |
|:------:|------|------|
| P0 | `/forge` 实现 T1.1.4 时保留 **fixture 集成测** + **INT-S4 根已知** 证据 | 闭合 CH-11-01 |
| P0 | 验收显式包含：**根已知** → `explainSurfaceSubject`；**根 unknown** → 与 status 同构拒绝或 `ok: false`（写死一种） | CH-11-02 |
| P1 | 评估是否将 **未桥接的 `heartbeat_check`** 的顶层 `ok` 与「是否声称完成 loop」在文档中一并说明，避免只修 explain | 减少另一类误判 |
| P2 | 在 release readiness 中区分「读桥闭合」与「投递/平台闭环」检查项 | 避免里程碑语义混淆 |

---

## 7. 局限性与待探索

- 未对 OpenClaw 官方文档做 2026 年最新版次的外网检索；宿主行为以 **项目内 INT-S4 指南 + 冒烟** 为准。
- `audit` 在插件路由仍为 `notImplemented`（`plugin/index.ts` 546–548）— **不在** 用户所列「与 Quiet 同表」内；若未来要 parity，需单独任务。
- 本次**未使用** skill harvesting；若需 UX/契约评审清单，可再跑 `find-skills` 或 `code-reviewer` 作补充。

---

## 8. 参考来源

1. `plugin/index.ts`（插件 command 载荷与 register 注释）
2. `src/cli/index.ts`（`createCliRuntimeDeps`）
3. `src/cli/ops/heartbeat-surface.ts`（`heartbeatCheck`）
4. `src/cli/ops/workspace-heartbeat-runner.ts`（`runHeartbeatCycle` 委托）
5. `.anws/v5/05_TASKS.md`（T1.1.4 验收）
6. `.anws/v5/07_CHALLENGE_REPORT.md`（Round 11 / CH-11-01 / CH-11-02）
7. `.anws/v5/01_PRD.md`（US-001、US-006、G4、宿主约束）
