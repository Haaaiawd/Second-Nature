# INT-R4 — v8 Content-Bearing Living Loop

> **Milestone gate:** Wave 109 — Content-bearing evidence ingestion, perception, Quiet review, and Dream activation.
> **Date:** 2026-06-15
> **Commit base:** `e7d3819` (v0.2.5) + Wave 109 implementation
> **Status:** ✅ PASS

---

## 1. Scope

This report verifies that the v8 living loop can carry **real content** through the pipeline:

1. Connector evidence is normalized into a generic, content-bearing envelope.
2. The heartbeat double-writes v8 `EvidenceItem` rows alongside v7 `LifeEvidence` artifacts.
3. Perception reads the evidence payload and produces non-template summaries + entity/topic tags.
4. The daily Quiet review is generated from actual evidence and perception rows.
5. Dream is scheduled and executed immediately when due, honoring a 7-day minimum interval.
6. UUID and identifier fields do not trip the write-validation gate.

---

## 2. Test Matrix

| ID | Given | When | Then | Result |
|---|---|---|---|---|
| INT-R4.A | A connector returns content-bearing evidence with title, summary, entities, and sourceRefs. | The evidence normalizer ingests it. | A v8 `EvidenceItem` row exists with readable `payloadJson.title`, `payloadJson.summary`, `entities`, and `sourceRefs`. | ✅ PASS |
| INT-R4.B | Evidence items are in the v8 store. | A heartbeat cycle runs. | A `PerceptionCard` is written whose `summary` is derived from the evidence payload, not a template. | ✅ PASS |
| INT-R4.C | A heartbeat produces a closure and advances daily rhythm. | Quiet becomes `due` and Dream is scheduled. | The same rhythm check completes Quiet (`completed`) and Dream (`completed`). | ✅ PASS |
| INT-R4.D | A memory candidate contains a UUID-style sourceRef id. | Write-validation runs on the candidate payload. | Validation passes; no credential/secret pattern triggers a false block. | ✅ PASS |

**Summary:** 4 / 4 integration tests passed.

---

## 3. Implementation Evidence

| Task | Key file | What changed |
|---|---|---|
| T-CS.R.4 Generic evidence envelope | `src/connectors/base/normalized-evidence-content.ts` | `NormalizedEvidenceContent<T>`, `extractNormalizedEvidenceContent`, `computeEvidenceContentHash`. |
| T-CS.R.5 Evidence deduplication + v8 write | `src/connectors/evidence-normalizer.ts`, `src/core/second-nature/heartbeat/heartbeat-loop.ts`, `src/storage/v8-state-stores.ts` | Dedupe by `(platformId, capabilityId, externalId)` then `contentHash`; upsert `EvidenceItem` on conflict; double-write after v7 `appendLifeEvidence`. |
| T-PJ.R.2 Content-bearing perception | `src/core/second-nature/perception/perception-builder.ts`, `src/storage/v8-state-stores.ts` | Reads `payloadJson`, infers summary/entities, marks `contentMissing`, lowers confidence to 0.3 when content is absent, advances `EvidenceItem.lifecycleStatus` to `perceived`. |
| T-DQ.R.6 Readable Quiet review | `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts` | Loads daily `EvidenceItem` + `PerceptionCard` rows, builds headline, completed/deferred/failed sections, memory candidates, notable signals, and a summary. |
| T-DQ.R.7 Dream execution + 7-day gate | `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts`, `src/storage/v8-state-stores.ts` | Schedules Dream, executes it immediately, enforces 7-day interval, repairs stale scheduled runs after 5 min, adds `dream_scheduled_stalled` reason code, updates run status via `updateDreamConsolidationRunStatus`. |
| T-OBS.R.5 Identifier-aware write validation | `src/storage/services/write-validation-gate.ts` | UUIDs and identifier/URI fields are exempt from secret-pattern matching; failures report the offending field + pattern. |
| Schema migration idempotency | `src/storage/db/migrations/v8-003-quiet-closure-refs.ts`, `src/storage/db/index.ts` | Migration is now a no-op because bootstrap schema already includes `closure_refs_json`; raw schema creation order fixed so `evidence_item` unique index is created after the table. |

---

## 4. Regression Evidence

Wave 108 targeted tests were re-run to ensure T-DQ.R.7 (immediate Dream execution) did not break prior expectations:

- `tests/integration/v8/runtime-recovery-closure.test.ts`: 9 / 9 PASS
- `tests/unit/dream/daily-rhythm-scheduler.test.ts`: 4 / 4 PASS (updated for `completed` Dream)

---

## 5. Build / Type / Lint

| Command | Result |
|---|---|
| `pnpm build` | ✅ |
| `pnpm exec tsc --noEmit` | ✅ |
| `pnpm lint` (alias for `tsc --noEmit`) | ✅ |

---

## 6. Residual Risks

| Risk | Severity | Rationale / Next Action |
|---|---|---|
| Real connector payloads may contain embedded secrets in `summary` or `title` not caught by regex patterns. | Medium | Content validation currently blocks high-entropy strings and known secret shapes; continue monitoring with `write_validation_blocked` telemetry. |
| Very large payloads could exceed SQLite TEXT limits or memory in sql.js. | Low | `extractNormalizedEvidenceContent` truncates to a bounded excerpt; full text is opt-in via `rawContentRef`. |
| Dream 7-day interval prevents frequent memory updates but may feel unresponsive in early usage. | Low | Accepted per ADR-003 (Quiet/Dream form long-term memory); daily Quiet still gives owner a readable signal. |

---

## 7. Sign-off

- **Contract coverage:** INT-R4 marked ✅ in `.anws/v8/05B_VERIFICATION_PLAN.md`.
- **Task closure:** T-CS.R.4, T-CS.R.5, T-PJ.R.2, T-DQ.R.6, T-DQ.R.7, T-OBS.R.5 marked complete in `.anws/v8/05A_TASKS.md`.
- **Release note:** Wave 109 content-bearing loop will be appended to `.anws/v8/06_CHANGELOG.md` at settlement.
