# INT-R1 — Runtime Activation Repair Gate Report

> **Date**: 2026-06-09
> **Wave**: Wave 107 / T-VERIFY.R.1
> **Status**: ✅ PASS
>
> This report verifies that Wave 106 repair tasks produce **real runtime evidence**, not contract-only smoke or manually seeded state.

---

## 1. Scope

Validate that the following repair tasks work together to produce state-backed evidence:

| Task | System | Evidence Required |
|------|--------|-------------------|
| T-CP.R.2 | control-plane | Runtime heartbeat produces closure/no-action with cycle trace + stage events |
| T-GVS.R.1 | guidance-voice | Impulse context artifact is readable with freshness diagnostics |
| T-CS.R.1 | connector | Policy-bound write dispatch supports dry-run/owner-confirm without real platform write |
| T-DQ.R.2 | dream-quiet | Daily rhythm runs Quiet review and records durable state |
| T-OBS.R.2 | observability | `checkRealRunHealth` distinguishes real runtime from contract smoke |

---

## 2. Test Results

### 2.1 Full Repair Chain — Runtime-Produced Evidence ✅

**Test**: `full repair chain produces real runtime artifacts per stage`

| Stage | Action | Result |
|-------|--------|--------|
| Heartbeat | `runHeartbeatCycle` with empty evidence | ✅ cycle trace persisted, closure/no-action written |
| Closure | Read closure by cycleId | ✅ exactly one closure record exists |
| Impulse | `writeImpulseContext` → `readImpulseContext` | ✅ artifact readable, freshness valid |
| Write Safety | `dispatchPolicyBoundWrite` (dry-run) | ✅ status = `dry_run`, no platform write |
| Rhythm | `checkDailyRhythm` (forceQuiet) | ✅ quietStatus = `completed` |
| Health Gate | `checkRealRunHealth` | ✅ `gatePassed: true`, `seededStateDetected: false` |
| Loop Status | `readLoopStatus` | ✅ closure stage visible in summaries |

**Proof**: The closure was produced by `runHeartbeatCycle`, not manually seeded. The cycle trace and stage events (ingestion, perception, judgment, policy, closure) back the closure as runtime evidence.

### 2.2 Seeded State Rejection ✅

**Test**: `seeded-only closure fails as not valid runtime proof`

| Check | Expected | Actual |
|-------|----------|--------|
| `hasRealClosure` | `true` | ✅ `true` |
| `seededStateDetected` | `true` | ✅ `true` |
| `gatePassed` | `false` | ✅ `false` |
| `missingStage` | `"closure"` | ✅ `"closure"` |
| Missing reason | Contains "Seeded state detected" | ✅ Confirmed |

**Conclusion**: Manually seeded `ActionClosureRecord` (without runtime cycle trace) is correctly rejected as invalid runtime proof. This closes the false-green pattern.

### 2.3 Empty State Rejection ✅

**Test**: `missing all runtime artifacts fails with explicit reason`

| Check | Expected | Actual |
|-------|----------|--------|
| `contractSmokeOnly` | `true` | ✅ `true` |
| `gatePassed` | `false` | ✅ `false` |
| `missingStage` | `"closure"` | ✅ `"closure"` |

**Conclusion**: Empty workspace correctly reports contract-smoke-only with explicit missing closure reason.

---

## 3. Artifact Consistency

| Artifact | Exists | Notes |
|----------|--------|-------|
| `reports/int-r1-v8-runtime-activation-repair.md` | ✅ | This report |
| `logs/int-r1-loop-status.json` | ✅ | JSON evidence of loop status + health gate |
| `.anws/v8/wave-reviews/wave-106-review.md` | ✅ | Wave 106 review with proof truth finding |

---

## 4. What Was Fixed (T-VERIFY.R.1)

### Before (Wave 106 — False Green)
- INT-R1 manually seeded `ActionClosureRecord` via `writeActionClosureRecord`
- `checkRealRunHealth` returned `ok: true` for seeded state
- No cycle trace or stage events validated the closure as runtime-produced
- Required report/log/review artifacts were absent

### After (Wave 107 — Proof Truth)
- INT-R1 calls `runHeartbeatCycle` to produce **real** closure/no-action
- `checkRealRunHealth` checks that each closure is backed by a `HeartbeatCycleTrace`
- `seededStateDetected` flag explicitly marks manually seeded closures as invalid proof
- `gatePassed` is `true` **only** when:
  1. Closure exists and is backed by runtime cycle trace
  2. Quiet/Dream artifacts exist (daily rhythm)
- All required artifacts are generated and consistent

---

## 5. Remaining Gaps (Wave 107 Continuation)

The following are **out of scope for T-VERIFY.R.1** and covered by subsequent tasks:

| Gap | Task | Status |
|-----|------|--------|
| `loop_status` does not consume `checkRealRunHealth` | T-OBS.R.3 | Pending |
| `PerceptionCard` novelty/relevance contract drift | T-PJ.R.1 | Pending |
| Projection supersession uses insert-only (PK conflict risk) | T-DQ.R.3 | Pending |
| Accepted projections not wired into heartbeat context | T-DQ.R.3 | Pending |
| `QuietDailyReview.closureRefs` not first-class | T-DQ.R.4 | Pending |

---

## 6. Verification Commands

```bash
# Type check
pnpm exec tsc --noEmit

# Build
pnpm build

# Unit tests
node --test dist/tests/unit/observability/living-loop-health-gate.test.js

# Integration tests
node --test dist/tests/integration/v8/int-r1-runtime-activation-repair.test.js
node --test dist/tests/integration/v8/real-runtime-living-loop.test.js
```

**Result**: All targeted tests pass. No regression in existing tests.
