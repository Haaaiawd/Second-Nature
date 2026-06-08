# Second Nature v8 Manifest

**Architecture Version**: `.anws/v8`
**Codename**: Living Perception Loop
**Status**: Genesis complete / design pending
**Created**: 2026-06-01
**Source Version Reviewed**: v7, DeepWiki last indexed 2026-06-01

---

## Purpose

v8 exists to close the gap between external sensing and agent life.

v7 made Second Nature capable of collecting evidence, executing connectors, recording tool pain, and exposing runtime state to OpenClaw. The remaining failure is not a connector failure. It is a semantic loop failure: evidence can accumulate without becoming perception, judgment, action closure, Quiet/Dream review, or long-term memory.

v8 upgrades the embodied loop from:

```text
heartbeat -> connector -> evidence -> logs
```

to:

```text
heartbeat -> connector -> evidence -> perception -> judgment -> action proposal -> action closure
  -> quiet daily review -> dream consolidation -> long-term memory projection -> next heartbeat
```

---

## Active Documents

- `00_DEEPWIKI_MECHANISM_AUDIT.md` — v7 mechanism review and v8 gap analysis.
- `01_PRD.md` — product requirements draft for v8.
- `02_ARCHITECTURE_OVERVIEW.md` — v8 system boundary and dependency overview.
- `03_ADR/` — accepted cross-system architecture decisions.
- `concept_model.json` — domain model for the v8 living loop.
- `06_CHANGELOG.md` — v8 intent and delta from v7.

---

## Current Gate

This v8 package is genesis-complete but not blueprint-ready yet.

Required next checkpoints:

1. Run `/design-system` for the changed/new v8 systems.
2. Run `/challenge` against PRD, architecture, ADR, and system design.
3. Run `/blueprint` only after challenge review.
