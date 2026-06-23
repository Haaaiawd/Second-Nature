# character-continuity-system 边界审查 — 第二轮

> **审查范围**: Second Nature v9 `character-continuity-system` 及其与 `control-context-system`、`memory-continuity-system`、`observability-recovery-system` 的边界。
> **审查目标**: 验证上一轮 must-fix 是否已关闭，并记录新发现。
> **审查日期**: 2026-06-22
> **审查员**: Nyx / OpenCode

---

## 1. 执行摘要与最终判定

本轮审查对照上一轮 6 项 must-fix 逐项核验。所有 High/Medium 项均已关闭；Low 项（contestPrompt 模板、observability kind 白名单）已落实。**本轮最终判定：Pass**。

保留一项新发现： canonical `shared-v9-contracts.md` 与 `character-continuity-system.md` 对 `CharacterFrame.emergentHabits` / `growthTensions` 的字段类型存在不一致，建议在 `/forge` 前由跨系统审查统一。该问题不阻塞本轮 must-fix 验收。

---

## 2. Must-fix 修复状态表

| 编号 | 审查项 | 判定 | 证据位置 | 说明 |
|------|--------|------|----------|------|
| **H-1** | `EmbodiedContext` 有独立 `characterFrameProjection` 槽位（≤900 字符），`SelfContinuityCard` 只保留 pointer | **已关闭** | `control-context-system.md` §6.1 数据模型：`EmbodiedContext` 同时包含 `characterFramePointer` 与 `characterFrameProjection` 两个独立切片；`SelfContinuityCard` 仅含 `characterFramePointer` | 边界清晰；`EmbodiedContextCharacterProjection.text` ≤900 UTF-8 chars，`CharacterFramePointer.summary` ≤200 chars |
| **H-2** | `character-continuity-system.detail.md` 关闭四个 OPEN 项 | **已关闭（test fixtures 未在 L1 显式落地，见备注）** | L1 §1.1 section ordering；§1 常量 `MIN_SOURCE_REFS_PER_POSTURE=1`、`CONFLICT_THRESHOLD_DIVERGENT_SOURCES=2`；§3.4 `Frame Source Validator`；§3.5 `detectConflictNotes`；§4.3 supersede/revise 触发条件；§5.1 中英双语 contestPrompt 模板 | 四个 OPEN 项均已在 L1 有对应关闭内容。备注：`Frame Source Validator` 的“测试 fixtures”未在 L1 单独成节，但 §6 契约矩阵已要求单元测试覆盖；如 `/forge` 阶段需要可复用 fixtures，建议在验证计划中显式列出 |
| **M-1** | `CharacterPointerLoader` 只加载 `accepted + active` frame，`contested` 降级 | **已关闭** | `control-context-system.detail.md` §3.5 `loadCharacterFramePointer` 伪代码及注释："只加载底层 accepted + active 的 frame；contested 降级为 character_frame_contested slice" | 状态映射逻辑完整，`rejected`/`retired`/`superseded` 不会被注入为 active |
| **M-2** | `memory-continuity-system` 不再把 `SelfContinuityCard` 装配输入传给 character 系统 | **已关闭** | `memory-continuity-system.detail.md` §3.4 `runDreamConsolidation`：仅调用 `characterContinuity.refreshCharacterFrame({ sourceRefs: review.characterSignals })`；代码注释明确“仅传递 source-backed refs；不传递 card 装配输入” | 切断跨系统耦合，符合 ADR-006 要求 |
| **L-1/L-2** | contestPrompt 模板与 observability kind 白名单落实 | **已关闭** | `character-continuity-system.detail.md` §5.1 中英双语模板；`observability-recovery-system.detail.md` §1.5a `CHARACTER_FRAME_EVENT_KINDS` 白名单 | 模板通过 validator（无情绪断言）；白名单仅使用动作/事件命名，禁止人格/情绪标签 |
| **-** | 无 injected personality / no programmatic emotion claim | **已关闭** | ADR-006；PRD NG1/NG6；`character-continuity-system.md` §2.2 Non-Goals；L1 §3.4 `Frame Source Validator` 拦截 `emotion_assertion` / `personality_score` / `personality_label` / `hard_control_rule` | 设计与约束一致，未出现人格分数、情绪量表或硬控制规则 |

---

## 3. 新发现

### 3.1 数据模型不一致：`CharacterFrame.emergentHabits` / `growthTensions` 类型分歧

- **位置**:
  - `shared-v9-contracts.md` §5.1 定义 `emergentHabits: string[]`、`growthTensions: string[]`。
  - `character-continuity-system.md` §6.1 定义 `emergentHabits: EmergentHabit[]`、`growthTensions: GrowthTension[]`，每项强制携带 `sourceRefs`。
- **严重度**: Low–Medium（设计不一致，可能导致 `/forge` 实现漂移）。
- **建议**: 在 `/forge` 前由 `/challenge` 或跨系统审查统一 canonical shape。推荐保留结构化数组（`EmergentHabit[]` / `GrowthTension[]`），因为 [REQ-008] 要求每个 posture 携带 source refs；如 shared contracts 需要更简化的视图，应显式说明其为 read-model projection，而非 source-of-truth schema。

### 3.2 `shared-v9-contracts.md` §5.1 `CharacterFrame` 缺少 L0 定义的若干字段

- 缺失字段：`charCount`、`validFrom`、`validUntil`（`character-continuity-system.md` §6.1 已声明）。
- 严重度：Low。
- 建议：同步 shared contracts，或在 contracts 中注明“系统 L0 可扩展元数据字段”。

### 3.3 `Frame Source Validator` 对 contestPrompt 的违禁模式检查范围

- L1 §3.4 仅对 `contestPrompt` 检查 `emotion_assertion` 规则；其他违禁模式（`personality_score`、`hard_control_rule` 等）仅检查 frame 正文。
- 当前双语模板本身不含这些模式，因此不构成功能缺陷；但从防御性设计角度，可考虑对 `contestPrompt` 应用完整规则集。
- 严重度：Low（建议项，非阻塞）。

---

## 4. 结论

上一轮 must-fix 已全部关闭。`character-continuity-system` 与周边系统的边界符合 ADR-006、PRD [REQ-008] 及 v9 架构约束：`CharacterFrame` 是独立的可反驳投影，`SelfContinuityCard` 仅保留短指针，`memory-continuity-system` 不再越界传递 card 装配输入，`CharacterPointerLoader` 正确过滤 `accepted + active` 状态并降级 `contested`。

唯一需要在 `/forge` 前处理的是 `shared-v9-contracts.md` 与 `character-continuity-system.md` 之间的字段类型不一致，避免 canonical contracts 与系统实现产生分歧。

**最终判定：Pass**。
