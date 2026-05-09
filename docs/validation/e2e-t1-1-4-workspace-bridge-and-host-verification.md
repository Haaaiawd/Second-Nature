# E2E Verification — T1.1.4 workspace 读桥 + 宿主诚实边界

> 按 `.cursor/skills/e2e-testing-guide/SKILL.md` 撰写。  
> **读者**：第一次在 **OpenClaw（或等价宿主）** 里验收 Second Nature 插件的操作者；以及要在 **本仓库** 跑回归的开发者。  
> **不编造结果**：下列表格中 **Step 结果 / 旅程结果 / Evidence** 在实机或 CI 执行前留空或填「待执行」。

---

## E2E Verification

### Scope

- **PRD / 需求来源**: `.anws/v5/01_PRD.md` US-001（heartbeat 进入可读 snapshot 时的决策链）、US-006（Quiet 诚实边界）；`.anws/v5/05_TASKS.md` **T1.1.4**、**INT-S4**；`.anws/v5/07_CHALLENGE_REPORT.md` Round 11–13（CH-11-01 / 已闭合 CH-11-02、CH-13）。
- **Target**: 已构建的 `**second-nature` OpenClaw 插件**（`pnpm build:plugin` 产物）+ 可选本地 fixture workspace。
- **Environment**:  
  - **A — 仓库内**：Node 与 `pnpm`，无 OpenClaw 亦可跑 **自动化契约子集**（不等价 INT-S4）。  
  - **B — 真实宿主**：已安装本仓库对应版本插件的 **OpenClaw**（或你们锁定的目标宿主）；能设置进程环境变量或工具参数 `workspaceRoot`。
- **Browser / Viewport（计划）**: 不适用 Web UI；「读屏」= **读宿主返回的 JSON / transcript**，证据为 **原始 JSON 文本或截图**。
- **User Role**: workspace **owner / 操作者**（能设 `SECOND_NATURE_WORKSPACE_ROOT` 或在工具里传路径）。
- **Build / Commit**: *执行前填写当前 `git rev-parse HEAD` 与 `pnpm build:plugin` 是否已跑。*

### PRD traceability (RTM)


| PRD ref   | Summary                                                  | Priority | Journeys                        |
| --------- | -------------------------------------------------------- | -------- | ------------------------------- |
| US-001    | `heartbeat_check` 在可读 workspace 下进入决策链（非仅 carrier ack）   | P0       | J-HOST-02, J-REPO-01            |
| US-006    | Quiet 不冒充已评估读模型；carrier 诚实                               | P1       | J-HOST-01, J-REPO-01            |
| T1.1.4 验收 | 根 `env`/`tool_args` 桥接 CLI 等价读路径；根 `unknown` 维持 CH-10 诚实 | P0       | J-REPO-01, J-HOST-02, J-HOST-03 |
| INT-S4    | 真实宿主冒烟 + 证据；**AUTO 停条件**：无宿主证据不勾选里程碑                     | P0       | J-HOST-01～J-HOST-04             |


### Surface coverage


| 功能面 / 入口                                               | 如何发现                                     | Journey              | PRD ref          | Notes                                                                |
| ------------------------------------------------------ | ---------------------------------------- | -------------------- | ---------------- | -------------------------------------------------------------------- |
| `second_nature_ops` 工具                                 | 宿主 agent 可调用的工具列表中出现 `second_nature_ops` | J-HOST-01～04         | US-001, T1.1.4   | 人类动作 = 让模型「只调工具、贴完整 JSON」                                            |
| `command=heartbeat_check`                              | 工具 `command` 参数                          | J-HOST-02, J-REPO-01 | US-001           | 对照 `surfaceMode` / `status` / `livedExperienceLoopClaimed`           |
| `command=quiet` / `status`                             | 同上                                       | J-HOST-03, J-REPO-01 | US-006, T1.1.4   | 根 unknown vs 根已知对照                                                   |
| `command=explain` + `args.subject`                     | 同上                                       | J-HOST-01, J-REPO-01 | T1.1.4, CH-11-02 | carrier 须 `ok:false` + `EXPLAIN_READ_SURFACE_UNAVAILABLE`            |
| `workspaceRoot` 工具参数 vs `SECOND_NATURE_WORKSPACE_ROOT` | 网关 / 宿主配置说明                              | J-HOST-02, J-HOST-04 | T1.1.4           | 与 `docs/validation/int-s4-human-operator-testing-guide.md` §D4/D7 一致 |
| `pnpm test` 集成文件                                       | 开发者终端                                    | J-REPO-01            | T1.1.4, CH-13    | **不能**替代 INT-S4（CH-11-01）                                            |


### Journeys（旅程级）


| ID        | PRD ref          | User Journey                                                                                                               | 旅程结果 | Evidence                  | Notes                                                                                                                    |
| --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| J-REPO-01 | T1.1.4, CH-13    | 克隆本仓库 → `pnpm install` → `pnpm test tests/integration/cli/plugin-workspace-ops-bridge.test.ts`，确认全部通过                      | 待执行  | 终端完整输出或 CI run URL        | 覆盖 CH-11-02 carrier explain、桥接 heartbeat/status/quiet、CH-13-01 矩阵、env 子进程 heartbeat                                      |
| J-HOST-01 | INT-S4, CH-11-02 | 在 **未设置** workspace 根时，让宿主调 `explain`（有效 `subject`），核对 **不**出现「半成功」观感                                                      | 待执行  | 工具返回 JSON + transcript 片段 | 期望：`ok:false`，`error.code` 含 `EXPLAIN_READ_SURFACE_UNAVAILABLE`                                                          |
| J-HOST-02 | INT-S4, US-001   | **设置** `SECOND_NATURE_WORKSPACE_ROOT` 指向真实 workspace（含可打开 state DB）→ `heartbeat_check` → 核对非 `runtime_carrier_only` 冒充全链闭环 | 待执行  | 环境变量证明 + JSON             | 期望：`surfaceMode` 可为 `workspace_full_runtime`；`livedExperienceLoopClaimed` 与事实一致；**CH-11-01**：若惰性加载被沙箱拦截，应出现桥接失败显式错误而非假成功 |
| J-HOST-03 | T1.1.4, US-006   | 同一宿主下 **对照**「未设根」与「已设根」的 `quiet` / `status` 观感与字段                                                                          | 待执行  | 两次 JSON 并排                | 与 `int-s4-human-operator-testing-guide.md` 对话模板一致                                                                        |
| J-HOST-04 | T1.1.4           | **不设 env**，仅在工具参数传 `workspaceRoot`（与 J-HOST-02 同一路径数据）复测 `heartbeat_check`                                                 | 待执行  | JSON                      | 验证 `tool_args` 解析路径                                                                                                      |


### Step breakdown


| Journey   | Step | PRD ref  | Step 结果 | Evidence                                                                    | Notes                                                  |
| --------- | ---- | -------- | ------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| J-REPO-01 | 1    | T1.1.4   | 待执行     | `pnpm test tests/integration/cli/plugin-workspace-ops-bridge.test.ts` 退出码 0 | 需已 `pnpm build:plugin` 若测试加载 `plugin/index.js`         |
| J-REPO-01 | 2    | CH-13    | 待执行     | 同上日志中含 `CH-13-01` 用例名                                                       | 矩阵：fallback / report / session / credential / explain  |
| J-HOST-01 | 1    | CH-11-02 | 待执行     | 工具原始 JSON                                                                   | **读屏**：确认无「仅看 `ok` 误以为已 explain」                       |
| J-HOST-01 | 2    | CH-11-02 | 待执行     | 同上                                                                          | **动作**：`explain` + `subject=probe:…`；**结果**：`ok:false` |
| J-HOST-02 | 1    | CH-11-01 | 待执行     | 宿主环境配置截图或 redacted 说明                                                       | **副作用**：写入/读取真实 workspace；须 owner 授权                   |
| J-HOST-02 | 2    | US-001   | 待执行     | `heartbeat_check` 完整 JSON                                                   | 对照 `HeartbeatSurfaceResult` 语义；禁止把 carrier-only 当闭环成功  |
| J-HOST-03 | 1    | US-006   | 待执行     | 两次 `quiet` JSON                                                             | 空态 / 拒绝态文案应可理解，非「全绿假空」                                 |
| J-HOST-04 | 1    | T1.1.4   | 待执行     | JSON                                                                        | 与 J-HOST-02 对比字段级一致性（工具参数 vs env）                      |


### Findings

- （实机执行后在此追加；模板）  
- `[HIGH/MEDIUM/LOW]` 标题  
  - PRD ref:  
  - Expected / Actual / Repro / Evidence / Suggested fix:

### Coverage gaps

- **CH-11-01（惰性 `import` + sql.js 于宿主 VM）**：仓库内 **无法** 100% 模拟 OpenClaw 沙箱策略；**必须** J-HOST-02/04 在目标宿主留证。  
- **主动联系 / 投递会话（US-004/US-007）**：本文件 **不包含**；仍以 `docs/validation/int-s4-host-smoke-testing-guide.md` J0–J7 为准。  
- **Plan B 子进程 CLI**：当前实现以 **进程内桥** 为主；若宿主证伪桥接打开，再走 `/change` 评估 Plan B，并 **新开** Journey，不在此预写 PASS。

### Recommendation

- **合并/发布前**：至少 **J-REPO-01** 为 **PASS**（CI 可固定）；**INT-S4 里程碑勾选** 必须 **J-HOST-01～04** 中与本变更相关的步骤为 **PASS** 或已解释的 **unknown**，并回填 `reports/int-s4-release-readiness.md` 与 `05_TASKS.md` INT-S4 行（与 AGENTS.md 中 AUTO 停条件一致）。  
- **无宿主环境时**：仅执行 **J-REPO-01** + 文档审阅；**不**宣称 INT-S4 完成。

---

## 与现有指南的关系


| 文档                                                       | 用途                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `docs/validation/int-s4-host-smoke-testing-guide.md`     | 机械旅程 J0–J7、release readiness                                                    |
| `docs/validation/int-s4-human-operator-testing-guide.md` | carrier 诚实观感、§D7 `explain`、对话模板                                                 |
| **本文件**                                                  | **T1.1.4 / CH-13 自动化子集** 与 **宿主侧 workspace 桥** 的 E2E 骨架；供 `/forge` §3.4.6 回填证据列 |


---

## 执行计划（短文）

- **Target**: 同上 Scope。  
- **Environment**: 分 A（仓库）/ B（OpenClaw）；勿混用结论。  
- **Role**: owner。  
- **Data setup**: J-REPO-01 自带临时目录；J-HOST-* 需真实或 staging workspace。  
- **Side effects**: J-HOST-* 可能读生产 state；仅授权环境下执行。  
- **Blockers**: 无目标宿主、无权限设 env、插件版本非本构建 → 仅做 J-REPO-01 并标明 INT-S4 blocked。

