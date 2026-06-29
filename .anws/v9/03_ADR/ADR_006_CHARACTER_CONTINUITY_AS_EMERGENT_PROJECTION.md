# ADR-006: Model Character Continuity as Emergent Projection

## 状态
Accepted

## 日期
2026-06-21

## 背景
The user clarified that a personality system may exist, but Second Nature must not over-program the Agent. The Agent is neither a normal program nor a human. Second Nature should be its second nature: an environment and body layer that lets habits, preferences, character, and personality emerge through tools, external stimulus, feedback, closure, and Dream.

The user also clarified that programmatic constraints may not fully reflect the Agent's emotion. Prompt/context wording must preserve that boundary: Second Nature can surface body signals and contestable projections, but must not claim an authoritative inner emotional state.

## 决策驱动因素
- Claw Agent should remain the open mind and source of final expression.
- Character/personality continuity matters for growth across context resets, but it must be earned from interaction loops.
- Static persona prompts and numeric trait tables are too brittle and performative.
- The system needs an explicit bridge between source-backed experience and Agent-facing self style.
- Agent-facing prompts must not turn programmatic constraints into claims about real emotion or permanent identity.

## 候选方案

### 方案 A: No personality or character system
- **描述**: Keep all self style inside `SelfContinuityCard` and guidance templates.
- **优点**:
  - Minimal architecture.
  - Avoids fake personality attributes.
- **缺点**:
  - Character growth becomes implicit and scattered.
  - Guidance or memory may accidentally own personality without clear boundaries.

### 方案 B: Personality score/controller system
- **描述**: Store traits, emotions, or rules as scores, then drive Agent behavior from those values.
- **优点**:
  - Easy to inspect and test superficially.
- **缺点**:
  - Reduces Agent to a programmatic state machine.
  - Mistakes runtime signals for inner emotional truth.
  - Encourages scripted persona and hard control.
  - Conflicts with the mind/body separation.

### 方案 C: Character continuity as emergent projection
- **描述**: Add `character-continuity-system` that produces source-backed, bounded, contestable `CharacterFrame`: emergent habits, value posture, relationship posture, expression posture, growth tensions, conflict notes, and contest/re-authoring affordance. It reflects what is forming through embodied interaction, but does not command final reasoning or claim complete inner emotion.
- **优点**:
  - Makes character/personality growth explicit without turning it into control logic.
  - Keeps personality grounded in tool use, external stimulus, closure, experience, and feedback.
  - Connects Second Nature to Claw Agent's expression layer.
- **缺点**:
  - Requires careful wording and validation to avoid empty persona declarations and false emotion claims.

## 决策
Adopt 方案 C. v9 adds `character-continuity-system` as the owner of emergent personality/habit projection. It owns `CharacterFrame`, not Agent judgment, and it must present that frame as contestable rather than authoritative inner state.

Core rule:

```text
Personality is not configured by the runtime.
It emerges from source-backed embodied interaction loops,
and remains contestable by the Agent.
```

## 后果

### 正面
- Character continuity becomes explicit, source-backed, and earned from interaction.
- Claw Agent receives a living frame for growth without losing autonomy.
- Guidance and memory no longer have to smuggle personality assumptions.
- Prompt wording has a hard boundary against claiming programmatic access to Agent emotion.

### 负面
- Adds an eighth system and one more design document.
- Requires strict tests against personality scores, hard-control rules, source-free persona text, and emotion claims.

### 需要的后续行动
- Define `CharacterFrame` schema, section order, source requirements, conflict handling, contest/re-authoring actions, and supersession.
- Define `CharacterFrame` as an independent EmbodiedContext projection; `SelfContinuityCard` should carry only a short pointer/summary.
- Add validation that blocks source-free personality declarations, trait scores, hard-control rules, and authoritative emotion claims.
- Define prompt wording that says `CharacterFrame` is a projection the Agent may accept, reject, revise, or retire.

## 参考资料
- `../01_PRD.md` [REQ-008]
- `../concept_model.json`
- User clarification on 2026-06-21: personality may emerge from Second Nature's tools, feedback, and world contact, but must not be preconfigured or over-programmed.
- User clarification on 2026-06-21: programmatic constraints may not fully reflect Agent emotion; prompt wording must preserve that boundary.

## 影响范围
本 ADR 被以下系统引用:
- [character-continuity-system](../04_SYSTEM_DESIGN/character-continuity-system.md) - §8 Trade-offs
- [control-context-system](../04_SYSTEM_DESIGN/control-context-system.md) - §8 Trade-offs
- [memory-continuity-system](../04_SYSTEM_DESIGN/memory-continuity-system.md) - §8 Trade-offs
- [attention-system](../04_SYSTEM_DESIGN/attention-system.md) - §8 Trade-offs
