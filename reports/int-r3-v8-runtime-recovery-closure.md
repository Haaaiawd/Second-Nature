# INT-R3 — Runtime Recovery Closure Gate (Wave 108)

> **Date**: 2026-06-12
> **Wave**: 108
> **Status**: ✅ PASS

---

## 1. Scope

Verify Wave 108 closes all runtime-recovery gaps:

| Task | What It Fixes | Evidence |
|------|--------------|----------|
| T-CP.R.3 | Heartbeat closure does not advance daily rhythm | `advanceAndRecordDailyRhythm` wired after every closure path |
| T-DQ.R.5 | Quiet/Dream runtime chain breaks | `RhythmStatus` includes `scheduled`; dream reasons distinguish skipped vs blocked |
| T-CS.R.2 | Connector failures hidden in `unknown_platform_change` | `classifyFailure` maps HTTP status / statusCode to actionable classes |
| T-CS.R.3 | Connector terminal failures replay forever | Durable cooldown table + `cooldown_blocked` failure class |
| T-OBS.R.4 | `decision_denied` over-aggregated | `loop_status` exposes six attribution counters + root-cause next action |

---

## 2. Test Results

### 2.1 T-CP.R.3 — Heartbeat Rhythm Advancement ✅

**Test**: `heartbeat closure advances into Quiet/Dream rhythm`

| Check | Expected | Actual |
|-------|----------|--------|
| Heartbeat produces exactly one closure | ✅ | ✅ |
| `DailyRhythmState` persisted | ✅ | ✅ |
| `quietStatus` | `completed` | ✅ |
| `dreamStatus` | `scheduled` | ✅ |
| `QuietDailyReview` exists | ✅ | ✅ |

### 2.2 T-DQ.R.5 — Quiet/Dream Runtime Closure ✅

**Test**: `heartbeat closure advances into Quiet/Dream rhythm`

| Check | Expected | Actual |
|-------|----------|--------|
| Rhythm state not duplicated across cycles | ✅ | ✅ |
| Dream status is `scheduled` (not ambiguous) | ✅ | ✅ |
| Quiet review carries closure refs | ✅ | ✅ |

### 2.3 T-CS.R.2 — Connector Failure Truth ✅

**Test**: `connector policy layer classifies terminal failures truthfully`

| Check | Expected | Actual |
|-------|----------|--------|
| HTTP 401 → `auth_failure` | ✅ | ✅ |
| Result metadata does not leak credential | ✅ | ✅ |

### 2.4 T-CS.R.3 — Connector Replay Cooldown ✅

**Test**: `connector cooldown bounds replay after terminal failures`

| Check | Expected | Actual |
|-------|----------|--------|
| First two failures classified `auth_failure` | ✅ | ✅ |
| Third failure blocked as `cooldown_blocked` | ✅ | ✅ |
| Runner invoked only twice | ✅ | ✅ |

### 2.5 T-OBS.R.4 — Denial / Replay Attribution ✅

**Test**: `loop_status attributes denials and replays without credential leak`

| Check | Expected | Actual |
|-------|----------|--------|
| `policyDeniedCount` | 1 | ✅ |
| `hardGuardDeniedCount` | 1 | ✅ |
| `cooldownReplayCount` | 1 | ✅ |
| `sourceAbsenceCount` | 1 | ✅ |
| `quietSuppressionCount` | 1 | ✅ |
| `connectorTerminalCount` | 1 | ✅ |
| No `api-key` / `token` leak | ✅ | ✅ |
| Next action does not blame generic governance | ✅ | ✅ |

---

## 3. Verification Commands

```bash
pnpm exec tsc --noEmit   # ✅ PASS
pnpm build               # ✅ PASS

# INT-R3 integration test
node --test dist/tests/integration/v8/runtime-recovery-closure.test.js  # 4/4 PASS

# Wave 108 individual task tests
node --test dist/tests/integration/v8/real-runtime-quiet-dream-advance.test.js        # 3/3 PASS
node --test dist/tests/api/dream/quiet-dream-runtime-chain.test.ts                     # (run via build output)
node --test dist/tests/api/connectors/connector-failure-truth.test.js                  # 6/6 PASS
node --test dist/tests/integration/control-plane/connector-replay-cooldown.test.js     # 1/1 PASS
node --test dist/tests/api/runtime-ops/loop-status-denial-attribution.test.js          # 3/3 PASS
node --test dist/tests/integration/runtime-ops/connector-replay-diagnostics.test.js    # 2/2 PASS
node --test dist/tests/unit/observability/heartbeat-denial-attribution.test.js         # 6/6 PASS

# Regression
node --test dist/tests/integration/v8/real-runtime-living-loop.test.js                 # 2/2 PASS
```

---

## 4. Conclusion

Wave 108 restores the runtime recovery path:

- ✅ A real heartbeat now advances closure → Quiet → Dream automatically.
- ✅ Connector read failures are classified truthfully (auth / rate-limit / transport / config / permanent-input).
- ✅ Repeated terminal failures are bounded by durable cooldown; replay is blocked before the runner.
- ✅ `loop_status` attributes denials to root causes and does not blame generic governance.
- ✅ No credential or raw platform payload leaks in diagnostics.

INT-R3 gate is closed.

---

## 5. Residual Notes

- E2E host smoke remains optional and requires OpenClaw environment with `second_nature_ops` visible.
- Real platform writes remain disabled by conservative policy defaults.
