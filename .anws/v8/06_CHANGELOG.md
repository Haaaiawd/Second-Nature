# v8 Changelog

**Version**: `.anws/v8`
**Status**: Genesis complete / design pending
**Date**: 2026-06-01

---

## Intent

v8 upgrades Second Nature from a connector-driven evidence collector into a living perception loop.

The main architectural correction is:

```text
heartbeat -> evidence -> perception -> judgment -> action closure
  -> Quiet daily review -> Dream consolidation -> long-term memory projection
```

This explicitly preserves the v7 idea that long-term memory is formed by Quiet/Dream reviewing a whole day, while adding the missing near-real-time layer that lets every heartbeat act naturally and close its loop.

---

## Changes From v7

- Adds `concept_model.json` for v8 Living Perception Loop terminology.
- Reframes memory: realtime perception/judgment may create action closure records, but long-term memory must come from Quiet/Dream consolidation.
- Adds `ActionClosureRecord` as the required output of heartbeat actions.
- Adds platform-neutral autonomy policy: Nyx may decide whether to reply, publish, notify, ignore, draft, or run a connector, under shared policy gates.
- Adds causal loop health across ingestion, perception, judgment, action policy, execution, closure, Quiet review, Dream consolidation, and projection.
- Records the sensitivity-scan distinction between Dream redaction and storage write validation.

---

## Not Yet Done

- `04_SYSTEM_DESIGN/*` is not generated.
- `05A_TASKS.md` and `05B_VERIFICATION_PLAN.md` are not generated.
- v8 has not passed `/challenge` or `/blueprint`.

---

## Repair Backlog — 2026-06-04

- Added `T-OBS.R.1` to close an implementation-level observability gap discovered after v8 forge completion: manual connector runs, heartbeat connector runs, and source-backed Quiet outcomes were not consistently writing audit truth consumed by `heartbeat_digest`.
- Scope is a controlled repair within v8 assumptions: no new requirement, no ADR change, no external dependency, and no completed task checkbox backfill.
- Implemented `T-OBS.R.1`: connector/Quiet audit recorders, shared CLI/runtime audit store wiring, digest audit fallback aggregation, targeted tests, code review, and plugin runtime sync are complete.
