# Wave 112 Code Review — 2026-06-16

## 1. Summary verdict

**Partial Pass** (adjusted scope).

The two adjusted implementation tasks are correctly executed: `SourceRef` has been renamed to `SourceRefTuple` for the v7 tuple, v8 contracts are re-exported from `src/shared/types/index.ts`, the required v7 entity/test files are adapted, and a shared `src/shared/serialization.ts` helper is created and wired into `src/storage/v8-state-stores.ts`. However, the `INT-R7` hemostasis gate evidence is not present in the provided static inputs, and the larger CH-12/CH-16 cleanups (local `SourceRef` clones and dual-status columns) remain deferred per the explicit wave scope.

## 2. Review scope and static boundaries

**Read (required inputs):**
- `src/shared/types/source-ref.ts`, `src/shared/types/index.ts`, `src/shared/types/v7-entities.ts`, `src/shared/types/goal.ts`, `src/shared/types/v8-contracts.ts`
- `src/shared/serialization.ts`
- `src/storage/v8-state-stores.ts`
- `tests/unit/shared/v7-entities.test.ts`, `tests/unit/shared/source-ref-serialization.test.ts`
- `.anws/v8/05A_TASKS.md`, `.anws/v8/05B_VERIFICATION_PLAN.md`
- `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`, `.anws/v8/04_SYSTEM_DESIGN/state-memory-system.md`
- `.anws/v8/07_CHALLENGE_REPORT.md` (CH-12, CH-16, Round 3)
- `src/core/second-nature/types.ts`, `src/cli/host-capability/types.ts` (for deferred-clone follow-up only)

**Not read / not executed:**
- Full `src/` tree for residual tuple-`SourceRef` call sites.
- Schema/migration files (`src/storage/db/schema/v8-entities.ts`, `src/storage/db/index.ts`, migrations).
- Runtime execution: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint`.
- Any `INT-R7` report, log, or test-run artifact.

**Deferred per explicit scope:**
- Removal of `ControlPlaneSourceRef` (`src/core/second-nature/types.ts:8-21`), host-capability `SourceRef` (`src/cli/host-capability/types.ts:17-30`), and life-evidence `SourceRef` local clones.
- v8 schema single-status-column cleanup (`status` vs `lifecycleStatus`).

## 3. Contract → code mapping summary

| Wave task (adjusted) | Contract promise | Implementation location |
|---|---|---|
| **T-SH.R.2** — Rename v7 tuple | v7 tuple is now `SourceRefTuple` | `src/shared/types/source-ref.ts:1-14` |
| **T-SH.R.2** — Re-export v8 contracts | `SourceRef` object shape exported from shared index | `src/shared/types/index.ts:7` |
| **T-SH.R.2** — Adapt v7 entities/tests | `SourceRefTuple` imported in v7 entity/test files | `src/shared/types/v7-entities.ts:28`, `src/shared/types/goal.ts:21`, `tests/unit/shared/v7-entities.test.ts:18` |
| **T-SMS.R.3** — Shared serializer | `serializeSourceRefs` / `parseSourceRefs` | `src/shared/serialization.ts:17-29` |
| **T-SMS.R.3** — Wire state stores | All `sourceRefsJson` / `closureRefsJson` write/read use shared serializer | `src/storage/v8-state-stores.ts:70-73`, `142`, `324`, `420`, `493`, `568`, `642`, `771`, `890`, `941`, `1017`, `1084`, `1161`, `1183` |
| **INT-R7** — Hemostasis gate | Regression/typecheck/build report | Not present in static inputs |

The canonical v8 `SourceRef` object shape matches `shared-v8-contracts.md` §2: `uri`, `family`, `id`, `redactionClass`, optional `sensitivityClass`/`resolveStatus`/`resolveFailureReason` (`src/shared/types/v8-contracts.ts:92-100`).

## 4. Lens results summary

- **L1 Contract Fidelity**: Pass for adjusted scope. v7 tuple renamed; v8 object `SourceRef` is canonical and re-exported. `ControlPlaneSourceRef` / host-capability `SourceRef` clones remain as deferred follow-up (CH-12).
- **L2 Task Fulfillment**: Adjusted T-SH.R.2 and T-SMS.R.3 outputs are present and mapped. INT-R7 gate artifacts are not available for static confirmation.
- **L3 Architecture Fit**: `src/shared/serialization.ts` is a pure helper with no storage/business coupling; good separation. `v8-state-stores.ts` remains a concrete Drizzle port (pre-existing, out of adjusted scope).
- **L4 Static Runtime Risk**: `parseSourceRefs` silently returns `[]` on malformed/non-array JSON by design (`src/shared/serialization.ts:8-9`, `21-29`); callers that need corruption detection must validate separately. No credential/secret content in changed files.
- **L5 Verification Evidence**: `source-ref-serialization.test.ts` covers round-trip, empty, malformed, non-array, null/undefined inputs; `v7-entities.test.ts` retains the `@ts-expect-error` tuple compile guard. INT-R7 report/log absent.
- **L6 Backflow & Handoff**: `05A_TASKS.md` Wave 112 tasks remain unchecked; CH-12/CH-16 closure evidence is intentionally deferred. No README/ADR update is required for the adjusted rename/serializer changes.

## 5. Issues

### Follow-up risks (deferred work, not blocking this wave)

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Low | L1+L3 | Deferred `SourceRef` local clones still shadow canonical shape | `src/core/second-nature/types.ts:8-21` (`ControlPlaneSourceRef`); `src/cli/host-capability/types.ts:17-30` (`SourceRef`) | Same-name heterogeneity remains in v8 space; refactor/rename tooling is unreliable and cross-system grounding may silently drift | Remove local clones and migrate call sites to `src/shared/types/v8-contracts.ts` `SourceRef` in the planned follow-up wave | `07_CHALLENGE_REPORT.md` CH-12, `05A_TASKS.md` T-SH.R.2 (full description) |
| Low | L3+L4 | Deferred dual `status`/`lifecycleStatus` columns in v8 schema | `07_CHALLENGE_REPORT.md` CH-16; schema files not in required inputs | Queries may filter the wrong semantic column; lifecycle and health diagnostics can diverge | Single semantic status column per v8 table; migrate reads/writes in planned follow-up wave | `07_CHALLENGE_REPORT.md` CH-16, `05A_TASKS.md` T-SMS.R.3 (full description) |
| Low | L2 | INT-R7 gate evidence not present in static inputs | `.anws/v8/05A_TASKS.md:1737-1750` (INT-R7); no `reports/int-r7-wave-112-hemostasis-gate.md` in provided inputs | Cannot statically confirm the wave closed without regression/typecheck/build failure | Execute INT-R7 targeted regression + typecheck/build and produce the required report/log | `.anws/v8/05B_VERIFICATION_PLAN.md:887-896` (INT-R7) |
| Low | L2 | Full call-site completeness for tuple-to-object rename not verified | `src/shared/types/index.ts:7` now re-exports object `SourceRef` | Any remaining file importing `SourceRef` from `src/shared/types` and expecting the v7 tuple will fail at compile time or silently mismatch | Run `pnpm exec tsc --noEmit` (or full typecheck) and update any residual tuple assumptions | `05A_TASKS.md` T-SH.R.2 ("Update all call sites that currently assume tuple or local object shapes") |

### Blocking issues for this wave

None within the adjusted scope.

## 6. Security / test coverage supplement

- **Security**: No secrets, credentials, or raw private content were introduced in the changed files. `serializeSourceRefs` simply JSON-stringifies typed `SourceRef[]`; `parseSourceRefs` returns an empty array on malformed input and does not log or surface raw payload.
- **Test coverage (adjusted scope)**:
  - `tests/unit/shared/source-ref-serialization.test.ts` — 6 cases covering normal, empty, null/undefined, empty string, malformed JSON, and non-array JSON.
  - `tests/unit/shared/v7-entities.test.ts` — compile-time `@ts-expect-error` guard for empty `SourceRefTuple` and runtime shape tests for v7 entities using `SourceRefTuple`.
- **Gaps / cannot confirm**:
  - Whether `pnpm typecheck` passes after the `index.ts` re-export change (potential collision with residual tuple consumers outside required inputs).
  - Whether all other `sourceRefsJson` consumers in `core/second-nature/**` and `storage/**` have been migrated to the shared serializer (out of adjusted scope).
  - Whether the v8 schema still contains dual-status columns and ad-hoc JSON handling (schema files not in required inputs; deferred).

**Recommended next actions:**
1. Run `pnpm exec tsc --noEmit` to catch any residual `SourceRef` tuple assumptions.
2. Execute INT-R7 targeted regression and produce `reports/int-r7-wave-112-hemostasis-gate.md`.
3. Schedule follow-up wave for CH-12 clone removal and CH-16 single-status/serializer-cleanup.
