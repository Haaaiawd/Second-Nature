# INT-R7 — Wave 112 Canonical Contract Shape Hemostasis Gate

> **Wave**: 112
> **Trigger**: Close the safe subset of Round 3 code-health findings (CH-12 SourceRef naming, CH-16 serialization centralization) without regressing Waves 108–111.
> **Goal**: Verify SourceRefTuple rename, shared v8-contract re-export, shared serialization helper, and v8-state-stores wiring all pass targeted tests and regression.

---

## 1. Scope

| Task | Concern | Primary Evidence |
| --- | --- | --- |
| T-SH.R.2 (adjusted) | v7 tuple renamed; v8 contracts re-exported from shared index | `tests/unit/shared/v7-entities.test.ts`, `pnpm typecheck` |
| T-SMS.R.3 (adjusted) | Shared `parseSourceRefs`/`serializeSourceRefs`; v8-state-stores uses them | `tests/unit/shared/source-ref-serialization.test.ts`, `src/storage/v8-state-stores.ts` |
| INT-R7 | Regression gate | Selected Wave 108–111 targeted suites |

---

## 2. Execution Environment

- **Date**: 2026-06-16
- **Branch**: `feature/wave-112-canonical-contract-shape`
- **TypeScript**: 6.0.3
- **Package manager**: pnpm 10.0.0
- **Commands run**:
  - `pnpm typecheck` ✅
  - `pnpm build` ✅
  - `node --test` Wave 112 new tests (see §3)
  - `node --test` Wave 108–111 regression suites (see §4)

---

## 3. Wave 112 Targeted Results

| Suite | Subtests | Pass | Skip | Fail |
| --- | --- | --- | --- | --- |
| `tests/unit/shared/source-ref-serialization.test.ts` | 8 | 8 | 0 | 0 |
| `tests/unit/shared/v7-entities.test.ts` | 17 | 17 | 0 | 0 |
| `tests/unit/storage/v8-state-stores.test.ts` | 13 | 13 | 0 | 0 |
| `tests/integration/storage/schema-migration.test.ts` | 6 | 3 | 3 | 0 |
| **Total** | **44** | **41** | **3** | **0** |

*3 justified skips are historical v7-001 cases in schema-migration, not Wave 112 regressions.*

### 3.1 Key Behaviors Verified

- `SourceRefTuple` is the v7 non-empty tuple; empty tuple assignments still fail at compile time (`@ts-expect-error`).
- `src/shared/types/index.ts` re-exports `v8-contracts.js`; canonical object `SourceRef` is available from the shared index.
- `src/shared/serialization.ts` provides `serializeSourceRefs` / `parseSourceRefs` with silent degradation on malformed/null/undefined/non-array input.
- `src/storage/v8-state-stores.ts` uses the shared serializer for all v8 `sourceRefsJson` / `closureRefsJson` round-trips.

---

## 4. Wave 108–111 Regression Results

Selected Wave 108–111 suites were re-run to ensure the Wave 112 changes did not regress prior behavior.

| Suite | Subtests | Pass | Skip | Fail |
| --- | --- | --- | --- | --- |
| `tests/api/runtime-ops/heartbeat-run-v8-spine.test.ts` | 3 | 3 | 0 | 0 |
| `tests/api/runtime-ops/loop-status-real-run-gate.test.ts` | 3 | 3 | 0 | 0 |
| `tests/integration/connectors/connector-executor-adapter-honest-failure.test.ts` | 11 | 11 | 0 | 0 |
| `tests/integration/storage/schema-migration.test.ts` | 6 | 3 | 3 | 0 |
| `tests/unit/dream/daily-rhythm-scheduler.test.ts` | 5 | 5 | 0 | 0 |
| `tests/unit/action/action-closure-recorder.test.ts` | 4 | 4 | 0 | 0 |
| `tests/unit/action/action-proposal-builder.test.ts` | 3 | 3 | 0 | 0 |
| `tests/unit/control-plane/heartbeat-cycle-trace.test.ts` | 2 | 2 | 0 | 0 |
| **Total** | **37** | **34** | **3** | **0** |

---

## 5. Build / Packaging

| Check | Command | Result |
| --- | --- | --- |
| Type check | `pnpm typecheck` | ✅ |
| Compile | `pnpm build` | ✅ |

Plugin build (`pnpm build:plugin`) was not required because Wave 112 only touched shared types, storage, and tests; no plugin runtime behavior changed.

---

## 6. Verdict

**PASS** — Wave 112 adjusted scope is complete and does not regress prior waves.

- All Wave 112 targeted tests pass.
- All selected Wave 108–111 regression tests pass.
- `typecheck` and `build` pass.
- No credential leakage, no external write enablement, no PRD/ADR premise changes.

---

## 7. Residual Items

The following Round 3 findings are intentionally deferred to subsequent waves and are **not blocking** for Wave 112:

- **CH-12 remainder**: Remove `ControlPlaneSourceRef` (`src/core/second-nature/types.ts`), host-capability local `SourceRef` (`src/cli/host-capability/types.ts`), and `storage/life-evidence` local `SourceRef`; migrate `kind` → `family` with required `redactionClass`. Planned for Wave 113.
- **CH-16 remainder**: Single semantic status column per v8 table; migrate remaining ad-hoc `sourceRefsJson` JSON handling to `src/shared/serialization.ts`. Planned for Waves 114–115.

---
