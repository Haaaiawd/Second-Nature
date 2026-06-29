# Wave 121 Code Review — 2026-06-23

## 1. 总结结论

**Pass（带 Medium / Low 修复建议）**

T6.2.1 real-hand affordance baseline 的核心契约已实现：`AffordancePosture` 三轴枚举与 design doc L1 一致；`assembleToolAffordance` 按 access/reliability/familiarity 独立推导；stale probe 会降级为 `reliability=stale`；scaffold 不进入 real-hand planning；active routine 提升 familiarity；read 成功不推导 write（集成测试显式断言）。未发现 Critical / High 阻断项。存在 2 项 Medium（credential presence helper 过宽、probe 状态模型与设计 doc 存在漂移）和若干 Low（未注册 capability 等价类、routine schema 字段、sourceRefs 取样、AGENTS/05A 回流等）。

## 2. 审查范围与静态边界

**已读输入**
- `.anws/v9/01_PRD.md`（REQ-006 / US-006）
- `.anws/v9/02_ARCHITECTURE_OVERVIEW.md` §2 System 6
- `.anws/v9/03_ADR/ADR_004_WORKSPACE_ONLY_CONNECTOR_EVOLUTION.md`
- `.anws/v9/03_ADR/ADR_005_PROCEDURAL_MEMORY_AS_VERIFIED_ROUTINE.md`
- `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.md` 及 `body-connector-system.detail.md`
- `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`
- `.anws/v9/05A_TASKS.md` T6.2.1 / T6.2.2
- `.anws/v9/05B_VERIFICATION_PLAN.md` T6.2.1
- `.anws/v9/07_CHALLENGE_REPORT.md`（本轮无针对 Wave 121 的未闭合发现）
- 实现文件：`src/shared/types/v9-contracts.ts`、`src/storage/v9-state-stores.ts`、`src/core/second-nature/body/tool-affordance/v9-affordance-assembler.ts`
- 测试文件：`tests/unit/body/v9-affordance-posture.test.ts`、`tests/integration/v9/real-hand-affordance.test.ts`
- 辅助验证：`src/storage/services/tool-experience-store.ts`、`src/storage/db/schema/v9-entities.ts`、`src/shared/types/v7-entities.ts`、`src/shared/types/credential.ts`

**静态边界**
- 未执行 `pnpm typecheck` / `pnpm test` / `pnpm build`；结论仅基于源码形态与契约对照。
- 未审查 T6.2.2（ToolRoutine registry）、T6.3.x（connector evolution）、T2.2.1（EmbodiedContext assembly）等下游任务实现。
- 未验证 sql.js / OpenClaw 宿主真机行为；未做动态 HTTP 探测。

## 3. 契约 → 代码映射摘要

| 设计承诺 | 实现位置 | 状态 |
| --- | --- | --- |
| `AffordancePosture` access/reliability/familiarity 三轴枚举 | `src/shared/types/v9-contracts.ts:971-985` | ✅ 与设计 L1 完全一致 |
| 注册 + 有凭证 → `access=credentialed` | `v9-affordance-assembler.ts:115-122` | ✅ |
| 注册 + 无凭证 → `access=needs_auth` | `v9-affordance-assembler.ts:120` | ✅ |
| 7 天内成功 probe/execution → `reliability=proven` | `v9-affordance-assembler.ts:124-151` | ✅ |
| 7 天内失败 → `reliability=degraded` | `v9-affordance-assembler.ts:137-139` | ✅ |
| 仅旧证据 → `reliability=stale` | `v9-affordance-assembler.ts:146-148` | ✅ |
| active routine → `familiarity=routine` | `v9-affordance-assembler.ts:153-163`、`src/storage/v9-state-stores.ts:246-260` | ✅ |
| ≥3 次成功 → `familiarity=practiced` | `v9-affordance-assembler.ts:160-161` | ✅ |
| read 成功不推导 write 可用 | `tests/integration/v9/real-hand-affordance.test.ts:143-175` | ✅ 显式断言 `post.publish` 保持 `unproven/scaffold` |
| source refs 来自 probe/experience/routine | `v9-affordance-assembler.ts:97-113` | ⚠️ 仅取前 3 条 experience，且无 registry source |
| 不执行 live HTTP，只读 persisted evidence | `v9-affordance-assembler.ts:169-232` | ✅ 仅调用 read ports |
| `CapabilityProbeResult` 状态模型 | `v9-affordance-assembler.ts:48`、`141-143` | ⚠️ 复用 v7 `actualStatus`，未实现 design 的 `ProbeStatus.not_implemented` |

## 4. Lens 结果摘要

- **L1 契约忠实度**：`AffordancePosture` 三轴与 design 一致；`assembleToolAffordance` 的决策树与 §4.1 基本对齐。主要漂移在于复用 v7 `CapabilityProbeResult.actualStatus` 而非 v9 `ProbeStatus`，以及 `createCredentialPresenceFromVault` 对 credential 健康状态过宽。
- **L2 任务兑现与交付闭合**：T6.2.1 的实现文件与 05B 验证材料一一对应。单元测试覆盖 8 个等价类；集成测试覆盖 mixed workspace 与 read≠write。未注册 capability 的 `access=none` 等价类未在输出中体现。
- **L3 架构适配与复杂度健康**：`AffordanceAssembler` 通过 narrow ports（registry / credentialPresence / probe & experience stores）读取，不依赖 core runtime；复杂度合理。`v9-state-stores.ts` 中的 `writeToolRoutine` 与 schema 尚未承载 canonical `ToolRoutine` 全部字段，需 T6.2.2 扩展。
- **L4 静态运行风险与安全边界**：无外部输入入口，无 PII/credential 写入新代码。唯一运行风险是 `createCredentialPresenceFromVault` 会把 decrypt_failed/expired/revoked 记录视为有凭证，可能误导 real-hand planning。
- **L5 验证证据与可观测性**：单元测试与集成测试覆盖了三轴的代表性组合，但未覆盖 `not_implemented` scaffold 路径、未注册 capability 的显式 posture，以及 sourceRefs 完整内容断言。
- **L6 回流一致性与交接证据**：实现文件头已标注 design authority 与 test coverage。`AGENTS.md` 与 `05A_TASKS.md` 尚未更新到 Wave 121 / T6.2.1 完成状态，存在回流缺口。

## 5. Issues

### M-1 | `createCredentialPresenceFromVault` 对非 active credential 也返回 true
- **Severity**: Medium
- **Lens**: L1 + L4
- **Title**: Credential presence helper 过宽，broken/expired/revoked 记录被误判为 credentialed
- **Evidence**: `src/core/second-nature/body/tool-affordance/v9-affordance-assembler.ts:245-254`：仅判断 `ctx.status !== "missing"`。
- **Impact**: 当 credential 状态为 `decrypt_failed` / `expired` / `revoked` / `failed` / `pending_verification` 时，`accessLevel` 仍会被标为 `credentialed`，破坏 REQ-006 的真实手脚视图，可能让不可用 capability 进入 real-hand planning。
- **Minimum fix**: 仅当 `ctx.status === "active"` 时返回 true；其余状态返回 false（表现为 `needs_auth` 或单独降级 reason）。
- **Anchor**: PRD REQ-006 / `body-connector-system.detail.md §4.1`；`src/shared/types/credential.ts:1-8`

### M-2 | Probe 结果模型与 design doc 漂移，未处理 `not_implemented`
- **Severity**: Medium
- **Lens**: L1 + L5
- **Title**: 复用 v7 `actualStatus` 而非 v9 `ProbeStatus`，缺少 `not_implemented` → scaffold 降级分支
- **Evidence**: `v9-affordance-assembler.ts:48` 导入 v7 `CapabilityProbeResult`；`v9-affordance-assembler.ts:141-143` 仅将 `actualStatus === "available"` 映射为 `proven`，其余映射为 `degraded`。Design doc 定义 `ProbeStatus` 含 `not_implemented`（`body-connector-system.detail.md:118-123`），且 L0 edge case 明确要求 NOT_IMPLEMENTED 时 `familiarity=scaffold`、`reliability=unproven`（`body-connector-system.md` §11 edge-case 表）。
- **Impact**: 若 connector adapter 返回 NOT_IMPLEMENTED，当前 v7 存储模型无法表达该状态，组装结果可能错误地显示为 `degraded` 或 `stale`，scaffold 与真实 failure 无法区分。
- **Minimum fix**: 在 v9 引入 canonical `CapabilityProbeResult` / `ProbeStatus` 类型，probe 记录写入 `not_implemented` 状态；组装器显式将其映射为 `reliability=unproven`、`familiarity=scaffold`。
- **Anchor**: `body-connector-system.detail.md §2` / `§3.10`；`body-connector-system.md §9.3` edge-case 表

### L-1 | 未注册 capability 未生成 `access=none` posture
- **Severity**: Low
- **Lens**: L1 + L5
- **Title**: 对未注册 capability 返回空数组，未覆盖 design 决策树中的 `access=none` 等价类
- **Evidence**: `v9-affordance-assembler.ts:180-185` 过滤 registry list；`tests/unit/body/v9-affordance-posture.test.ts:67-82` 断言 `postures.length === 0`。
- **Impact**: 调用方无法从 posture 数组区分“未注册”与“无匹配 capability”；设计 §4.1 决策树中的 `access=none / reliability=unproven / familiarity=scaffold` 等价类无静态验证。
- **Minimum fix**: 当 `query.capabilityId` 明确且不在 registry 中时返回单条 `access=none` posture；或更新 design doc 说明未注册 capability 不产出 posture。
- **Anchor**: `body-connector-system.detail.md §4.1`

### L-2 | `writeToolRoutine` 与 schema 未承载 canonical ToolRoutine 字段
- **Severity**: Low
- **Lens**: L1 + L3
- **Title**: ToolRoutine 写入端口和表结构缺少 `routineId`、`triggerCapabilities`、`stepsJson`、`guardSchemaJson` 等 canonical 字段
- **Evidence**: `src/storage/v9-state-stores.ts:262-298`；`src/storage/db/schema/v9-entities.ts:148-173`；canonical type `src/shared/types/v9-contracts.ts:319-355`。
- **Impact**: 当前仅满足 T6.2.1 的 active routine 读取与种子写入；`id` 与 `routineId` 被混用，T6.2.2 实现 guard validation、invocation trace 与 rollback 时必须重构 schema/write port。
- **Minimum fix**: T6.2.2 按 canonical shape 扩展 `toolRoutine` 表与 `writeToolRoutine` 接口。
- **Anchor**: `shared-v9-contracts.md §6`；`05A_TASKS.md T6.2.2`

### L-3 | `collectSourceRefs` 仅取前 3 条 experience 且无 sourceRefs 完整断言
- **Severity**: Low
- **Lens**: L5
- **Title**: source ref 收集采样且单元测试未断言其内容
- **Evidence**: `v9-affordance-assembler.ts:106-108` 使用 `experiences.slice(0, 3)`；单元测试未对 `sourceRefs` 做内容断言，仅集成测试检查 `feed.sourceRefs.length >= 2`。
- **Impact**: 经验历史较多时 sourceRefs 不完整，可能影响 downstream traceability 与 health attribution。
- **Minimum fix**: 增加单元测试断言 sourceRefs 包含 probe、experience、routine 三类；评估是否应包含全部相关 experience source refs。
- **Anchor**: `body-connector-system.detail.md §3.1`；`05B_VERIFICATION_PLAN.md T6.2.1`

### L-4 | `readActiveToolRoutinesByCapabilityPattern` 使用精确匹配
- **Severity**: Low
- **Lens**: L1 + L3
- **Title**: capabilityPattern 读取端口按精确字符串匹配，未实现 pattern 语义
- **Evidence**: `src/storage/v9-state-stores.ts:246-260` 使用 `eq(toolRoutine.capabilityPattern, capabilityPattern)`。
- **Impact**: 若 routine 的 `capabilityPattern` 为通配形式（如 `moltbook/feed.*`），无法命中具体 capability；T6.2.2 需重新实现匹配逻辑。
- **Minimum fix**: T6.2.2 引入 glob/prefix 匹配或统一的 capability pattern DSL。
- **Anchor**: `shared-v9-contracts.md §6` `ToolRoutine.capabilityPattern`；`05A_TASKS.md T6.2.2`

### L-5 | AGENTS.md / 05A_TASKS.md 未更新 Wave 121 状态
- **Severity**: Low
- **Lens**: L6
- **Title**: Wave 121 完成状态未回流到项目状态保留区与任务清单
- **Evidence**: `AGENTS.md` 当前 wave 仍为 Wave 120；`05A_TASKS.md:393-410` T6.2.1 复选框未勾选。
- **Impact**: 下一波启动时依赖 stale 状态，违反 `/forge` 波末回流要求。
- **Minimum fix**: 在 Wave 121 settlement 提交中更新 `AGENTS.md` Wave 块与 `05A_TASKS.md` T6.2.1 状态。
- **Anchor**: `AGENTS.md` 当前状态保留区；`05A_TASKS.md T6.2.1`

## 6. 安全 / 测试覆盖补充

- **Credential / PII 暴露**：本波新代码不写入 credential、raw private content 或 raw prompt；`createCredentialPresenceFromVault` 不接触 credential value，只读 `status`，无泄漏风险。
- **Live HTTP 探测**：`assembleToolAffordance` 仅读取 persisted `capability_probe_result` / `tool_experience` / `toolRoutine`，无 live HTTP，符合静态边界声明。
- **Read ≠ Write**：集成测试 `real-hand-affordance.test.ts:143-175` 显式验证 `feed.read` 5 次成功不会提升 `post.publish` 的 reliability/familiarity。
- **代表性等价类覆盖**：单元测试覆盖 unregistered、needs_auth、credentialed+proven+scaffold、stale probe、failed execution→degraded、≥3 successes→practiced、active routine→routine、platform/capability filter。建议补充 `not_implemented` scaffold 与未注册 `access=none` 两类。

## 7. Review-fix 备注（2026-06-23 会话内已应用）

- **M-1 已修复**: `createCredentialPresenceFromVault` 现在仅当 credential status === `"active"` 时返回 true；`pending_verification` / `expired` / `revoked` / `failed` / `decrypt_failed` 均视为无有效 credential。新增单元测试覆盖非 active credential 返回 `needs_auth`。
- **M-2 接受为 residual**: v7 `CapabilityProbeResult.actualStatus` 仅支持 `{available, degraded, unavailable}`，无法表达 design doc 的 `ProbeStatus.not_implemented`。已在 `deriveReliabilityLevel` 添加 TODO 注释，说明需待 v9 probe runner（T6.3.x）引入该状态后映射为 `reliability=unproven` + `familiarity=scaffold`。
- **L-5 已修复**: `AGENTS.md` 新增 Wave 121 完成块，`05A_TASKS.md` T6.2.1 已勾选。

验证：`pnpm typecheck` / `pnpm build` / `pnpm build:plugin` / `pnpm test` 全绿（1761 tests, 1752 pass, 0 fail, 9 skipped）。
