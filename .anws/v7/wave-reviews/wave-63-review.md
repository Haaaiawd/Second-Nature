# Wave 63 Code Review — 2026-05-23

## Summary Conclusion: Partial Pass

Both tasks land the intended core logic (channel-feedback ingestion with retry + audit, per-family `lastHashCache`, and a new `redactPayload` gate). However, **Critical** contract deviations in rejection payloads, a collision-prone audit hash, and invalid-timestamp bypass, plus **High** gaps in restart backfill wiring and unified-gate enforcement, prevent a full Pass. No code changes were made during this review.

---

## Scope / Boundary

| Commit | Task | Changed Files |
|--------|------|---------------|
| `6086bf1` | T-GVS.C.2 — ChannelFeedbackIngestionService (DR-029) | `src/guidance/channel-feedback-ingestion-service.ts`, `src/guidance/index.ts`, `tests/unit/guidance/channel-feedback-ingestion.test.ts` |
| `a8bbd89` | T-OBS.C.1 — RedactionPolicy unified gate + AppendOnlyAuditStore lastHashCache (DR-033) | `src/observability/audit/append-only-audit-store.ts`, `src/observability/redaction/policy.ts`, `src/observability/index.ts`, `src/observability/services/lived-experience-audit.ts`, `tests/unit/observability/audit-envelope.test.ts`, `tests/unit/observability/verify-audit-hash-chain.test.ts` |

Design references reviewed: `guidance-voice-system.md` §4.1, §5.1; `guidance-voice-system.detail.md` §1, §3.2; `observability-health-system.md` §1.3, §3.3, §4.2, §4.3; `observability-health-system.detail.md` §1, §3.1, §3.2; `05A_TASKS.md` (T-GVS.C.2, T-OBS.C.1); `05B_VERIFICATION_PLAN.md` (relevant entries).

---

## Contract → Code Mapping

| Contract Source | Requirement | Code Location | Status |
|-----------------|-------------|---------------|--------|
| `guidance-voice-system.detail.md` §3.2 — `ingestChannelFeedback` rejection returns `{ status: "rejected", reasons: validation.errors }` | Rejection must carry diagnostic reasons | `src/guidance/channel-feedback-ingestion-service.ts:318-320` | **Deviation** — `reasons` omitted |
| `guidance-voice-system.detail.md` §3.2 — `hashSummary` (audit evidence) | Cryptographic summary hash of feedback | `src/guidance/channel-feedback-ingestion-service.ts:296-305` | **Deviation** — custom string hash, not crypto |
| `guidance-voice-system.detail.md` §3.2 — `coerceDeliveryResult` | Missing proof → `not_sent` | `src/guidance/channel-feedback-ingestion-service.ts:150-158` | **Met** |
| `guidance-voice-system.detail.md` §3.2 — retry 3× (500/1000/2000 ms) + audit on exhaustion | Retry + audit on failure | `src/guidance/channel-feedback-ingestion-service.ts:279-294`, `:359-365` | **Met** |
| `observability-health-system.detail.md` §1 — `REDACTION_CONFIG_V7` fields | mask/erase/hash v7 fields | `src/observability/redaction/policy.ts:1-36` | **Met** |
| `observability-health-system.detail.md` §3.2 — `redactPayload` returns `RedactResult<T>` with `/payload/...` paths and `sensitive`/`private` levels | Unified gate path / sensitivity vocabulary | `src/observability/redaction/policy.ts:129-180` | **Deviation** — dot-paths and `restricted`/`confidential` |
| `observability-health-system.md` §4.2 / DR-033 — per-family `lastHashCache`, O(1) append, restart backfill | In-memory cache + `seedFamilyHash` | `src/observability/audit/append-only-audit-store.ts:14-58` | **Partial** — cache exists, no startup backfill caller |
| `observability-health-system.md` §4.2 / DR-039 — chain corruption 5-step handling | Isolation / degraded / alert / warnings / no auto-fix | `src/observability/audit/append-only-audit-store.ts:22-30` | **Partial** — throws on mismatch; no 5-step handler |
| `05A_TASKS.md` T-OBS.C.1 — output file `append-only-audit-store-v7.ts` | File name alignment | `src/observability/audit/append-only-audit-store.ts` | **Traceability drift** |

---

## Lens Summaries

### L1 — Contract Fidelity
Structural alignment is good: types, port shapes, and retry delays match the design. Three deviations stand out: (1) the rejection payload omits the `reasons`/`errors` array required by L1 §3.2; (2) `hashSummary` uses a non-cryptographic custom hash instead of SHA-256; (3) the new `redactPayload` gate uses dot-separated paths and `restricted`/`confidential` sensitivity labels, while the L1 pseudocode and the existing `audit-envelope.ts` use `/payload/...` paths and `sensitive`/`private` labels. Additionally, the unified gate is exported but **not wired** into `buildAuditEnvelope`, so the contract "all audit-bound payloads must pass through this gate" is not yet fulfilled.

### L2 — Task Fulfillment
**T-GVS.C.2** delivers the ingestion pipeline, retry loop, audit-on-exhaustion, and `not_sent` coercion. It misses returning validation reasons and does not test `react` or `failed`/`not_sent` paths. **T-OBS.C.1** delivers `lastHashCache`, `seedFamilyHash`, and the `redactPayload` function. It misses: (a) an actual startup backfill caller (chain resets on restart), (b) integration of the unified gate into the audit envelope builder, and (c) explicit 5-step chain-corruption handling beyond throwing.

### L3 — Architecture Fit
Dependency-inversion via ports (`RelationshipMemoryPort`, `FeedbackAuditPort`) is clean. The `AppendOnlyAuditStore` is purely in-memory, which matches its header doc, but the absence of a restart backfill caller breaks the intended cross-restart chain continuity. Two redaction vocabularies now coexist: legacy `redactAuditEvent` (used by `buildAuditEnvelope`) and new `redactPayload` (unused). This bifurcation is an architectural smell that risks inconsistent redaction manifests downstream.

### L4 — Static Runtime Risk / Security
- **Weak audit hash**: `hashSummary` is collision-prone.  
- **Invalid timestamp bypass**: `new Date(bad).getTime()` → `NaN` → `ageDays` `NaN` → `NaN > 30` is `false`, so bad timestamps are accepted.  
- **Non-string hash leak**: `redactPayload` leaves non-string values unhashed under a `hash` rule.  
- **Cross-family verifier false positive**: `verifyAuditHashChain` links consecutive events regardless of family; multi-family slices will incorrectly flag broken chains.  
- **Regex redaction limits**: `REDACTION_PATTERNS` in guidance are easy to evade (e.g., `test [at] example [dot] com`).

### L5 — Verification Evidence
Tests exist and cover the primary happy paths and failure modes. Key gaps: no `react` reaction test, no `failed`/`not_sent` coercion test, no 30-day boundary test, no validation-errors assertion, no `fieldOverrides` test for `redactPayload`, no non-string hash-value test, no family-filtered verifier test, and no restart-backfill integration test. The retry-exhaustion test asserts `elapsed >= 3000` when the contracted minimum is 3500 ms, weakening the boundary check.

### L6 — Backflow & Handoff
Barrel exports are correct in both `guidance/index.ts` and `observability/index.ts`. `seedFamilyHash` is present but has **no caller**, so every process restart treats every family as genesis, breaking hash-chain continuity. `redactPayload` is present but **not integrated** into `buildAuditEnvelope`, leaving the old redaction path active and creating a vocabulary mismatch risk for downstream explain queries.

---

## Issues Table

| # | Severity | Lens | Title | Evidence (path:line) | Impact | Minimum Fix | Anchor |
|---|----------|------|-------|------------------------|--------|-------------|--------|
| 1 | **Critical** | L1 / L2 | Rejection payload omits required `reasons` array | `src/guidance/channel-feedback-ingestion-service.ts:318-320` | Callers cannot diagnose rejections; violates "no silent loss" semantic | Return `{ status: "rejected", errors: validation.errors }` | `guidance-voice-system.detail.md` §3.2 |
| 2 | **Critical** | L4 | `hashSummary` uses collision-prone custom hash for audit evidence | `src/guidance/channel-feedback-ingestion-service.ts:296-305` | Weak hash undermines audit integrity and tamper detection | Replace with `crypto.createHash("sha256").update(data).digest("hex")` | DR-029 |
| 3 | **High** | L1 / L4 | `validateFeedback` accepts invalid timestamps due to `NaN` propagation | `src/guidance/channel-feedback-ingestion-service.ts:133` | Garbage timestamps bypass the 30-day rejection rule | Add `Number.isNaN(ageDays)` or `isNaN(feedbackTime.getTime())` guard | DR-029 |
| 4 | **High** | L2 / L6 | `seedFamilyHash` exists but has no startup backfill caller | `src/observability/audit/append-only-audit-store.ts:50` | Hash chains reset to genesis on every restart, breaking append-only continuity | Add a bootstrap routine that queries DB latest record per family and calls `seedFamilyHash` | DR-033 |
| 5 | **High** | L1 / L6 | Unified `redactPayload` gate is exported but never wired into `buildAuditEnvelope` | `src/observability/redaction/policy.ts:129`; `src/observability/audit/audit-envelope.ts:166-167` | Gate is bypassed; legacy `redactAuditEvent` still handles all audit redaction | Replace `redactAuditEvent` inside `buildAuditEnvelope` with `redactPayload`, or add an enforcement assertion | DR-033 |
| 6 | **Medium** | L1 | `redactPayload` manifest path format diverges from audit envelope vocabulary | `src/observability/redaction/policy.ts:140` (dot-path) vs `src/observability/audit/audit-envelope.ts:60-64` (`/payload/...`) | Downstream explain queries may fail to match redacted fields | Align path generation with `fieldPathToAuditPath` or reuse it | `observability-health-system.detail.md` §3.2 |
| 7 | **Medium** | L1 | Sensitivity level mismatch between `redactPayload` and `AuditEnvelopeSensitivity` | `src/observability/redaction/policy.ts:176-180` (`restricted`/`confidential`) vs `src/observability/audit/audit-envelope.ts:31` (`sensitive`/`private`) | Filtering/display logic may misclassify payload sensitivity | Map levels consistently or unify the enum | `observability-health-system.detail.md` §3.2 |
| 8 | **Medium** | L4 | `redactPayload` `hash` action leaves non-string values untouched | `src/observability/redaction/policy.ts:150-153` | Nested objects/numbers under a `hash` rule leak original values | Coerce with `String(value ?? "")` before hashing, per L1 pseudocode | `observability-health-system.detail.md` §3.2 |
| 9 | **Medium** | L4 | `verifyAuditHashChain` checks `previousHash` across families, causing false positives | `src/observability/audit/verify-audit-hash-chain.ts:86-89` | Multi-family export ranges incorrectly flagged as broken | Skip previousHash check when `prev.family !== event.family`, or group by family first | DR-033 |
| 10 | **Low** | L5 | Retry-exhaustion test asserts 3000 ms instead of contracted 3500 ms | `tests/unit/guildance/channel-feedback-ingestion.test.ts:169` | Weak boundary allows flaky pass under load | Assert `elapsed >= 3400` (or 3500) to match 500+1000+2000 ms | DR-029 |
| 11 | **Low** | L5 | Missing test coverage for `react` reaction and `failed`/`not_sent` coercion | `tests/unit/guidance/channel-feedback-ingestion.test.ts` (no such cases) | Uncovered branches in `REACTION_WEIGHTS` and `coerceDeliveryResult` | Add explicit test cases for `ownerReaction: "react"` and `deliveryResult: "failed"` | T-GVS.C.2 |
| 12 | **Low** | L5 | Missing tests for `fieldOverrides`, non-string hash values, and `maxFieldLength` | `tests/unit/observability/audit-envelope.test.ts` | Custom policy overrides and size limits are unverified | Add tests for wildcard override, nested number hash, and oversized field handling | T-OBS.C.1 |
| 13 | **Low** | L2 | Task output filename drift (`-v7` suffix missing) | `.anws/v7/05A_TASKS.md:745` vs actual `src/observability/audit/append-only-audit-store.ts` | Minor traceability drift; no functional impact if exports are correct | Update task doc or rename file to match | T-OBS.C.1 |

---

## Security & Test Gaps

| Gap | Risk | Mitigation in Code | Missing |
|-----|------|-------------------|---------|
| Weak `hashSummary` (custom 32-bit string hash) | Collision → audit repudiation | None | Replace with SHA-256 |
| Invalid timestamp bypass | Accept stale/malformed feedback | None | `isNaN` guard on parsed date |
| Unified redaction gate bypass | Credential / raw prompt leakage via legacy path | `redactPayload` exists but is not enforced | Wire `redactPayload` into `buildAuditEnvelope` |
| Restart backfill missing | Hash chain reset → loss of append-only guarantee | `seedFamilyHash` method exists | Add startup DB-backfill caller |
| Cross-family verifier false positive | Broken chain alerts on valid data | `families` filter on range | Family-aware linking in verifier |
| Regex-only redaction in guidance | Evasion (e.g., spaced email) | Patterns applied | Consider normalizing input before regex scan |

---

## Notes for Parent Agent

- **Do not auto-fix** the issues above without task-owner confirmation, especially the `hashSummary` change (may affect test determinism) and the `redactPayload` ↔ `buildAuditEnvelope` integration (touches the critical audit path).
- The `append-only-audit-store.ts` filename mismatch with `05A_TASKS.md` is cosmetic but should be reconciled in the next `/change` or `/forge` wave to keep traceability clean.
- The most impactful fixes for wave completeness are: (1) wire `redactPayload` into the audit envelope, (2) add a startup backfill caller for `seedFamilyHash`, and (3) replace the custom `hashSummary` with `crypto.createHash("sha256")`. These three would move the wave from **Partial Pass** to **Pass**.
