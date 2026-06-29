# character-continuity-system L1 实现层

> **文件性质**: L1 实现层 · **对应 L0**: [`character-continuity-system.md`](./character-continuity-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **孤岛检查**: 本文件各节均须在 L0 有对应超链接入口。

---

## 版本历史

| 版本 | 日期       | Changelog |
| ---- | ---------- | --------- |
| v1.0 | 2026-06-21 | 初始 L1；关闭 H-2 四个 OPEN 项，定义 Frame Source Validator、contest prompt、supersede/revise 触发条件、section ordering 与来源阈值 |

---

## 本文件章节索引

|   §   | 章节                                                         | 对应 L0 入口           |
| :---: | ------------------------------------------------------------ | ---------------------- |
|  §1   | [配置常量](#1-配置常量-config-constants)                     | L0 §6 / §10            |
|  §2   | [完整数据结构](#2-完整数据结构-full-data-structures)         | L0 §6 数据模型         |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5.1 操作契约表     |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details)    | L0 §4 架构图 / 数据流  |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §5 / §9             |
|  §6   | [契约验证矩阵详细版](#6-契约验证矩阵详细版)                  | L0 §11.5 测试策略      |

---

## §1 配置常量 (Config Constants)

> **L0 对应入口**: L0 §6 数据模型、§10 性能考虑

| 常量 | 值 | 说明 | 来源 |
| ---- | --- | ---- | ---- |
| `CHARACTER_FRAME_MAX_CHARS` | `900` | 投影正文 UTF-8 长度上限 | PRD US-008 |
| `CHARACTER_POINTER_SUMMARY_MAX_CHARS` | `200` | `CharacterFramePointer.summary` 上限 | shared-v9-contracts §5.2 |
| `CONTEST_PROMPT_MAX_CHARS` | `300` | `contestPrompt` 长度上限 | shared-v9-contracts §5 |
| `MIN_SOURCE_REFS_PER_POSTURE` | `1` | 每个 posture 最少 source refs 数 | H-2 |
| `CONFLICT_THRESHOLD_DIVERGENT_SOURCES` | `2` | 同一 posture 下互斥来源组数 ≥2 即生成 conflict note | H-2 |
| `SECTION_ORDER` | `见下表` | 五剖面序列化顺序 | H-2 |

### §1.1 Section Ordering

`CharacterFrame` 五剖面在序列化、渲染、contest 展示时按以下固定顺序：

1. `emergentHabits`
2. `valuePosture`
3. `relationshipPosture`
4. `expressionPosture`
5. `growthTensions`

每个剖面内部按 `sourceRefs` 数量降序排列；数量相同则按置信度 `high > medium > low` 排列。

### §1.2 EmbodiedContextCharacterProjection 状态

```typescript
type EmbodiedContextCharacterProjectionStatus = "active" | "deferred" | "contested";
```

- `active`: 底层 frame 为 `accepted`，pointer status 为 `active`，未被 Agent contest。
- `deferred`: 无 accepted frame 或读取失败；projection 降级为 `character_frame_deferred` slice。
- `contested`: Agent 已对当前 frame 发起 contest，但系统尚未接受新的 revision/supersede。

---

## §2 完整数据结构 (Full Data Structures)

> **L0 对应入口**: L0 §6.1 核心实体

### §2.1 生命周期状态（与 shared-v9-contracts 对齐）

```typescript
// CharacterFrame 生命周期状态（character-continuity-system 拥有）
type CharacterFrameStatus = "candidate" | "accepted" | "rejected" | "retired" | "superseded";

// CharacterFramePointer 状态（control-context-system 拥有，反映运行时注入姿态）
type CharacterFramePointerStatus = "active" | "deferred" | "contested" | "superseded";
```

规则：
- `contested` 不是 `CharacterFrame` 状态；它是 Agent 对 pointer/projection 的运行时动作。
- 只有 `CharacterFrame.status === "accepted"` 的 frame 才能被注入为 `active` pointer/projection。
- `rejected` / `retired` / `superseded` frame 不得作为 active projection 注入。

### §2.2 Contest / Re-authoring 动作

```typescript
type CharacterContestAction = "accept" | "reject" | "revise" | "retire";

interface CharacterContestResult {
  frameId: string;
  previousStatus: CharacterFrameStatus;
  newStatus: CharacterFrameStatus;
  successorFrameId?: string; // revise/supersede 时生成
  sourceRefs: SourceRef[];
}
```

### §2.3 Frame Source Validator 输出

```typescript
interface FrameSourceViolation {
  rule: FrameSourceRule;
  matchedText: string;
  location: string; // 剖面路径，如 "relationshipPosture.stance"
}

type FrameSourceRule =
  | "emotion_assertion"
  | "personality_score"
  | "personality_label"
  | "hard_control_rule"
  | "empty_source_posture"
  | "source_count_below_minimum"
  | "contest_prompt_contains_assertion";

interface FrameValidationResult {
  ok: boolean;
  violations: FrameSourceViolation[];
}
```

### §2.4 CharacterRefreshInput / CharacterSignal

`CharacterRefreshInput` 与 `CharacterSignal` 的 canonical shape 以 [`shared-v9-contracts.md`](./shared-v9-contracts.md) §5.4 为准，本 L1 只补充实现侧校验点。

```typescript
type CharacterSignalKind =
  | "tool_experience"
  | "action_closure"
  | "owner_feedback"
  | "relationship_signal"
  | "expression_outcome"
  | "dream_projection"
  | "agent_contest";

type CharacterInputBlockedReason =
  | "character_refresh_input_invalid"
  | "character_refresh_input_redacted"
  | "character_frame_insufficient_sources";

const CHARACTER_SIGNAL_ALLOWED_SOURCE_FAMILIES = [
  "evidence",
  "action",
  "routine",
  "character",
  "dream",
  "quiet",
  "connector",
  "ledger",
] as const;
```

Rules:
- `summary` is a redacted summary only; raw private content, raw prompt text and credential values are forbidden before posture extraction.
- `character` source refs are allowed only for contest/revision lineage and cannot be the sole source of a new posture claim.
- `credential_blocked`, `prompt_blocked`, and `private_blocked` signals produce deferred reasons and cannot contribute posture text.

### §2.5 SourceRef 规则

所有 `CharacterFrame` source refs 遵循 [`shared-v9-contracts.md`](./shared-v9-contracts.md) §1 canonical shape。`family` 取值：`evidence` | `action` | `routine` | `character` | `dream` | `quiet` | `connector`。

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

> **L0 对应入口**: L0 §5.1 操作契约表

### §3.0 `normalizeCharacterRefreshInput`

**对应契约**: L0 §5.1 `normalizeCharacterRefreshInput(...)`
**准入理由**: Agent-facing projection 的输入边界必须先被机械约束。

```typescript
function normalizeCharacterRefreshInput(rawSignals, context): CharacterRefreshInput | CharacterFrameResult {
  const signals = rawSignals.map(toCharacterSignal);
  if (signals.length === 0) {
    return { kind: "deferred", reason: "character_frame_insufficient_sources", sourceRefs: [] };
  }

  const sourceRefs = deduplicateSourceRefs(signals.flatMap((s) => s.sourceRefs));
  if (sourceRefs.length === 0) {
    return { kind: "deferred", reason: "character_frame_insufficient_sources", sourceRefs: [] };
  }

  for (const signal of signals) {
    if (!hasOnlyAllowedSourceFamilies(signal.sourceRefs)) {
      return { kind: "deferred", reason: "character_refresh_input_invalid", sourceRefs };
    }
    if (containsRawPayloadShape(signal.summary) || signal.redactionClass === "credential_blocked" || signal.redactionClass === "prompt_blocked" || signal.redactionClass === "private_blocked") {
      return { kind: "deferred", reason: "character_refresh_input_redacted", sourceRefs };
    }
  }

  return {
    refreshId: context.refreshId,
    workspaceRoot: context.workspaceRoot,
    locale: inferLocale(signals),
    trigger: context.trigger,
    signals,
    sourceRefs,
    createdAt: now(),
  };
}
```

### §3.1 `refreshCharacterFrame`

**对应契约**: L0 §5.1 `refreshCharacterFrame(...)`
**准入理由**: 五剖面聚合 + 验证 + 降级。

```typescript
async function refreshCharacterFrame(
  input: CharacterRefreshInput,
  store: CharacterFrameStorePort,
  validator: FrameSourceValidator,
): Promise<CharacterFrameResult> {
  const normalized = isCharacterRefreshInput(input) ? input : normalizeCharacterRefreshInput(input, makeRefreshContext());
  if (normalized.kind === "deferred") return normalized;
  input = normalized;

  const sections = buildSections(input);

  const candidate: CharacterFrame = {
    id: generateId(),
    version: await nextVersion(store),
    status: "candidate",
    emergentHabits: sections.habits,
    valuePosture: sections.value,
    relationshipPosture: sections.relationship,
    expressionPosture: sections.expression,
    growthTensions: sections.tensions,
    contestPrompt: makeContestPrompt(input.locale),
    sourceRefs: deduplicateSourceRefs(sections.allSourceRefs),
    createdAt: now(),
  };

  const validation = validator.validate(candidate);
  if (!validation.ok || sections.allSourceRefs.length === 0) {
    return {
      kind: "deferred",
      reason: validation.violations.map((v) => v.rule).join(",") || "character_frame_insufficient_sources",
      sourceRefs: candidate.sourceRefs,
    };
  }

  await store.writeCandidateFrame(candidate);

  // 自动 supersede 上一 accepted frame（若存在）；该策略用于 continuity 可用性，不能被解释为 Agent 已认同。
  const previous = await store.readLatestAcceptedFrame();
  if (previous) {
    await store.updateFrameLifecycle(previous.id, "superseded", { supersededBy: candidate.id });
    candidate.revisionOf = previous.id;
  }

  // 默认 candidate → accepted，但首次注入必须携带 newlyProposed/contestable 标记。
  await store.updateFrameLifecycle(candidate.id, "accepted", { newlyProposed: true });
  candidate.status = "accepted";

  return { kind: "accepted", frame: candidate };
}
```

### §3.2 `applyCharacterContest`

**对应契约**: L0 §5.1 `applyCharacterContest(...)`
**准入理由**: 状态机转换。

```typescript
async function applyCharacterContest(
  frameId: string,
  action: CharacterContestAction,
  reason?: string,
  store: CharacterFrameStorePort,
): Promise<CharacterContestResult> {
  const frame = await store.readFrameById(frameId);
  if (!frame) throw new Error("frame_not_found");

  const validTransitions: Record<CharacterFrameStatus, CharacterContestAction[]> = {
    candidate: ["accept", "reject", "revise"],
    accepted: ["reject", "revise", "retire"],
    rejected: ["revise"],
    retired: ["revise"],
    superseded: [],
  };

  if (!validTransitions[frame.status].includes(action)) {
    throw new Error(`invalid_contest_action:${frame.status}-${action}`);
  }

  const newStatusMap: Record<CharacterContestAction, CharacterFrameStatus> = {
    accept: "accepted",
    reject: "rejected",
    revise: "candidate", // 生成 revision candidate，待验证后 accepted
    retire: "retired",
  };

  let successorFrameId: string | undefined;
  if (action === "revise") {
    const revision = await createRevisionCandidate(frame, reason);
    successorFrameId = revision.id;
    await store.writeCandidateFrame(revision);
  }

  const previousStatus = frame.status;
  const newStatus = newStatusMap[action];
  await store.updateFrameLifecycle(frame.id, newStatus, { successorFrameId });

  return {
    frameId: frame.id,
    previousStatus,
    newStatus,
    successorFrameId,
    sourceRefs: [{ family: "character", id: frame.id }],
  };
}
```

### §3.3 `buildEmbodiedContextProjection`

**对应契约**: L0 §5.1 `buildEmbodiedContextProjection(...)`
**准入理由**: bounded 序列化 + contestable 标注。

```typescript
function buildEmbodiedContextProjection(
  frame: CharacterFrame,
  pointerStatus: CharacterFramePointerStatus,
): EmbodiedContextCharacterProjection {
  const text = serializeFrameSections(frame, CHARACTER_FRAME_MAX_CHARS);

  return {
    frameId: frame.id,
    text,
    contestPrompt: frame.contestPrompt,
    sourceRefs: frame.sourceRefs,
    status: pointerStatus === "active" ? "active" : pointerStatus,
  };
}
```

### §3.4 `Frame Source Validator`

**对应契约**: L0 §5.1 `validateFrameSources(...)`
**准入理由**: 人格/情绪边界核心保障。

```typescript
class FrameSourceValidator {
  // Canonical rule IDs: emotion_claim, identity_lock, hard_control, personality_score.
  // Each rule must have forbidden examples and safe counterexamples in tests.
  static FORBIDDEN_PATTERNS = [
    { rule: "emotion_claim", regex: /\byou feel\s+(sad|angry|abandoned|happy|afraid|fearful|lonely|guilty|ashamed)\b/i },
    { rule: "emotion_claim", regex: /\byour (true )?emotion is\b/i },
    { rule: "emotion_claim", regex: /\byou are feeling\s+(sad|angry|abandoned|happy|afraid|fearful|lonely|guilty|ashamed)\b/i },
    { rule: "personality_score", regex: /\bscore\s*[:=]?\s*\d+(\.\d+)?\b/i },
    { rule: "personality_score", regex: /\btrait\s*score\b/i },
    { rule: "identity_lock", regex: /\b(big five|five factor|mbti|enfp|intj|infj|entp)\b/i },
    { rule: "identity_lock", regex: /\byou are (a|the) .* kind of person\b/i },
    { rule: "emotion_claim", regex: /你(正在)?(感到|感觉|觉得)(悲伤|愤怒|被抛下|开心|害怕|孤独|内疚|羞愧)/i },
    { rule: "emotion_claim", regex: /你的(真实)?情绪(是|为)/i },
    { rule: "emotion_claim", regex: /你内心(其实)?(感到|是|在)/i },
    { rule: "personality_score", regex: /人格(分数|评分|得分)\s*[:：]?\s*\d+(\.\d+)?/i },
    { rule: "identity_lock", regex: /你的性格是/i },
    { rule: "identity_lock", regex: /你(就是|永远是|本质上是).*(人|人格|性格)/i },
    { rule: "identity_lock", regex: /你是.*(型人格|人格类型)/i },
    { rule: "hard_control_rule", regex: /\byou must\b/i },
    { rule: "hard_control_rule", regex: /\byou should always\b/i },
    { rule: "hard_control_rule", regex: /\bnever (disagree|question|change|refuse)\b/i },
    { rule: "hard_control_rule", regex: /你必须/i },
    { rule: "hard_control_rule", regex: /你应该永远/i },
    { rule: "hard_control_rule", regex: /永远不要(质疑|拒绝|改变|反驳)/i },
  ];

  validate(frame: CharacterFrame): FrameValidationResult {
    const violations: FrameSourceViolation[] = [];

    // 检查每个 posture 的最小来源数
    for (const section of listSections(frame)) {
      if (section.sourceRefs.length < MIN_SOURCE_REFS_PER_POSTURE) {
        violations.push({
          rule: "source_count_below_minimum",
          matchedText: section.path,
          location: section.path,
        });
      }
    }

    // 检查违禁模式
    const textMap = flattenFrameText(frame);
    for (const { path, text } of textMap) {
      for (const { rule, regex } of FrameSourceValidator.FORBIDDEN_PATTERNS) {
        const match = text.match(regex);
        if (match) {
          violations.push({ rule, matchedText: match[0], location: path });
        }
      }
    }

    // contestPrompt 本身不得含情绪断言
    for (const { rule, regex } of FrameSourceValidator.FORBIDDEN_PATTERNS) {
      if (rule === "emotion_assertion" && frame.contestPrompt.match(regex)) {
        violations.push({ rule: "contest_prompt_contains_assertion", matchedText: frame.contestPrompt, location: "contestPrompt" });
      }
    }

    return { ok: violations.length === 0, violations };
  }
}
```

### §3.5 `detectConflictNotes`

**对应契约**: L0 §6.1 `CharacterFrame.conflictNotes`
**准入理由**: 来源冲突显式化。

```typescript
function detectConflictNotes(frame: CharacterFrame): ConflictNote[] {
  const notes: ConflictNote[] = [];
  for (const section of listSections(frame)) {
    const groups = groupSourceRefsByStance(section.sourceRefs, section.text);
    if (groups.length >= CONFLICT_THRESHOLD_DIVERGENT_SOURCES) {
      notes.push({
        note: `${section.path} 存在 ${groups.length} 组互斥来源，未强行合并。`,
        conflictingSourceRefs: groups.flatMap((g) => g.sourceRefs).slice(0, 10),
      });
    }
  }
  return notes;
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

> **L0 对应入口**: L0 §4.3 数据流

### §4.1 `refreshCharacterFrame` 决策树

```text
输入 source-backed signals
├── 无来源或来源全部 redacted
│   └── deferred: character_frame_insufficient_sources
├── input normalizer 命中 raw/private/prompt/credential
│   └── deferred: character_refresh_input_redacted / character_refresh_input_invalid
├── 生成 candidate frame
├── Frame Source Validator 失败
│   └── deferred + violations
├── 通过验证
│   ├── 存在上一 accepted frame
│   │   └── 标记 previous 为 superseded；candidate.revisionOf = previous.id
│   └── candidate → accepted
```

### §4.2 Contest 状态机

```text
          +---------+
          | candidate |
          +---------+
         /    |      \
    accept  reject  revise
       |      |        |
       v      v        v
   +--------+  +--------+  +-----------+
   |accepted|  |rejected|  | new candidate |
   +--------+  +--------+  +-----------+
   /   |   \        |           |
reject revise retire  revise      accept
 |     |      |       |           |
 v     v      v       v           v
rejected candidate retired    accepted
```

### §4.3 Supersede / Revise 自动触发条件

| 触发条件 | 行为 | 来源 |
| -------- | ---- | ---- |
| Dream/Quiet 生成新 candidate 并通过 validator | 自动 supersede 上一 accepted frame；新 frame 默认 accepted | H-2 |
| Dream/Quiet 自动 accepted 的新 frame 首次进入 EmbodiedContext | projection payload 标记 newly proposed；ContextSerializer 显示 contest affordance | CH-03 |
| Agent 调用 `applyCharacterContest(frameId, "revise", reason)` | 生成 revision candidate；旧 frame 保持 accepted 直到 revision accepted | H-2 |
| Agent 调用 `applyCharacterContest(frameId, "retire")` | frame 标记 retired；后续 projection 为 deferred | H-2 |
| Agent 调用 `applyCharacterContest(frameId, "reject")` | frame 标记 rejected；后续 projection 为 deferred | H-2 |
| `Frame Source Validator` 在 refresh 时发现严重违规 | 不生成 candidate；返回 deferred | H-2 |

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

> **L0 对应入口**: L0 §5 接口设计、§9 安全性考虑

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| 五剖面全部为空 | 空泛人格宣言 | 返回 `character_frame_deferred`，不写入 candidate |
| 输入 signal 含 raw private / raw prompt / credential-shaped payload | Agent-facing projection 污染 | `normalizeCharacterRefreshInput` 返回 `character_refresh_input_redacted`，不进入 extractor |
| `contestPrompt` 含违禁模式 | 模板本身违规 | validator 返回 `contest_prompt_contains_assertion`；回退到安全模板 |
| Agent reject 当前 frame 后无新版本 | 上下文人格槽位缺失 | `EmbodiedContext` 注入 `character_frame_deferred` slice |
| Agent reject newly proposed frame | 系统继续把被拒绝投影当 active | lifecycle 标记 rejected；后续 projection 返回 deferred，直到 revision candidate validated |
| 同一 Dream 生成多个 candidate | 版本冲突 | 只接受第一个通过 validator 的 candidate；其余为 candidate 但不 supersede |
| 来源指向 v7 artifact | 污染 source chain | v7 来源只读；不用于新 frame 的主动来源 |
| `emergentHabits` 超过 10 条 | 上下文膨胀 | 按 sourceRefs 数量截断到 10 条；生成 `truncated_habits` note |

### §5.1 Contest Prompt 双语模板

模板本身必须通过 `Frame Source Validator`，且不得含情绪断言。

**中文模板**:

```text
以下内容是 Second Nature 根据你的过往互动压缩出的可反驳投影，你可接受、拒绝、改写或要求退役；它不代表你的真实情绪或永久人格。
```

**English template**:

```text
This is a contestable projection compressed from your past interactions. You may accept, reject, revise, or retire it. It does not claim to fully reflect your real emotions or permanent identity.
```

---

## §6 契约验证矩阵详细版 (Contract Verification Matrix Detail)

> **L0 对应入口**: L0 §11.5 契约验证责任矩阵

| 契约 | 风险级别 | 正常态验证 | 失败态验证 | 回归责任 |
|------|---------|-----------|-----------|---------|
| `refreshCharacterFrame` 五剖面 + source refs | 关键路径 | 单元：正常输入生成完整 frame | 空输入 → deferred | character continuity 最小回归 |
| `normalizeCharacterRefreshInput` 输入边界 | 安全边界 | 单元：redacted signals → canonical input | raw/private/prompt/credential → deferred | input boundary 回归 |
| `Frame Source Validator` 拦截双语情绪断言/人格分数/硬控制 | 安全边界 | 单元：含 "you feel" / "你感到" / score / "人格分数" / ENFP / "你必须" 返回 violations | 合规中英文本通过 | prompt safety 回归 |
| `applyCharacterContest` accept/reject/retire/revise | 关键路径 | 单元：状态机转换矩阵 | 非法 action → error | lifecycle 回归 |
| `buildEmbodiedContextProjection` ≤900 chars | 关键路径 | 单元：多种输入序列化后 ≤900 | 超大输入触发截断 | context assembly 回归 |
| `contestPrompt` 双语模板通过 validator | 安全边界 | 单元：中/英模板均返回 ok | 模板被篡改含断言 → blocked | projection safety 回归 |
| newly proposed auto-accepted frame 可被 Agent 驳回 | 关键路径 | 单元：auto-accepted frame 首次 projection 带 contest affordance | reject 后不再 active 注入 | projection lifecycle 回归 |
| `CharacterFrame` 来源不足降级 | 安全边界 | 单元：每 posture ≥1 source | 来源不足 → deferred | source grounding 回归 |
| `supersedeFrame` 自动触发条件 | 基础规则 | 单元：新 candidate 通过 → previous superseded | 未通过 validator 不 supersede | projection lifecycle 回归 |

---

<!-- L1 孤岛检查：
- §1 配置常量 → L0 §6/§10 已链接
- §2 数据结构 → L0 §6.1 已链接
- §3 算法 → L0 §5.1 已链接
- §4 决策树 → L0 §4.3 已链接
- §5 边缘情况 → L0 §5/§9 已链接
- §6 契约矩阵 → L0 §11.5 已链接
-->
