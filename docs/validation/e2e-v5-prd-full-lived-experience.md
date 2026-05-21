# E2E Verification — v5 PRD 全量生活闭环（宿主 + 仓库 + 社交媒体 / 节律）

> 按 `.cursor/skills/e2e-testing-guide/SKILL.md` 撰写。  
> **读者**：第一次在 **OpenClaw** 里验收插件的操作者；以及要在 **本仓库** 跑满 PRD 映射回归的开发者。  
> **产品形态说明**：Second Nature 的主界面是 **OpenClaw 工具 `second_nature_ops` 返回的 JSON** 与（可选）**`second-nature` CLI** 输出，**不是**独立 Web SPA。所谓「读屏」= **读 JSON / transcript / 终端输出**；若你同时打开 OpenClaw 聊天 UI，证据仍以 **工具原始 JSON** 为准（对齐 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md` J-HOST 表与 `.anws/v5/05_TASKS.md` INT-S4 验证说明）。

**不编造结果**：下表 **旅程结果 / Step 结果 / Evidence** 在实机执行前留空或填「待执行」。

---

## E2E Verification

### Scope

- **PRD / 需求来源**: `.anws/v5/01_PRD.md` — **[G1]–[G6]** 目标、**[NG1]–[NG6]** 非目标边界、**US-001–US-008**（含 REQ-019～026）、§5.1 关键用户旅程（mermaid）、§7 成功指标表。  
- **任务 / 设计交叉引用**: `.anws/v5/05_TASKS.md`（INT-S1～S4、T3.3.1 near-real、T1.1.4 运维约定）；`reports/int-s2-evidence-rhythm-loop.md`、`reports/int-s3-outreach-delivery-quiet.md`；`reports/int-s4-release-readiness.md`；`docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`。  
- **Target**:  
  - **A — 真实宿主**：已安装 `@haaaiawd/second-nature`（或等价构建的 `plugin/` 包）、可设 `SECOND_NATURE_WORKSPACE_ROOT` 或工具 `workspaceRoot`。  
  - **B — 本仓库**：Node + `pnpm`；用于 **US-002 near-real 社交/工作证据**、**US-003 节律决策链**、**US-004/006/007** 等 **CI 可复现子集**（**不等价**于 A 的 INT-S4）。  
- **Environment**: OpenClaw gateway + agent workspace（默认 `~/.openclaw/workspace` 或可配置 `agents.defaults.workspace`）；仓库内为临时 workspace / `:memory:` 或集成测 fixture（见各 Journey 的 Data setup）。  
- **Browser / Viewport（计划）**: 仅当操作者需要 **截图宿主 UI** 时；**契约验收以 JSON 文本为主**。  
- **User Role**: workspace **owner**；能改 env、能触发 heartbeat、能阅读脱敏 transcript。  
- **Build / Commit**: 执行当日填写 `git rev-parse HEAD`；插件版本以 `plugin/package.json` 的 `version` 为准。  
- **Side effects**: 真实平台 token、写 life evidence、delivery dry-run / 真发 —— 须在对应 Step 标注 **需显式授权**；默认优先 **near-real / fixture / 进程内** 路径。

---

### PRD traceability (RTM)

| PRD ref | Summary | Priority | Journeys（见下节 ID） |
| --- | --- | --- | --- |
| **[G1]** | heartbeat 主路径进入真实 decision loop，可查询 decision | P0 | J-HOST-01, J-HOST-02, J-REPO-01, J-REPO-02 |
| **[G2]** | life evidence：平台浏览/互动 + 工作推进可写入、可引用 | P0 | J-REPO-03（社交+工作 near-real）, J-HOST-03（读模型可见性，可选） |
| **[G3]** | rhythm windows：工作/探索/社交/Quiet/reflection/maintenance + 用户任务打断 | P0 | J-REPO-04, J-HOST-04（根已知下 heartbeat 与窗口一致性，可选） |
| **[G4]** | 朋友式主动联系：guard + 草稿 + 投递或诚实 `delivery_unavailable` / fallback | P0 | J-REPO-05, J-HOST-05 |
| **[G5]** | 保留 host-safe 边界；高阈值、可审计、可冷却 | P0 | J-HOST-01, J-REPO-05 |
| **[G6]** | 文档与能力边界可验证 | P1 | J-DOC-01（README / release gate 人工走查，可选） |
| **US-001** [REQ-019] | `heartbeat_check` 进入决策链；不可用时不冒充 | P0 | J-HOST-01～02, J-REPO-01～02 |
| **US-002** [REQ-020] | PlatformLifeEvent / WorkLifeEvent 与 sourceRefs | P0 | J-REPO-03 |
| **US-003** [REQ-021] | 节律窗口影响规划；用户任务绕开 rhythm gate | P0 | J-REPO-04 |
| **US-004** [REQ-022] | outreach 判断 + 会话投递或兜底可见 | P0 | J-REPO-05, J-HOST-05 |
| **US-005** [REQ-023] | user interest snapshot；不足则降级 | P1 | J-REPO-06, J-HOST-06（explain / status 中兴趣字段，可选） |
| **US-006** [REQ-024] | Quiet 收纳 evidence；空态不虚构 | P1 | J-HOST-01（quiet）, J-REPO-07 |
| **US-007** [REQ-025] | OpenClaw 主动联系能力研究与可复现 probe | P0 | J-HOST-07, J-REPO-08 |
| **US-008** [REQ-026] | README 诚实 current / target / validation-needed | P1 | J-DOC-01 |
| **§7 成功指标** | heartbeat 闭环、life evidence、outreach、Quiet、文档一致 | P0 | 由上列 Journey 组合覆盖 |

---

### Surface coverage

| 功能面 / 入口 | 如何发现 | Journey | PRD ref | Notes |
| --- | --- | --- | --- | --- |
| 工具 `second_nature_ops` | OpenClaw 工具列表 / 对话内「只调工具」 | J-HOST-* | US-001, T1.1.4 | JSON 为真源 |
| `command=status` / `quiet` / `heartbeat_check` / `explain` / `fallback` / `storage_smoke` | 工具 `command` + `args` | J-HOST-01～02, 05～07 | US-001, US-006, REQ-019 | 与 `e2e-t1-1-4-workspace-bridge-and-host-verification.md` J-HOST 表对齐 |
| `workspaceRoot` / `SECOND_NATURE_WORKSPACE_ROOT` | 网关 env 或每次工具参数 | J-HOST-02 | T1.1.4 | 与 **OpenClaw agent workspace** 同路径（`05_TASKS` 运维约定） |
| **社交媒体 / 平台生活（near-real）** | 仓库内 **无**单独 `second_nature_ops` 子命令；由 **`runNearRealConnectorSmoke`**（Moltbook `feed.read` 等）写入 evidence | J-REPO-03 | US-002, G2 | 真网 API 需凭证 → Blockers |
| **工作发现（agent-network）** | 同上 — EvoMap `work.discover` 哨兵 | J-REPO-03 | US-002, G2 | 与 `T3.3.1` 一致 |
| **节律 / 决策链** | 集成测 `heartbeat-spine` / `decision-loop-validation`；非单屏 UI | J-REPO-04 | US-003, G1 | `currentWindowId`、obligations、interrupt |
| **Outreach + delivery + Quiet** | INT-S3 报告 + 集成测；宿主侧读 `explain` / `fallback` | J-REPO-05, J-REPO-07, J-HOST-05 | US-004, US-006 | |
| **`pnpm test` 全量** | 开发者克隆仓库后 | J-REPO-00 | G1–G5 间接 | **不能**替代 INT-S4（宿主独占证据） |
| **README / release gate** | 根目录 README、`.anws/v5`、`reports/release-gate-v5-s4.md` | J-DOC-01 | US-008, G6 | 人类走查清单 |

---

### Journeys（旅程级）

| ID | PRD ref | User Journey（人类语言） | 旅程结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J-REPO-00 | G1–G5 | 克隆 → `pnpm install` → `pnpm build` → `pnpm test` 全绿 | 待执行 | 终端日志 / CI | 基线；含 near-real、heartbeat、delivery 契约 |
| J-REPO-01 | US-001, G1 | 仅跑 `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`（或等价子集） | 待执行 | TAP 输出 | 与 T1.1.4 / CH-11-02 对齐 |
| J-REPO-02 | US-001 | 跑 `tests/integration/control-plane/heartbeat-spine*.test.ts` + `decision-loop-validation.test.ts` | 待执行 | TAP | 决策链 + 节律 whole-loop |
| J-REPO-03 | **US-002, G2**（**社交媒体 + 工作 near-real**） | 跑 `tests/integration/connectors/near-real-connector-smoke.test.ts`（`runNearRealConnectorSmoke`：Moltbook feed + EvoMap discover + evidence 入库 + execution telemetry） | 待执行 | TAP + 可选导出 DB 片段 | **仓库内对「平台生活 + 工作生活」的标准 E2E**；真网需额外 Journey |
| J-REPO-04 | **US-003, G1**（**节律**） | 跑 INT-S2 映射用例：`heartbeat-spine` 中 `routeScopedInput` / `currentWindowId` / obligations；`decision-loop-validation` 中 active/quiet/**interrupt**/outreach/deny | 待执行 | TAP | 验证「探索/社交 vs 工作 vs Quiet vs 用户打断」；非 cron 精确时钟 |
| J-REPO-05 | US-004, G4 | 跑 INT-S3 相关集成：`reports/int-s3-outreach-delivery-quiet.md` 所列测试路径（delivery failed、fallback、`not_sent`） | 待执行 | TAP + 报告引用 | 不冒充 `sent` |
| J-REPO-06 | US-005 | 跑 `UserInterestSnapshot` / outreach 相关单测与集成（`T4.2.2`、`heartbeat-spine` 中含 interest 边界） | 待执行 | TAP | `insufficient` / `missing_user_interest_model` 降级 |
| J-REPO-07 | US-006 | Quiet 空态 + source-backed 路径：`quiet` pipeline 集成、INT-S3 Quiet 段落 | 待执行 | TAP | 不得虚构经历 |
| J-REPO-08 | US-007 | capability / probe 相关：`host-smoke`、`probe` explain subject 集成测 | 待执行 | TAP | 与 ADR-007 / cli-system §8 一致 |
| J-HOST-01 | US-001, US-006, G5 | **未设根** → `status` / `quiet` / `heartbeat_check` / `explain` / `storage_smoke`；步骤与预期见 `e2e-t1-1-4-workspace-bridge-and-host-verification.md` J-HOST-01 | 待执行 | **完整 JSON** 原文 | carrier 诚实；无假读模型 |
| J-HOST-02 | US-001, G1, T1.1.4 | **设根** = OpenClaw agent workspace → 再跑 `heartbeat_check` / `quiet`；核对 `workspaceRootResolution`、`livedExperienceLoopClaimed` 与 CLI 语义 | 待执行 | JSON + E2E Plan 路径一行 | INT-S4 硬门槛 |
| J-HOST-03 | US-002（可选真网） | 在 **真实凭证** 下触发一次连接器读（若宿主支持），再在 workspace 内用 `explain` / `status` 查是否出现 **可追溯** platform evidence | 待执行 | 脱敏 JSON + 凭据永不入日志证明 | **非 near-real**；需授权；可进 Coverage gaps |
| J-HOST-04 | US-003（可选） | 根已知下连续两轮 heartbeat：轮换 `HEARTBEAT.md` 或宿主侧时间窗配置（若你们有），观察决策候选类型是否随 **窗口语义** 变化（探索/社交 vs 工作） | 待执行 | 两轮 JSON diff | 若宿主无窗口注入能力 → 以 J-REPO-04 为主 |
| J-HOST-05 | US-004 | 在可构造 outreach 的 workspace 上跑一轮 heartbeat，检查 delivery / `delivery_unavailable` / operator fallback 是否 **可解释** | 待执行 | JSON + `fallback` ref | 与 US-004 异常路径一致 |
| J-HOST-06 | US-005 | `explain` 带 `soul:` / `USER` 相关 subject（若支持）或读 `status` 中 interest 摘要 | 待执行 | JSON | 不足时不得编造喜好 |
| J-HOST-07 | US-007 | 记录宿主版本；跑 capability / `probeOnly` heartbeat；对照 `explore` 或 ADR 中的能力矩阵 | 待执行 | transcript + 版本号 | 文档与实测冲突以实测为准 |
| J-DOC-01 | US-008, G6 | README 英/中：每条「像已完成」的承诺是否标 **current / target / validation-needed**；`release-gate` 表是否可勾选 | 待执行 | 走查笔记 | 与 `.anws/v5` 冲突以 v5 为准 |

---

### Step breakdown

> 每步固定三段：**（1）读屏/读 JSON 预期 （2）动作 （3）可观察结果 + 应采集的证据类型**。

#### J-HOST-01 — 宿主诚实基线（INT-S4 子集）

| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J-HOST-01 | 1 | G5, US-001 | 待执行 | JSON | 未设根：`status` 不得「全绿空盘」假读（对齐 `e2e-t1-1-4` J-HOST-01 Step 2） |
| J-HOST-01 | 2 | US-006 | 待执行 | JSON | `quiet`：`ok:false` + `evaluated:false` + `unavailableReason`（J-HOST-01 Step 3） |
| J-HOST-01 | 3 | US-001 | 待执行 | JSON | `heartbeat_check`：`runtime_carrier_only` 形状；无冒充闭环（J-HOST-01 Step 4） |
| J-HOST-01 | 4 | T1.1.4 | 待执行 | JSON | `explain`：CH-11-02，`ok:false` + 明确 `error.code`（J-HOST-01 Step 6） |
| J-HOST-01 | 5 | S1 | 待执行 | JSON | `storage_smoke`：`ok:true` 且 driver 清晰（J-HOST-01 Step 7） |

#### J-HOST-02 — 根已知全路径

| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J-HOST-02 | 1 | T1.1.4 | 待执行 | 文本 | E2E Plan 写明 `SECOND_NATURE_WORKSPACE_ROOT` **绝对路径** = 宿主 `agents.defaults.workspace`（`e2e-t1-1-4` J-HOST-02 Step 1） |
| J-HOST-02 | 2 | US-001 | 待执行 | JSON | `heartbeat_check`：`workspaceRootResolution` ∈ `env`/`tool_args`；与 CLI 同构读或诚实错误 |
| J-HOST-02 | 3 | US-006 | 待执行 | JSON | `quiet`：根已知时 `evaluated:true` 或等价真读失败（与实现一致即可，**禁止**旧半成功） |

#### J-REPO-03 — 社交媒体（near-real）+ 工作证据

| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J-REPO-03 | 1 | US-002 | 待执行 | TAP | `pnpm test tests/integration/connectors/near-real-connector-smoke.test.ts` |
| J-REPO-03 | 2 | US-002 | 待执行 | 日志摘录 | 断言 **platform** 与 **work** evidence index 非空、含 **sourceRefs** |
| J-REPO-03 | 3 | NG3 | 待执行 | TAP | write 路径为 **dry-run / 显式安全**；不默认生产发帖 |

#### J-REPO-04 — 节律（rhythm windows）

| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J-REPO-04 | 1 | US-003 | 待执行 | TAP | exploration/social vs work window：候选集合或 guard 差异 |
| J-REPO-04 | 2 | US-003 | 待执行 | TAP | quiet/reflection：优先 memory/report 类候选，非默认对外发声 |
| J-REPO-04 | 3 | US-003 | 待执行 | TAP | **用户明确任务**：`paused_for_interrupt` 或绕开 gate；不得因 Quiet 拒绝 |

#### J-REPO-05 — 主动联系 + delivery

| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J-REPO-05 | 1 | US-004 | 待执行 | TAP | 允许候选 + guard + 草稿路径 |
| J-REPO-05 | 2 | US-004 | 待执行 | TAP | `delivery_unavailable` 或等价时 **operator 可见** fallback |
| J-REPO-05 | 3 | G5 | 待执行 | TAP | cooldown / dedupe / 审计字段存在 |

---

### Findings

- （实机后填写）`[HIGH|MEDIUM|LOW]` 标题  
  - PRD ref:  
  - Expected / Actual / Repro / Evidence / Suggested fix:

---

### Coverage gaps

- **无统一「单条宿主脚本」跑完 US-002～004**：社交媒体 near-real 在仓库 **集成测**；宿主真网需凭证与合规评审 → 默认 **Coverage gap** 或独立 J-HOST-03。  
- **节律「像人类调 UI」不适用**：节律验证主阵地在 **J-REPO-04**（控制面集成）；宿主侧仅在有 **窗口注入/时间模拟** 能力时做 J-HOST-04。  
- **InStreet 等连接器**：PRD 列举多平台；**当前 near-real 哨兵以 Moltbook + EvoMap 为主**（见 `05_TASKS` T3.3.1）；其他平台以契约测或未来 INT 承接，本文件不假装已 E2E。  
- **OpenClaw 主动发消息到会话**：取决于宿主能力（US-007）；不可用必须为 **诚实缺口**，不得静默 PASS（NG6）。

---

### Recommendation

- **合并发布前**：至少 **J-REPO-00 + J-HOST-01 + J-HOST-02** 有明确证据；社交媒体与节律 PRD 核心由 **J-REPO-03 + J-REPO-04** 在 CI 兜底。  
- **尚未实机**：不得将本文件任何旅程标为 **PASS**；仅可标 **待执行 / partial**。  
- **与既有文档关系**：本文件是 **v5 PRD 全量映射总表**；宿主逐步验收以 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md` 为准；INT-S4 人类记录与阻塞写入 `reports/int-s4-release-readiness.md`。

---

## 附录 — 操作者一页纸（可复制给 coding 助手）

1. **设根**：`SECOND_NATURE_WORKSPACE_ROOT` 或每次 `workspaceRoot` = OpenClaw **agent workspace**（与 `05_TASKS` T1.1.4 运维约定一致）。  
2. **宿主 JSON**：按 `e2e-t1-1-4-workspace-bridge-and-host-verification.md` J-HOST-01 表：`status` → `quiet` → `heartbeat_check`（含 `probeOnly:true`）→ `explain` → `storage_smoke`。  
3. **仓库 PRD 全覆盖**：`pnpm test`；重点子集 `near-real-connector-smoke`、`heartbeat-spine`、`decision-loop-validation`、INT-S3 引用用例。  
4. **真源**：任何自然语言与 **工具 JSON** 冲突 → **以 JSON 为准**。
