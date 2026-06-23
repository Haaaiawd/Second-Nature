# Wave 120 Code Review — 2026-06-23

## 1. 总结结论

**Pass（带 Medium / Low 修复建议）**

T3.2.1 与 T3.2.2 的核心契约已实现：`AttentionSignal` 作为 body hint 不替代 Agent 判断；`StableEvidenceIdentity` 形态与 design 一致；重复 feed 通过 `evidence_item` 的 `stable_identity_key` / `seen_count` / `last_observed_at` 聚合；`identity_unstable` 被降级且不推广为 routine signal；v8 `JudgmentVerdict` 只读 legacy adapter 返回 degraded AttentionSignal。未发现 Critical / High 阻断项。存在 1 项 Medium（迁移块在 ALTER TABLE 新增列上建索引，与任务兼容性要求冲突）和若干 Low（设计分支/测试覆盖/类型漂移）。

## 2. 审查范围与静态边界

**已读输入**
- `.anws/v9/01_PRD.md`（REQ-002/003，Agent-boundary G10）
- `.anws/v9/02_ARCHITECTURE_OVERVIEW.md` §2 System 3 / §3.5 Agent-boundary guardrails
- `.anws/v9/03_ADR/ADR_002_ATTENTION_NOT_AGENT_MIND.md`
- `.anws/v9/03_ADR/ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md`
- `.anws/v9/04_SYSTEM_DESIGN/attention-system.md` 及 `attention-system.detail.md`
- `.anws/v9/05A_TASKS.md` T3.2.1 / T3.2.2 / T5.2.3
- `.anws/v9/05B_VERIFICATION_PLAN.md` T3.2.1 / T3.2.2 / T5.2.3
- `.anws/v9/07_CHALLENGE_REPORT.md`（本轮无针对 Wave 120 的未闭合发现）
- 实现文件：见任务描述列表
- 辅助验证：`.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`、`src/storage/db/schema/v8-entities.ts`、`src/storage/db/schema/v9-entities.ts`

**静态边界**
- 未执行 `pnpm typecheck` / `pnpm test` / `pnpm build`；结论仅基于源码形态与契约对照。
- 未审查 T2.2.x（heartbeat 切换）、T4.2.x（action proposal）、T6.2.x（routine/affordance）等下游任务实现。
- 未验证 sql.js / OpenClaw 宿主真机行为。

## 3. 契约 → 代码映射摘要

| 设计承诺 | 实现位置 | 状态 |
| --- | --- | --- |
| `AttentionSignal` 是 body hint，不输出最终 judgment | `src/core/second-nature/perception/attention-assembler.ts:72-147` | ✅ `possibleActions` 仅建议姿态；返回 `blocked` 供调用方决定是否提案 |
| 缺失 source refs → `attention_blocked_missing_sources` | `attention-signal-validator.ts:37-51`、`attention-assembler.ts:91-94` | ✅ 双重校验，动作降级为 `defer`，threadSuggestion 设为 `none` |
| `StableEvidenceIdentity` 形态（logicalId/seenCount/firstObservedAt/lastObservedAt/repetitionStatus） | `src/shared/types/v9-contracts.ts:50-59`、`src/storage/v9-evidence-identity-port.ts:118-148` | ✅ 字段完整 |
| `observedAt` 不参与 logical identity | `v9-evidence-identity-port.ts:44-50`、`evidence-normalizer.ts:125-133` | ✅ key 由 platformId + externalId/contentHash 组成 |
| 重复 feed 抑制：同一 externalId/contentHash 不新增等价 row，seenCount 递增 | `evidence-normalizer.ts:227-258`、`v8-state-stores.ts:133-176` | ✅ UPDATE 刷新 observedAt/lastObservedAt/seenCount；唯一索引 `(platform_id, content_hash)` |
| `identity_unstable` 阻断 routine signal | `attention-assembler.ts:95-100`、`attention-signal-validator.ts:68-70` | ✅ status=`degraded` / novelty=0；`suggestActions` 因 `repetition!="new"` 不推 `remember` |
| v8 `JudgmentVerdict` 只读 legacy adapter | `src/storage/v9-legacy-judgment-adapter.ts:30-63` | ✅ 返回 degraded、reason=`v8_legacy_judgment_mapped`、无 actionable suggestions |
| Agent-boundary：无情绪/人格/硬控制断言 | `attention-scorer.ts:246-260`（summary 仅描述性标签） | ✅ 当前范围内无违规文案 |
| v9 schema bootstrap 与 v8 兼容 | `src/storage/db/index.ts:507-678` | ⚠️ 见 Issues M-1 |

## 4. Lens 结果摘要

- **L1 契约忠实度**：整体忠实。`AttentionSignal` 运行时类型相比 design doc §6.1 缺少 `evidenceRefs` 与 `suggestedPosture`，属 Low 漂移；`SourceRefFamily` 额外包含 `activity`、`capability_probe_result` 但未在设计枚举中声明，属 Low。
- **L2 任务兑现与交付闭合**：T3.2.1 / T3.2.2 / T5.2.3 的实现文件与 05B 验证材料一一对应。重复抑制集成测试 `repeated-feed-suppression.test.ts` 直接断言 `seenCount=3` 与单条 logical row。未覆盖 "changed" repetition 路径（Low）。
- **L3 架构适配与复杂度健康**：`attention-system` 组件拆分（assembler / scorer / validator / repetition-detector / identity-port）符合 design；identity 写入仍由 v8 ingestion 拥有，read port 只读，边界清晰。
- **L4 静态运行风险与安全边界**：无 auth/鉴权问题（本波无新入口）。`identity_unstable` 降级路径正确；敏感内容 `remember` 建议存在设计分支风险（见 L-2）。`attention-assembler` 的持久化失败被静默吞掉，虽标注 best-effort，但生产排障会缺少信号（Low）。
- **L5 验证证据与可观测性**：单元测试覆盖 new/duplicate/missing-source/unstable；集成测试覆盖 stable identity 与重复抑制。缺少 "changed"、高 relevance 敏感 evidence、threadSuggestion 非法组合等边界断言。
- **L6 回流一致性与交接证据**：`v9-contracts.ts` 文件头已标注 design authority 与 test coverage；`v9-evidence-identity-port.ts` 与 `v9-legacy-judgment-adapter.ts` 均标注边界与 test coverage。本波未涉及 CLI/plugin/文档变更，故无额外回流项。

## 5. Issues

### M-1 | Migration block creates indexes on ALTER TABLE-added columns
- **Severity**: Medium
- **Lens**: L1 + L4
- **Title**: `CREATE INDEX` on columns added by `ALTER TABLE` violates stated compatibility guideline
- **Evidence**: `src/storage/db/index.ts:734-738` adds `stable_identity_key` / `last_observed_at` / `row_identity_status` to `evidence_item` via `ALTER TABLE ... ADD COLUMN`; `src/storage/db/index.ts:742-743` immediately issues `CREATE INDEX IF NOT EXISTS evidence_item_stable_identity_idx ON evidence_item(stable_identity_key)` and `CREATE INDEX IF NOT EXISTS evidence_item_last_observed_status_idx ON evidence_item(last_observed_at, row_identity_status)`.
- **Impact**: 任务明确声明 "no CREATE INDEX on columns added by ALTER TABLE"；当前代码在预存 DB 上先加列再建索引，与兼容性要求冲突。虽然 SQLite 支持且被 try/catch 包裹，但若宿主 SQLite/sql.js 版本或原生绑定存在隐式限制，启动可能静默跳过索引，导致后续 stable-identity 查询退化。
- **Minimum fix**: 将这两个索引移入 bootstrap `STATE_SCHEMA_SQL` 的 `evidence_item` 表定义块（已存在的 `evidence_item_platform_content_hash_idx` 模式），并在迁移块中仅做列添加；或移除迁移块中的索引创建并单独验证。
- **Anchor**: 任务描述 "DB bootstrap is backward-compatible with pre-existing state.db (no CREATE INDEX on columns added by ALTER TABLE)"；`src/storage/db/index.ts:344-346` 注释也承认该意图。

### L-1 | `suggestActions` may recommend `remember` for high-risk sensitive evidence
- **Severity**: Low
- **Lens**: L1 + L4
- **Title**: High-risk evidence action suggestion contradicts design §5.4 when relevance is high
- **Evidence**: `src/core/second-nature/perception/attention-scorer.ts:176-183` pushes `notify_owner`/`watch` for high risk, then independently pushes `remember` when `identity.repetitionStatus === "new" && relevance >= RELEVANCE_MEDIUM`.
- **Impact**: 若敏感证据同时命中 accepted goal / projection，`remember` 会进入建议列表，与 `attention-system.detail.md §5.4` "risk=high 时建议 notify_owner/watch；不得建议 remember" 冲突。
- **Minimum fix**: 在 `remember` 分支增加 `risk !== "high"`  guard；补充覆盖高 relevance 敏感 evidence 的单元测试。
- **Anchor**: `04_SYSTEM_DESIGN/attention-system.detail.md §3.5` 与 `§5.4` 存在内部矛盾；§5.4 安全约束应优先。

### L-2 | Validator does not enforce `activityThreadId` requirement for `threadSuggestion`
- **Severity**: Low
- **Lens**: L1 + L5
- **Title**: `threadSuggestion` invariant (`continue`/`pause`/`complete` require `activityThreadId`) not validated
- **Evidence**: `src/core/second-nature/perception/attention-signal-validator.ts:37-78` validates source refs, summary length, action count, and novelty/repetition consistency, but does not check that `threadSuggestion` values other than `create`/`none` carry `activityThreadId`.
- **Impact**: 下游 `control-context-system` 可能收到 `threadSuggestion="continue"` 但 `activityThreadId` 缺失，导致 thread lookup 失败或误用。当前 scorer 实现 (`attention-scorer.ts:209-244`) 实际上不会生成这种组合，但验证器未将其固化为契约。
- **Minimum fix**: 在 `validateAttentionSignal` 中增加：若 `threadSuggestion` 为 `continue`/`pause`/`complete` 且 `activityThreadId` 缺失，则降级为 `threadSuggestion="none"`。
- **Anchor**: `04_SYSTEM_DESIGN/attention-system.detail.md §2.2`: "`threadSuggestion` 只能是 `create` / `continue` / `pause` / `complete` / `none`；除 `create` / `none` 外必须携带 `activityThreadId`".

### L-3 | `AttentionSignal` runtime type omits design-doc fields
- **Severity**: Low
- **Lens**: L1
- **Title**: Runtime `AttentionSignal` lacks `evidenceRefs` and `suggestedPosture` declared in design doc
- **Evidence**: `src/shared/types/v9-contracts.ts:81-94` defines `AttentionSignal` with `signalId`, `sourceRefs`, `possibleActions`, etc., but without `evidenceRefs` or `suggestedPosture`. `attention-assembler.ts:130` passes `evidenceRefs` only to the persistence layer, not the returned signal.
- **Impact**: 下游消费 `AttentionSignal` 的运行时代码无法直接访问 evidence refs 集合；`suggestedPosture` 的缺失使 "notify_owner / watch / remember / defer" 的单一主推姿态无法表达。
- **Minimum fix**: 在 `AttentionSignal` 运行时类型中补回 `evidenceRefs: SourceRef[]` 与 `suggestedPosture: AttentionPosture`（或确认 intentional simplification 并更新 design doc）。
- **Anchor**: `04_SYSTEM_DESIGN/attention-system.md §6.1` / `attention-system.detail.md §2.1`.

### L-4 | Unit tests miss "changed" repetition path
- **Severity**: Low
- **Lens**: L5
- **Title**: No unit/integration test for `repetition="changed"`
- **Evidence**: `tests/unit/attention/v9-attention-assembler.test.ts` covers `new`, `duplicate`, missing sources, and `identity_unstable`. `tests/integration/v9/repeated-feed-suppression.test.ts` covers stable duplicate. No test exercises content-edit → `changed` → novelty=0.5.
- **Impact**: `resolveRepetition` 的 `changed` 分支 (`src/storage/v9-evidence-identity-port.ts:113-114`) 未经验证，回归时可能漂移为 duplicate/new。
- **Minimum fix**: 在单元测试中构造同一 externalId 但不同 contentHash 的场景，断言 `repetition="changed"` 且 `novelty=0.5`。
- **Anchor**: `05B_VERIFICATION_PLAN.md §7 T3.2.1` / `04_SYSTEM_DESIGN/attention-system.detail.md §3.2`.

### L-5 | Normalizer update-failure fallthrough can double-increment `seenCount`
- **Severity**: Low
- **Lens**: L4
- **Title**: Explicit UPDATE failure fallthrough to INSERT upsert risks duplicate `seenCount` increment
- **Evidence**: `src/connectors/evidence-normalizer.ts:227-258` manually increments `seenCount` in the UPDATE branch; if UPDATE throws, it falls through to `writeEvidenceItem` (`src/storage/v8-state-stores.ts:156-166`), whose `onConflictDoUpdate` also increments `seenCount` by 1.
- **Impact**: 在 UPDATE 失败但 INSERT 冲突成功的情况下，`seenCount` 会被加 2 而非 1，导致重复计数虚高。出现概率低，但影响重复抑制指标与 downstream novelty 判断。
- **Minimum fix**: 在 fallthrough 路径中不再依赖 `writeEvidenceItem` 的 upsert，或在失败时记录 degraded 并跳过该 item 的写入。
- **Anchor**: `04_SYSTEM_DESIGN/attention-system.detail.md §3.1` 要求 `seenCount` 单调递增且准确反映重复暴露次数。

## 6. 安全 / 测试覆盖补充

- **敏感内容 summary**: `attention-scorer.ts:246-260` 的 summary 直接拼接 evidence summary/content，未经过额外 redaction gate。当前 normalizer 对 sensitive 内容设置 `redactionClass="blocked"`，但 assembler 未读取该字段；后续若 content 含 credential/PII，summary 可能泄漏。建议后续 wave 在 assembler 或 validator 中接入 redaction 检查。
- **Agent-boundary 文案**: Wave 120 范围内无 "you are" / "you feel" / "你必须" 等情绪或身份断言；summary 仅使用 `(repetitionLabel) platform/capability: contentSummary[riskHint]` 的描述性模板，符合 ADR-002/006。
- **测试覆盖映射**: 
  - `tests/unit/attention/v9-attention-assembler.test.ts` → T3.2.1 单元断言 ✅
  - `tests/integration/v9/stable-identity-attention.test.ts` → T3.2.1 集成断言 ✅
  - `tests/integration/v9/repeated-feed-suppression.test.ts` → T3.2.2 集成断言 ✅
  - `tests/unit/contracts/v9-shared-contracts.test.ts` → T5.1.1 类型契约 ✅
  - 待补：T3.2.1 的 "changed" 路径、高 relevance 敏感 evidence 的 action 边界、threadSuggestion 非法组合。

## 7. Review-fix 备注（2026-06-23 会话内已应用）

- **M-1 澄清**: 会话中已将 `evidence_item_stable_identity_idx` / `evidence_item_last_observed_status_idx` 从 `STATE_SCHEMA_SQL` 移除，保留在 `applyStateSchemaMigrations` 的 try/catch 块中。这样旧 `state.db` 在 bootstrap 阶段不会因列缺失而失败；迁移块先执行 `ALTER TABLE ADD COLUMN` 再建索引，是 SQLite 兼容升级的标准做法。原报告行号指向修复前代码。
- **L-1 已修复**: `attention-scorer.ts` 中 `remember` 建议增加 `risk !== "high"` guard；新增单元测试覆盖高 relevance + high risk 组合。
- **L-2 已修复**: `attention-signal-validator.ts` 增加 invariant：若 `threadSuggestion` 为 `continue`/`pause`/`complete` 但缺少 `activityThreadId`，降级为 `none`；新增单元测试。
- **L-5 已修复**: `evidence-normalizer.ts` 中 UPDATE 失败不再 fallthrough 到 `writeEvidenceItem`，避免 `seenCount` 二次递增。
- **L-3 / L-4**: 保持 Low 建议状态，未在 Wave 120 内处理（`AttentionSignal` 字段补全涉及 schema 迁移；`changed` 路径测试需先确认 dedup 索引是否应切换到 `(platform_id, external_id)`）。

验证：`pnpm typecheck` / `pnpm build` / `pnpm build:plugin` / `pnpm test` 全绿（1750 tests, 1741 pass, 0 fail, 9 skipped）。
