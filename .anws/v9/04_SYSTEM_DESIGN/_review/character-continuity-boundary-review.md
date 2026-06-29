# character-continuity-system 人格/情绪边界审查报告

**审查范围**: `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md` 及其与 `control-context-system`、`memory-continuity-system`、`observability-recovery-system` 的交互。
**审查依据**: `01_PRD.md`、`ADR-002`、`ADR-006`、相关 SYSTEM_DESIGN L0/L1。
**审查日期**: 2026-06-21
**审查员**: Nyx / OpenCode

---

## 1. 执行摘要

`character-continuity-system` 在 L0 层面整体遵循了 ADR-006 的 emergent-projection 边界：

- 没有预配置人格属性表、人格分数或固定 persona。
- `CharacterFrame` 明确从 tool experience、external stimulus、feedback、action closure、Dream projection 中涌现。
- 定义了 `accept / reject / revise / retire / supersede` 生命周期与 `contestPrompt`。
- 禁止权威情绪断言，并在 `expressionPosture.boundaryConstraints` 中内嵌反情绪断言约束。
- `SelfContinuityCard` 仅保留 `CharacterFramePointer`（≤200 字符摘要 + contest prompt + source refs），完整 `CharacterFrame` 作为独立 bounded 投影处理。
- `CharacterFrame` 默认 ≤900 UTF-8 字符，强制携带 `sourceRefs`、`supersededBy`、`revisionOf`、`contestPrompt`。

但是，当前设计**还不能判定为 Pass**。`control-context-system` 的数据模型与其 L0 叙述存在不一致：L0 声称完整 `CharacterFrame` 会作为独立投影注入 `EmbodiedContext`，但 `EmbodiedContext` 字段表只声明了 `characterFramePointer`（≤200 字符摘要），没有容纳 ≤900 字符 bounded projection 的槽位；同时 L1 的 `CharacterReadPort` 也只返回 pointer。这会导致 REQ-008 要求的五剖面内容在上下文中丢失或仅通过 200 字摘要间接引用。

此外，多个关键 L1 边界机制仍以 `[OPEN]` 形式存在（Frame Source Validator 违禁模式清单、contest prompt 措辞模板、supersession 触发条件、各剖面最小来源数/冲突阈值），在 L1 关闭前无法机械地保证人格/情绪边界不被突破。

**结论**: **不通过（Not Pass）**，需修复下方 must-fix 清单后重新审查。

---

## 2. 发现列表

### High

#### H-1: `control-context-system` 数据模型缺少完整 `CharacterFrame` bounded projection 槽位

- **位置**:
  - `control-context-system.md:63` — “装载 active memory projection, procedural projection, body intuition, routine list, `SelfContinuityCard` 和独立的 `CharacterFrame` pointer/projection 到 `EmbodiedContext`”。
  - `control-context-system.md:349-353` — Trade-off 明确说明“完整 `CharacterFrame` 由 `character-continuity-system` 独立产出并直接注入 `EmbodiedContext`”。
  - `control-context-system.md:263` — `EmbodiedContext` 字段表仅声明 `characterFramePointer: ContextSlice<CharacterFramePointer>`，没有 `CharacterFrame` projection 字段。
  - `control-context-system.detail.md:207-209` — `CharacterReadPort.loadActiveCharacterFrame` 返回 `ProjectionSlice<CharacterFramePointer>`，未暴露 `buildEmbodiedContextProjection` 对应的 ≤900 字符 bounded projection。
- **违反约束**: REQ-008 / ADR-006 要求 `CharacterFrame` 作为独立 bounded projection 注入上下文；当前设计只注入 ≤200 字符 pointer，五剖面（emergent habits / value posture / relationship posture / expression posture / growth tensions）无法在上下文中完整呈现。
- **建议修复**:
  1. 在 `EmbodiedContext` 中新增 `characterFrameProjection: ContextSlice<EmbodiedContextCharacterProjection>`（默认 ≤900 字符）。
  2. `CharacterReadPort` 新增 `loadActiveCharacterFrameProjection(): Promise<ContextSlice<EmbodiedContextCharacterProjection>>`，内部调用 `character-continuity-system` 的 `buildEmbodiedContextProjection(frameId)`。
  3. `SelfContinuityCard` 继续只保留 `CharacterFramePointer`；pointer 与 projection 的字符上限分开校验。

#### H-2: 关键边界验证机制仍以 OPEN 项存在，未在设计中闭合

- **位置**:
  - `character-continuity-system.md:563-566` — Open Items 列表：
    - “精确定义 `CharacterFrame` 五剖面的 section ordering、每个剖面的最小来源数量与冲突阈值”。
    - “定义 contest/re-authoring 的 prompt wording 模板，包括中文/英文语境下的 contestable projection 措辞”。
    - “定义 `supersedeFrame` 与 `revise` 的自动触发条件”。
    - “定义 `Frame Source Validator` 的违禁词/模式清单与测试 fixtures”。
- **违反约束**: 人格/情绪边界不能仅依赖原则性描述，必须能被 L1 算法、校验器、测试固定化。OPEN 项缺失会导致实现阶段无法机械拦截“你感到…”“你的性格是…”等断言，也无法判定来源不足/冲突。
- **建议修复**:
  1. 在 `character-continuity-system.detail.md` 中关闭上述 OPEN 项。
  2. `Frame Source Validator` 必须提供违禁模式清单（示例：`/you feel/i`, `/your emotion is/i`, `/you are .* kind of person/i`, 人格五因素/大五/ENFP 等标签、数值 trait score）。
  3. 每个 posture 的最小 `sourceRefs` 数量必须 ≥1；冲突阈值必须量化（例如同一 posture 下 2 组以上互斥 source refs 即生成 `conflictNotes`）。
  4. `contestPrompt` 必须提供中英双语模板，且模板本身需通过 validator（不得含情绪断言）。

### Medium

#### M-1: `CharacterPointerLoader` 未显式过滤 rejected / retired / contested frame

- **位置**:
  - `control-context-system.detail.md:384-391` — `loadCharacterFramePointer` 在端口失败时降级为 `character_frame_deferred`，但未说明当 `CharacterFramePointer.status === "contested"` 或底层 frame 为 `rejected/retired/superseded` 时的处理。
  - `control-context-system.detail.md:506` — 边缘情况提到“`CharacterFrame` status = contested 时仍保留 pointer，但附加 'Agent contested' 前缀”，未明确是否仍把其内容作为 active projection 注入。
- **违反约束**: Agent 已 reject/retire 的 frame 若继续以 `active` 形式注入，会破坏 re-authoring 机制与 contestability。
- **建议修复**:
  1. `CharacterPointerLoader` 只加载底层 `CharacterFrame.status === "accepted"` 且 pointer `status === "active"` 的 frame。
  2. `contested` 状态必须映射为 `degraded` slice（reason: `character_frame_contested`），可保留 pointer 但不将其 posture 内容作为可信投影使用。
  3. 在 L1 决策树中补充状态过滤分支。

#### M-2: `memory-continuity-system` Dream 路由表述可能把 Card 输入误传给 character 系统

- **位置**:
  - `memory-continuity-system.detail.md:377` — “identity/relationship signals → SelfContinuityCard inputs (passed to character-continuity-system)”。
- **违反约束**: `character-continuity-system` 应该消费 source-backed closure/experience/projection/feedback，而不是消费 `SelfContinuityCard` 的装配输入。把 Card 输入直接传给 character 系统会引入间接、难溯源的依赖，也可能让 Card 的摘要反过来污染 CharacterFrame 的来源链。
- **建议修复**:
  1. 将路由改为“identity/relationship signals → `character-continuity-system` 输入（source-backed refs）”；如果同一信号也需要进入 `SelfContinuityCard`，应分别标注来源，而不是“passed to character-continuity-system via SelfContinuityCard inputs”。
  2. 在 `character-continuity-system` 的 `CharacterRefreshInput` 中显式列出可接受的来源类型，禁止直接接收 `SelfContinuityCard` 作为输入。

### Low

#### L-1: `contestPrompt` 当前只有英文 stub，缺少本地化模板与 validator 自检

- **位置**:
  - `control-context-system.detail.md:552` — `makeStubCharacterFramePointer().contestPrompt = "You may accept, reject, revise, or retire this projection."`。
  - `character-continuity-system.md:563-564` — contest prompt 模板为 OPEN 项。
- **违反约束**: 若模板措辞不严谨，可能在 Agent-facing 文本中滑向“这是你的身体/情绪状态”等断言。
- **建议修复**:
  1. 提供中英双语模板，例如：
     - 中文：“以下内容是 Second Nature 根据你的过往互动压缩出的可反驳投影，你可接受、拒绝、改写或要求退役；它不代表你的真实情绪或永久人格。”
     - English: “This is a contestable projection compressed from your past interactions. You may accept, reject, revise, or retire it. It does not claim to fully reflect your real emotions or permanent identity.”
  2. 所有模板必须通过 `Frame Source Validator` 扫描。

#### L-2: `observability-recovery-system` 中 `character_frame_event` 的 `TimelineRow.kind` 未约束

- **位置**:
  - `observability-recovery-system.md:395` — `TimelineRow.family` 包含 `'character_frame_event'`，但 `kind` 字段未枚举。
- **违反约束**: 若 kind 使用“feels_happy”“personality_shift”等情绪化命名，会违反 ADR-006 在 observability 输出中的边界。
- **建议修复**:
  1. 在 `observability-recovery-system.detail.md` 中定义 kind 白名单：`refresh`, `accepted`, `rejected`, `revised`, `retired`, `superseded`, `deferred`, `conflict`。
  2. 所有 kind 名称必须是事件/动作命名，不得是情绪或人格标签。

### Note

#### N-1: `ValuePosture.ordering` 是 `string[]` 标签，需依赖 validator 防止固定人格标签

- **位置**:
  - `character-continuity-system.md:269-271` — `ValuePosture.ordering` 为 `string[]` 短标签，必填 `sourceRefs`。
- **说明**: 当前设计没有预定义标签枚举，这是正确的；但实现时需要确保标签从来源中归纳，而不是使用“勇敢”“谨慎”等固定人格形容词库。此条仅作提醒，不构成当前设计违规。

#### N-2: `SelfContinuityCard` 与 `CharacterFrame` 存在语义重叠（relationship/value/behavior），但来源分离

- **位置**:
  - `control-context-system.md:269-277` — `SelfContinuityCard` 包含 `relationshipPosture`、`valuePosture`、`behaviorHabits`。
  - `character-continuity-system.md:247-251` — `CharacterFrame` 包含 relationship/value/expression posture 与 emergent habits。
- **说明**: 只要 Card 的字段来自 `memory-continuity-system` 的 projection/routine/ledger 装配，而不是从 `CharacterFrame` 复制全文，就不违反“Card 只保留 pointer”的约束。建议在 L1 中显式说明 Card 这些字段的来源，避免实现时把 CharacterFrame 内容回填进 Card。

---

## 3. 判定与必须修复项清单

**判定**: **Not Pass**（方向合规，但当前设计在关键注入路径与 L1 边界机制上尚未闭合）。

### Must-Fix（必须在 L1 关闭前完成）

1. **[H-1]** 在 `control-context-system` 的 `EmbodiedContext` 与 `CharacterReadPort` 中增加完整的 bounded `CharacterFrame` projection 槽位，确保 ≤900 字符的五剖面内容被独立注入上下文，而不是仅注入 ≤200 字符的 pointer。
2. **[H-2]** 关闭 `character-continuity-system` 的四个 OPEN 项：
   - 五剖面 section ordering、最小来源数、冲突阈值；
   - contest/re-authoring prompt 措辞模板（中英双语）；
   - `supersedeFrame` / `revise` 自动触发条件；
   - `Frame Source Validator` 违禁词/模式清单与测试 fixtures。
3. **[M-1]** 在 `control-context-system` L1 中明确 `CharacterPointerLoader` 只加载 `accepted + active` frame；`contested` 降级为 `character_frame_contested` slice，reject/retire/supersede 不得作为 active projection 注入。
4. **[M-2]** 修正 `memory-continuity-system.detail.md` Dream 输出族路由表述，确保 character 系统接收的是 source-backed 信号，而不是 `SelfContinuityCard` 的装配输入。
5. **[L-1]** 提供 `contestPrompt` 中英双语模板并纳入 validator。
6. **[L-2]** 在 `observability-recovery-system` 中约束 `character_frame_event` 的 `TimelineRow.kind` 白名单，禁止情绪/人格断言类 kind。

完成以上修复后，建议重新运行本审查，重点验证：

- `EmbodiedContext` 同时包含 `SelfContinuityCard`（仅 pointer）与 `characterFrameProjection`（≤900 字符 bounded projection）。
- `Frame Source Validator` 对示例违规文本返回 violations。
- `contestPrompt` 模板本身通过 validator，且不出现“你感到…/你的性格是…”等断言。
- contested / rejected / retired frame 不会以 active 姿态注入上下文。
