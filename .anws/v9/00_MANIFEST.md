# Second Nature v9 Manifest

**Architecture Version**: `.anws/v9`
**Codename**: Self Continuity, Character & Procedural Evolution
**Status**: Genesis complete / design pending
**Created**: 2026-06-21
**Source Version Reviewed**: `.anws/v8`, Zread overview fetched 2026-06-21

---

## Purpose

v9 exists to close the continuity gap that remains after v8.

v8 made the body run: heartbeat, evidence, perception, action closure, Quiet/Dream, memory projection, health, and recovery. The remaining failure is not raw runtime health. It is that a context-reset AI can wake without inherited body intuition, stable tool routines, emergent character/habit continuity, relationship posture, or automatically improved workspace hands.

v9 upgrades the loop from:

```text
evidence -> perception -> judgment -> closure -> quiet/dream -> memory projection
```

to:

```text
evidence -> attention -> agent judgment -> closure -> quiet/dream
  -> memory + procedural projection + self continuity + emergent character/habit projection + workspace connector evolution
  -> next EmbodiedContext
```

---

## Active Documents

- [x] `concept_model.json` — v9 domain model and clarified boundaries.
- [x] `01_PRD.md` — product requirements for self continuity and procedural evolution.
- [x] `02_ARCHITECTURE_OVERVIEW.md` — v9 system boundary and dependency overview.
- [x] `03_ADR/` — accepted cross-system decisions.
- [x] `04_SYSTEM_DESIGN/README.md` — design-system placeholder and next-step index.
- [x] `06_CHANGELOG.md` — v9 intent and delta from v8.

---

## Scope Guardrails

- v9 adds `character-continuity-system`, but it is an emergent personality/habit projection system, not a preconfigured personality table, emotion oracle, or controller.
- v9 does not let Dream modify Second Nature core runtime automatically.
- v9 does allow automatic workspace connector evolution after mechanical gates and rollback proof.
- v9 keeps Claw Agent as the open mind; Second Nature provides body continuity, contestable projections, and tool/feedback traces, not a replacement brain or authoritative claim about inner emotion.

---

## Genesis Notes

- `/genesis` Git换轨未执行：当前工作树包含大量既有未提交改动；为避免破坏用户/历史工作，本次仅新增 `.anws/v9` 文档并不切换分支。
- 配对技能路径以当前仓库 `.opencode/skills/` 为准；workflow 文本中的 `.agents/skills/` 路径在本工作区不存在。

---

## Current Gate

This v9 package is genesis-complete but not blueprint-ready yet.

Required next checkpoints:

1. Run `/design-system` for the eight v9 systems.
2. Run `/challenge` against PRD, architecture, ADR, and system design.
3. Run `/blueprint` only after challenge review.
