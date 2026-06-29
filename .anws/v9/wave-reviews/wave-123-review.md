# Wave 123 Code Review — 2026-06-26

## 1. 总结结论

**Pass**

上一轮 re-review 标记的 2 项 Medium 与 2 项 Low 已全部在代码/测试/schema 中闭环：`CharacterFrame.validFrom`、`charCount`、`revisionOf`/`acceptedAt`、`validUntil` 均已落库；`character` family 作为非 `agent_contest` 信号唯一来源被阻断；CJK 边界与生命周期字段重读测试已补齐。本次静态走查未发现新的 Critical/High/Medium 阻断项，仅发现 2 处 Low 级契约/命名细节漂移，不影响 Wave 123 交付，可在后续波次顺手收紧。

---

## 2. 审查范围与静态边界

**已读（设计/任务/契约）**
- `.anws/v9/01_PRD.md`（US-007、US-008、G7、G8、NG1/NG6）
- `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`（System 7 / System 8 边界、Agent-boundary guardrails）
- `.anws/v9/03_ADR/ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md`
- `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md` 及 `.detail.md`（§1-§3.5、§5.1、§6.1）
- `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.md` 及 `.detail.md`（§2.1、§3.2、§5.1、§6.1）
- `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`（§3.6、§5、§8）
- `.anws/v9/05A_TASKS.md`（T7.2.1、T8.1.1 及依赖图）
- `.anws/v9/05B_VERIFICATION_PLAN.md`（T7.2.1、T8.1.1 验证矩阵）
- 上一轮 review `.anws/v9/wave-reviews/wave-123-review.md`

**已读（实现/测试）**
- `src/core/second-nature/character/character-refresh-input-normalizer.ts`
- `src/core/second-nature/character/frame-source-validator.ts`
- `src/core/second-nature/character/character-frame-builder.ts`
- `src/storage/v9-state-stores.ts`
- `src/storage/db/schema/v9-entities.ts`
- `src/storage/db/index.ts`
- `src/storage/db/migrations/v9-001-self-continuity.ts`
- `src/observability/services/autonomous-change-ledger.ts`
- `src/shared/types/v9-contracts.ts`
- `tests/unit/character/v9-character-refresh-input-normalizer.test.ts`
- `tests/unit/character/v9-character-frame-builder.test.ts`
- `tests/unit/observability/v9-ledger-store.test.ts`
- `tests/integration/v9/autonomous-change-ledger.test.ts`
- `tests/unit/contracts/v9-shared-contracts.test.ts`

**故意未执行**
- 未运行 `pnpm test` / `pnpm build` / `pnpm build:plugin` / `pnpm lint`；AGENTS.md 中记录的测试与构建结果属于运行时证据，不在本静态审查中重新证实。
- 未检查 plugin runtime 产物是否同步重建（Wave 123 未修改 plugin 源码）。
- 未读取 T7.2.2（CharacterFrame lifecycle/projection adapter）与 T5.2.2（SelfContinuityCard assembly）的实现，因其为本波下游依赖，不在 Wave 123 范围内。

**需人工/运行时验证**
- 全量 `pnpm test` 与构建门在 review-fix 后是否仍通过（AGENTS.md 已记录通过，本报告仅静态复核）。
- `CharacterFramePointer`/`EmbodiedContextCharacterProjection` 注入与 `CharacterFrameStorePort` → `v9-state-stores` 适配器将在 T7.2.2 验证。

---

## 3. 契约 → 代码映射摘要

| 契约承诺 | 实现区域 |
|---|---|
| `CharacterRefreshInput` 归一化：拒绝空信号、非法 source family、raw/private/prompt/credential 形状 | `src/core/second-nature/character/character-refresh-input-normalizer.ts:131-183` |
| `CharacterSignal` allowlist 与 redaction class 拦截；`character` family 非 `agent_contest` 阻断 | `src/core/second-nature/character/character-refresh-input-normalizer.ts:62-75`、`:106-112`、`:162-165` |
| Frame Source Validator：双语情绪断言、人格分数、identity lock、硬控制规则；顶层 sourceRefs 非空；contestPrompt 全规则扫描 | `src/core/second-nature/character/frame-source-validator.ts:71-153`、`:242-289` |
| CharacterFrame 五剖面提取（habits/value/relationship/expression/tensions）与冲突注释 | `src/core/second-nature/character/character-frame-builder.ts:154-308`、`:361-388` |
| CharacterFrame 自动 supersede、accepted 转换、生命周期字段持久化 | `src/core/second-nature/character/character-frame-builder.ts:518-537` |
| CharacterFrame / AutonomousChangeLedger 存储端口与 schema | `src/storage/v9-state-stores.ts:520-755`、`src/storage/db/schema/v9-entities.ts:201-327` |
| AutonomousChangeLedger 服务实现 `AutonomousChangeLedgerWritePort`，保留调用方 `id`/`createdAt` | `src/observability/services/autonomous-change-ledger.ts:69-99` |
| Canonical v9 契约类型（含 `kind: "input"` 的 `CharacterRefreshInput`） | `src/shared/types/v9-contracts.ts:270-313` |
| 字符预算按 UTF-8 bytes 截断与迭代压缩 | `src/core/second-nature/character/character-frame-builder.ts:107-128`、`:133-135`、`:466-506` |

---

## 4. Lens 结果摘要

- **L1 契约忠实度**：上一轮的 schema/生命周期漂移已修复；canonical `AutonomousChangeLedgerEntry` 被完整导入与实现，无本地重定义。剩余 Low：DB `character_frame.valid_from` 未声明 `notNull`，与 canonical required 字段存在可空漂移。
- **L2 任务兑现与交付闭合**：T7.2.1、T8.1.1 在 `05A_TASKS.md` 已勾选；builder、validator、normalizer、ledger service、state ports 均存在并有单元/集成测试承接。T7.2.2 / T5.2.2 仍为下游任务。
- **L3 架构适配与复杂度健康**：`character/` 目录职责聚焦；ledger service 仅封装读写，符合 observability-recovery-system 边界。`CharacterFrameStorePort` 仍为抽象端口，本波未提供到 `v9-state-stores` 的具体适配器（归 T7.2.2）。
- **L4 静态运行风险与安全边界**：未在变更代码中发现 credential/raw private 泄露路径；ledger payload redaction 明确委托给 T8.1.2。raw payload 检测为启发式，覆盖常见 key/token/Bearer/sk- 形状，但无法穷尽。
- **L5 验证证据与可观测性**：修复后测试覆盖了 id/`createdAt` 保真、CJK 900-byte 边界、`validFrom`/`validUntil`/`revisionOf`/`acceptedAt`/`charCount` 重读、identity-lock/hard-control 双语 fixture。`charCount` 未计入 `valuePosture.ordering` 文本，可能导致预算计数低估（Low）。
- **L6 回流一致性与交接证据**：AGENTS.md Wave 123 状态块与 `05A_TASKS.md` 任务勾选一致；新代码文件头均标注 design authority；未发现需要反向修补 ADR/System Design 的冲突。

---

## 5. Issues

### 已修复问题（review-fix 后）

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Medium (resolved) | L1+L3 | `CharacterFrame.validFrom` 必填字段未持久化 | 修复：`src/storage/db/schema/v9-entities.ts:211` 增加 `valid_from` 列；`src/storage/db/migrations/v9-001-self-continuity.ts:128` 与 `src/storage/db/index.ts:603/746` 同步补列；`src/core/second-nature/character/character-frame-builder.ts:450` 设置 `validFrom`；`src/storage/v9-state-stores.ts:552` 写入。测试 `tests/integration/v9/autonomous-change-ledger.test.ts:124` 验证持久化 | canonical 数据模型与存储 schema 漂移；按有效期过滤/重读丢失生效时间 | 已修复：schema + builder + state store + 测试 | `shared-v9-contracts.md §5.1`、`character-continuity-system.md §6.1` |
| Medium (resolved) | L1+L3 | `CharacterFrame.charCount` 必填字段未持久化 | 修复：`src/storage/db/schema/v9-entities.ts:214` 增加 `char_count INTEGER NOT NULL DEFAULT 0`；`src/storage/db/migrations/v9-001-self-continuity.ts:131` 与 `src/storage/db/index.ts:607/747` 同步补列；builder `:466/532` 计算并传入；`src/storage/v9-state-stores.ts:555` 写入。测试 `tests/integration/v9/autonomous-change-ledger.test.ts:137` 验证 | 预算字段在持久化后丢失 | 已修复：schema + builder + state store + 测试 | `shared-v9-contracts.md §5.1` |
| Medium (resolved) | L1+L3 | `revisionOf`/`acceptedAt` 仅在内存设置 | 修复：`CharacterFrameStorePort.updateFrameLifecycle` 签名扩展 `revisionOf`/`acceptedAt`/`charCount`（`character-frame-builder.ts:55-66`）；builder `:529-533` 调用；`src/storage/v9-state-stores.ts:617-628` 支持这些 patch；测试 `tests/unit/character/v9-character-frame-builder.test.ts:288-292` 重读验证 | 版本谱系与接受时间在持久化后丢失 | 已修复：端口签名 + builder + store + 测试 | `shared-v9-contracts.md §5.1`、`character-continuity-system.detail.md §3.1` |
| Low (resolved) | L1 | `FrameSourceValidator` 未阻止 `character` family 成为新 posture 的唯一来源 | 修复：`src/core/second-nature/character/character-refresh-input-normalizer.ts:106-112` 增加 `hasOnlyCharacterFamilySourceRefs` / `containsOnlyCharacterLineage`；`:162-165` 对非 `agent_contest` 的纯 `character` 来源返回 `character_refresh_input_redacted`。测试 `tests/unit/character/v9-character-refresh-input-normalizer.test.ts:118-125` 覆盖 | posture 可能仅由上一轮 character projection 推导，减弱 source-backed/embodied 保证 | 已修复：输入 normalizer 层阻断 + 测试 | `shared-v9-contracts.md §5.4`、`character-continuity-system.detail.md §2.4` |
| Low (resolved) | L5 | 缺少 CJK 边界与 `validFrom`/`revisionOf`/`charCount` 重读测试 | 修复：`tests/unit/character/v9-character-frame-builder.test.ts:236-251` 加入 CJK 长 summary 预算断言；`:253-293` 在 supersede 后重读 store 验证 `revisionOf`/`acceptedAt`/`charCount`/`validUntil` | 多字节截断与生命周期字段持久化无法被静态确认 | 已修复：CJK fixture + store round-trip 断言 | `05B_VERIFICATION_PLAN.md#t7-2-1` |

### 新问题（final review 发现）

#### Low

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Low | L1+L3 | `CharacterFrame.validFrom` 已持久化但 DB 列未声明 `notNull` | `src/storage/db/schema/v9-entities.ts:211` 声明 `validFrom: text("valid_from")`，无 `.notNull()`；`src/storage/v9-state-stores.ts:528/552` 的 `WriteCharacterFrameOptions.validFrom` 与 row 写入均为可选 | canonical 类型要求 `validFrom: string`，但 schema/写入路径允许 `null`，存在未来调用方遗漏设置的空值风险 | 将 schema 改为 `validFrom: text("valid_from").notNull()`，并同步使 `WriteCharacterFrameOptions.validFrom` 必填 | `shared-v9-contracts.md §5.1`、`character-continuity-system.md §6.1` |
| Low | L1+L5 | `charCount` 未计入 `valuePosture.ordering` 文本 | `src/core/second-nature/character/character-frame-builder.ts:390-403` 的 `charCountOfTextualParts` 包含 `valuePosture?.note` 但未包含 `valuePosture.ordering` 数组；`collectShortLabels` 中每个 label 最长 40 字符，最多 5 条，可能低估约 200 bytes | `charCount` 可能低于实际文本 bytes，极端情况下序列化后可能突破 900-byte 预算而不触发截断 | 将 `valuePosture.ordering.join("")` 计入 `charCountOfTextualParts`，并为长 ordering 补充边界测试 | `shared-v9-contracts.md §5.1`、PRD `US-008` |

---

## 6. 安全 / 测试覆盖补充

**已确认的安全边界**
- `character-refresh-input-normalizer.ts` 在入口层阻断 `credential_blocked`/`prompt_blocked`/`private_blocked` 信号，并对 summary 做常见 raw credential 模式扫描（password、token、api key、secret、Bearer、sk-/pk- 等）。
- `frame-source-validator.ts` 的双语规则集覆盖了 PRD/ADR 明确禁止的情绪断言、人格分数、identity lock、硬控制命令；contestPrompt 也参与全规则扫描。
- `AutonomousChangeLedgerService` 不将原始 payload 暴露给 read model；redacted payload 由调用方提供，T8.1.2 的 redaction projector 将负责写入前扫描。
- `src/storage/v9-state-stores.ts` 对所有 v9 写入端口执行 `sourceRefs` 非空校验，并在读路径返回 `DegradedOperationResult` 而非抛出。

**无法通过静态审查确认的边界**
- `CharacterFrameStorePort` 到 `v9-state-stores` 的具体适配器不在本波范围内，builder 的 `writeCandidateFrame`/`updateFrameLifecycle` 与真实 DB 的端到端持久化需 T7.2.2 完成后验证。
- 全量测试实际通过状态、plugin 构建产物是否同步、运行时 CJK 字符预算是否真越界，需运行 `pnpm test` / `pnpm build` / 补充边界 fixture 验证（AGENTS.md 已记录通过，本报告不复核）。
- `RAW_PAYLOAD_PATTERNS` 是否足以覆盖所有 raw credential/private 输入形状，需依赖 T8.1.2 redaction projector 与后续审计测试。

**建议的后续优先级**
1. **P2（Low）**：将 `character_frame.valid_from` 改为 `notNull`，与 canonical required 类型对齐。
2. **P2（Low）**：把 `valuePosture.ordering` 文本计入 `charCount`，确保 900-byte 预算守卫完整。
