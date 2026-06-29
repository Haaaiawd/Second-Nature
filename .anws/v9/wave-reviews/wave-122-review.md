# Wave 122 Code Review — 2026-06-26

## 1. 总结结论

**Pass（带 Medium / Low 修复建议）**

T5.2.1 的核心交付已落地：`runV9DreamConsolidation` 按 memory / procedural / self_continuity / connector_evolution / character 五族路由输出；placeholder / 空内容路径正确返回 `dream_blocked_no_content`；credential / private 形状有内联 redaction 阻断；procedural projection 的 accept/supersede/reject/retire 生命周期通过 `v9-procedural-projection-lifecycle.ts` 实现；`v9-state-stores.ts` 补齐了 `procedural_projection` 与 `connector_evolution_plan` 的读写端口。未发现 Critical / High 阻断项。存在 3 项 Medium（procedural projection 状态枚举漂移、accept 时错误 supersede candidate、ID 非确定性）与若干 Low（测试覆盖缺口、文档/理由码语义、类型强转等）。

## 2. 审查范围与静态边界

**已读输入**
- `.anws/v9/01_PRD.md`（REQ-001 / REQ-004 / REQ-005 / REQ-008）
- `.anws/v9/02_ARCHITECTURE_OVERVIEW.md` §2 System 5 / §3.5 Agent-boundary guardrails
- `.anws/v9/03_ADR/ADR_003_CONTINUITY_PROJECTION_AFTER_DREAM.md`
- `.anws/v9/03_ADR/ADR_005_PROCEDURAL_MEMORY_AS_VERIFIED_ROUTINE.md`
- `.anws/v9/03_ADR/ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md`
- `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md` 及 `memory-continuity-system.detail.md`
- `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`
- `.anws/v9/05A_TASKS.md` T5.2.1 / 相关依赖任务
- `.anws/v9/05B_VERIFICATION_PLAN.md` T5.2.1
- `.anws/v9/07_CHALLENGE_REPORT.md`（本轮无未闭合发现）
- 实现文件：`src/storage/v9-state-stores.ts`、`src/core/second-nature/quiet-dream/v9-dream-consolidation-runner.ts`、`src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.ts`
- 测试文件：`tests/unit/dream/v9-dream-consolidation-runner.test.ts`、`tests/unit/dream/v9-procedural-projection-lifecycle.test.ts`、`tests/integration/v9/quiet-dream-continuity.test.ts`
- 辅助验证：`src/storage/db/schema/v9-entities.ts`、`src/shared/types/v9-contracts.ts`

**静态边界**
- 未执行 `pnpm typecheck` / `pnpm test` / `pnpm build`；结论仅基于源码形态与契约对照。
- 未审查下游 T5.2.2（SelfContinuityCard assembly）、T6.2.2（ToolRoutine registry）、T7.2.x（CharacterFrame）的实现。
- 未验证 sql.js / OpenClaw 宿主真机行为；未做动态 HTTP 探测。

## 3. 契约 → 代码映射摘要

| 设计承诺 | 实现位置 | 状态 |
| --- | --- | --- |
| Dream 输出 memory/procedural/self_continuity/connector_evolution/character 五族 | `v9-dream-consolidation-runner.ts:145-336` | ✅ 每个 family 有独立 generator |
| Quiet placeholder / content_missing / empty → `dream_blocked_no_content` | `v9-dream-consolidation-runner.ts:405-413` | ✅ |
| credential / private 形状 redaction 阻断 | `v9-dream-consolidation-runner.ts:114-122` | ✅ 基础正则覆盖常见形状 |
| procedural / connector_evolution candidate 字段校验 | `v9-dream-consolidation-runner.ts:338-355` | ✅ capabilityPattern / platformId / planType 必填 |
| ProceduralProjection accept / reject / retire 生命周期 | `v9-procedural-projection-lifecycle.ts:62-191` | ⚠️ 状态值与设计枚举存在漂移，见 M-1 |
| 同 capabilityPattern 自动 supersede | `v9-procedural-projection-lifecycle.ts:94-115` | ⚠️ 错误地把 candidate 也 supersede，见 M-2 |
| v9 存储端口：procedural_projection / connector_evolution_plan | `v9-state-stores.ts:325-512` | ✅ 读写 + 状态更新 + degraded 封装 |
| 写入必须携带 sourceRefs | `v9-state-stores.ts:113/342/437` | ✅ 缺失时抛错（非 degraded），见 L-5 |

## 4. Lens 结果摘要

- **L1 契约忠实度**：五族路由与 Quiet 阻断符合设计。`ProceduralProjection` 状态枚举出现漂移（设计为 `candidate/validated/rejected/installed`，代码写入 `active/superseded`）；`rejectProceduralProjection` 返回理由码 `routine_invocation_denied` 语义不当。
- **L2 任务兑现与交付闭合**：T5.2.1 的实现文件与 05B 证据清单一一对应；`AGENTS.md` 与 `05A_TASKS.md` 已勾选 T5.2.1。但 `v9-dream-consolidation-runner.ts` 文件头引用的单元测试文件名为 `v9-dream-output-families.test.ts`，实际文件名为 `v9-dream-consolidation-runner.test.ts`。
- **L3 架构适配与复杂度健康**：runner 保持无状态、只生成 candidate；lifecycle 通过 narrow storage ports 操作。`acceptProceduralProjection` 使用 `Date.now()` 构造 ID，引入非确定性与潜在碰撞。
- **L4 静态运行风险与安全边界**：无新增外部入口；redaction 为正则硬编码，覆盖有限；缺失 sourceRefs 时写入函数抛错而非返回 degraded envelope。
- **L5 验证证据与可观测性**：集成测试覆盖五族输出与 accept/supersede；单元测试缺少 reject/retire 成功路径、self_continuity/connector_evolution/character 家族、以及 redaction 成功放行 fixture。
- **L6 回流一致性与交接证据**：`AGENTS.md` 当前状态已标记 Wave 122 complete 与 T5.2.1 checked，但若本审查列出的 Medium/Low 未修复，则“review-fix applied”声明不成立。

## 5. Issues

### M-1 | ProceduralProjection 状态枚举与设计文档漂移
- **Severity**: Medium
- **Lens**: L1 + L3
- **Title**: `ProceduralProjection` 写入 `active`/`superseded`，偏离设计枚举
- **Evidence**: `src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.ts:123` 写入 `status: "active"`；`:102` 将旧 projection 更新为 `"superseded"`。
- **Impact**: `memory-continuity-system.detail.md §2` 明确定义 `ProceduralProjection` 生命周期为 `candidate / validated / rejected / installed`。当前字符串若被下游 T5.2.2 / T6.2.2 按设计枚举查询，会漏掉 `active`/`superseded` 行，导致 continuity read model 与 routine registry 状态不一致。
- **Minimum fix**: 按设计枚举写入 `installed`（accept 后）或 `validated`/`rejected`/`retired`；supersede 语义应映射为 `rejected` 或新增设计认可的 `superseded` 状态，并同步更新 `shared-v9-contracts.md` / schema 枚举约束。
- **Anchor**: `04_SYSTEM_DESIGN/memory-continuity-system.detail.md §2 ProceduralProjection`；`shared-v9-contracts.md §6 ToolRoutine` 区分 registry 状态。

### M-2 | Accept 时把 candidate 也标记为 superseded
- **Severity**: Medium
- **Lens**: L1 + L4
- **Title**: 同 pattern 的 pending candidate 被提前 supersede
- **Evidence**: `src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.ts:100-115` 对 `status === "active" || status === "candidate"` 全部执行 supersede。
- **影响**: 设计 L0/L1 仅要求 supersede **active** projection。将尚未接受的 candidate 一并失效，会丢失并发的、可能更优的候选，且使后续审计/比较缺少历史 candidate。
- **Minimum fix**: 仅 supersede `status === "active"` 的行；candidate 行保留或按独立业务规则处理。
- **Anchor**: `04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.3 acceptMemoryProjection`（仅 active 被 supersede）。

### M-3 | Projection ID 使用 `Date.now()`，非确定性且可能碰撞
- **Severity**: Medium
- **Lens**: L3 + L5
- **Title**: `acceptProceduralProjection` 依赖时间戳生成主键
- **Evidence**: `src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.ts:117`：`const projectionId = \`proc_${candidateId}_${Date.now()}\`;`。
- **Impact**: 高并发或快速连续 accept 同一 candidate 时可能生成相同 ID，导致写入冲突或测试不稳定；也难以在测试中精确断言 ID。
- **Minimum fix**: 使用项目现有的 `generateId()` / `crypto.randomUUID()` 等确定性/唯一 ID 生成器，并通过注入 port 使单测可 mock。
- **Anchor**: `04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.3` 使用 `generateProjectionId(candidateId)` 的伪代码。

### L-1 | 单元测试未覆盖 reject / retire 成功路径
- **Severity**: Low
- **Lens**: L5
- **Title**: `v9-procedural-projection-lifecycle.test.ts` 仅验证 reject/retire 的 DB 失败路径
- **Evidence**: `tests/unit/dream/v9-procedural-projection-lifecycle.test.ts:84-100` 的 reject/retire 用例都使用抛异常的 mock DB，只断言 degraded；accept 用例也仅覆盖校验失败与 DB 失败。
- **影响**: 成功状态迁移（`rejected`/`retired`）与返回字段未在单元层断言，回归时可能漂移。
- **Minimum fix**: 补一个返回正常 row 的 mock DB，断言 reject/retire 返回正确 status 与 reason；accept 成功路径同理。
- **Anchor**: `05B_VERIFICATION_PLAN.md §5 T5.2.1`“单元测试覆盖 output family routing, placeholder/no-content rejection, supersede/reject/retire transitions”。

### L-2 | `rejectProceduralProjection` 理由码语义不当
- **Severity**: Low
- **Lens**: L1
- **Title**: 拒绝 projection 返回 `routine_invocation_denied`
- **Evidence**: `src/core/second-nature/quiet-dream/v9-procedural-projection-lifecycle.ts:166`。
- **影响**: `routine_invocation_denied` 应描述运行时调用拒绝，而非候选 projection 被人为/策略拒绝，observability 归因会失真。
- **Minimum fix**: 新增或复用更精确的理由码（如 `routine_validation_rejected` 或 `projection_rejected`），并同步 `V9ReasonCode`。
- **Anchor**: `shared-v9-contracts.md §11 Reason-code registry`。

### L-3 | 文件头引用的单元测试文件名不存在
- **Severity**: Low
- **Lens**: L6
- **Title**: `v9-dream-consolidation-runner.ts` 头注释指向错误测试文件
- **Evidence**: `src/core/second-nature/quiet-dream/v9-dream-consolidation-runner.ts:32` 声明 `Test coverage: tests/unit/dream/v9-dream-output-families.test.ts`，实际文件为 `tests/unit/dream/v9-dream-consolidation-runner.test.ts`。
- **影响**: 新开发者按注释找不到对应测试，交接信息不准确。
- **Minimum fix**: 将头注释改为实际测试文件路径。
- **Anchor**: 实现文件头注释规范。

### L-4 | sourceRefs 写入缺失时抛错而非 degraded envelope
- **Severity**: Low
- **Lens**: L4
- **Title**: `writeAttentionSignal` / `writeProceduralProjection` / `writeConnectorEvolutionPlan` 在 sourceRefs 缺失时抛异常
- **Evidence**: `src/storage/v9-state-stores.ts:113-115`、`src/storage/v9-state-stores.ts:342-344`、`src/storage/v9-state-stores.ts:437-439`。
- **影响**: 调用方若未处理，异常会上浮破坏 cycle 的 exactly-one closure；与“degraded-aware”端口声明不一致。
- **Minimum fix**: 校验失败返回 `DegradedOperationResult`（如 `source_refs_unresolved`），由调用方记录 closure / stage event。
- **Anchor**: `v9-state-stores.ts:20-22` 边界声明“Degraded state: returns DegradedOperationResult on DB failure, never throws.”

### L-5 | v9 SourceRef 强转为 v8 SourceRef
- **Severity**: Low
- **Lens**: L1 + L3
- **Title**: `makeDegraded` 用 `as unknown as` 桥接 v9/v8 SourceRef
- **Evidence**: `src/storage/v9-state-stores.ts:67`。
- **影响**: 编译期静默绕过类型差异，若 v9 SourceRef 增加字段而 v8 未同步，degraded envelope 可能包含不兼容字段。
- **Minimum fix**: 使用共享序列化函数将 v9 SourceRef 映射为最小公共对象，或统一 SourceRef 类型。
- **Anchor**: `shared-v9-contracts.md §1 SourceRef`。

### L-6 | AGENTS.md 已声明 review-fix applied，与本审查发现冲突
- **Severity**: Low
- **Lens**: L6
- **Title**: 项目状态保留区在代码审查完成前标记 review-fix 已应用
- **Evidence**: `AGENTS.md:87` “Wave 122 complete; T5.2.1 checked; review-fix applied”。
- **影响**: 若本审查列出的 Medium/Low 未在代码中修复，该声明会误导下一波启动时的状态判断。
- **Minimum fix**: 在本审查确认无需修复或修复落地后，再保留该声明；否则在修复提交后更新。
- **Anchor**: `AGENTS.md` 项目状态保留区。

## 6. 安全 / 测试覆盖补充

- **Credential / PII 暴露**：新代码不写入 credential value 或 raw private message；`redactSensitive` 在 candidate 生成阶段拦截 credential / private context 形状。该正则是内联硬编码，不如 T8.1.2 规划的统一 redaction projector 健壮，后续应替换为共享 redaction gate。
- **Agent-boundary 文案**：Wave 122 范围内无情绪/人格/硬控制断言；candidate text 仅使用 `Daily review:` / `Routine candidate for ...:` / `Character refresh:` 等描述性前缀，符合 ADR-003/005/006 的边界要求。
- **测试覆盖映射**：
  - `tests/unit/dream/v9-dream-consolidation-runner.test.ts` → no-content / all-blocked / redaction / memory+procedural 输出 ✅
  - `tests/integration/v9/quiet-dream-continuity.test.ts` → 五族输出、procedural accept/supersede、placeholder block ✅
  - 待补：self_continuity / connector_evolution / character 单元断言；reject/retire 成功路径；sourceRefs 缺失的 degraded 路径；redaction 放行正常文本的 fixture。

（本审查为静态审查，未执行 `pnpm typecheck` / `pnpm test` / `pnpm build`。）
