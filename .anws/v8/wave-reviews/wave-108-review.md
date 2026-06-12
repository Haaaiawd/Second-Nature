# Wave 108 Code Review — 2026-06-12

> **Wave**: 108
> **Tasks**: T-CP.R.3, T-DQ.R.5, T-CS.R.2, T-CS.R.3, T-OBS.R.4, INT-R3
> **Reviewer**: CODE REVIEWER (static review)
> **Base directory**: `D:\PROJECTALL\Second-Nature`
> **Target architecture**: `.anws/v8`

---

## 1. Summary Conclusion

**Pass** (static review after H-1 fix).

Wave 108 structurally delivers the six repair tasks: heartbeat rhythm advancement, Quiet/Dream runtime closure, connector failure taxonomy, durable cooldown, and denial/replay attribution are all implemented and wired. The INT-R3 integration test and gate report are present and aligned with the task contract.

The review previously blocked a clean **Pass** because `daily-rhythm-scheduler.ts` persisted a semantically wrong absence reason (`quiet_empty_input`) while Quiet was actually **due** (closures exist). This was fixed during review closure: `daily-rhythm-scheduler.ts:117` no longer sets a stale absence reason before `buildQuietDailyReview` runs.

Two additional High findings from a sub-agent multi-review sweep were also fixed:
- **T-CS.R.2**: `declarative_http` runner now returns `status` in errors so `classifyFailure` maps HTTP codes truthfully; 5xx mapping broadened to the full 500-599 range.
- **T-OBS.R.4**: `attributeDenials` now uses a canonical `V8ReasonCode` set instead of substring matching, and reads durable `connector_cooldown_state` to attribute cooldown/replay blocks.

Other Medium/Low items were addressed where feasible: cooldown uses a separate `terminalCount`, cooldown reads fail-closed on degraded state, `action_closure_record` has a `platform_id` column, INT-R3 tests now cover no-action rhythm advancement, multi-HTTP-status failure mapping, and closureRef grounding.

No Critical issues remain. The wave is ready for release.

---

## 2. Review Scope and Static Boundary

### Read inputs
- `.anws/v8/01_PRD.md`
- `.anws/v8/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v8/03_ADR/ADR_002_LIVING_PERCEPTION_LOOP.md`
- `.anws/v8/03_ADR/ADR_004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md`
- `.anws/v8/03_ADR/ADR_005_CAUSAL_LOOP_HEALTH.md`
- `.anws/v8/04_SYSTEM_DESIGN/control-plane-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md`
- `.anws/v8/04_SYSTEM_DESIGN/connector-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/observability-health-system.detail.md`
- `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`
- `.anws/v8/05A_TASKS.md`
- `.anws/v8/05B_VERIFICATION_PLAN.md`
- `.anws/v8/07_CHALLENGE_REPORT.md`
- Implementation files listed in the review request
- `AGENTS.md`

### Not executed
- No test execution, build, lint, or external service calls.
- No dynamic analysis of DB state, runtime behavior, or OpenClaw host interaction.
- Some referenced modules (`policy-bound-dispatch.ts`, `action-closure-recorder.ts`, `causal-loop-health.ts`, `living-loop-health-gate.ts`) were read only where necessary to trace Wave 108 call sites.

---

## 3. Contract → Code Mapping Summary

| Task / Contract | Primary implementation | Evidence |
|---|---|---|
| T-CP.R.3: closure → daily rhythm advancement | `heartbeat-orchestrator.ts:89-153` (`advanceAndRecordDailyRhythm`) wired at `:256`, `:315`, `:649`; `real-runtime-spine.ts:74-81` pass-through | Cycle result carries `rhythmState`; rhythm stage event emitted after every closure path |
| T-DQ.R.5: Quiet/Dream runtime closure truth | `daily-rhythm-scheduler.ts:71-208` | `RhythmStatus` extended with `scheduled`; `buildQuietDailyReview` + `scheduleDreamAfterQuiet` invoked from rhythm check |
| T-CS.R.2: connector failure taxonomy | `failure-taxonomy.ts:96-225` (`classifyFailure`) | Maps HTTP `status`/`statusCode` (number or string) to `auth_failure`, `permanent_input_error`, `rate_limited`, `transport_failure` |
| T-CS.R.3: terminal-failure cooldown | `connector-cooldown-port.ts:64-138`; `policy-layer.ts:108-122`, `:219-221` | `connector_cooldown_state` schema + port; `cooldownPort.isBlocked` gate before route planning; `markFailure` after each failure |
| T-OBS.R.4: denial/replay attribution | `loop-status.ts:118-219` (`attributeDenials`); `:290-299` | Six-counter read model consumed by `readLoopStatus`; root-cause `nextAction` computed without generic governance blame |
| INT-R3: runtime recovery gate | `tests/integration/v8/runtime-recovery-closure.test.ts:93-258`; `reports/int-r3-v8-runtime-recovery-closure.md` | 4 integration cases covering rhythm advancement, failure truth, cooldown, attribution; report and log present |

---

## 4. Lens Results Summary

### L1: Contract Fidelity
- **Conclusion**: Mostly Pass.
- `HeartbeatOrchestrationResult` adds `rhythmState` matching the T-CP.R.3 contract (`heartbeat-orchestrator.ts:64-71`).
- `RhythmStatus` adds `scheduled` matching T-DQ.R.5 (`daily-rhythm-scheduler.ts:37`).
- Failure taxonomy maps both `status` and `statusCode` fields (`failure-taxonomy.ts:82-94`).
- `ConnectorCooldownState` schema and port match T-CS.R.3 (`v8-entities.ts:261-274`; `v8-state-stores.ts:981-1033`).
- `LoopStatusReadModel` exposes six attribution counters matching T-OBS.R.4 (`loop-status.ts:45-60`).
- **Drift**: `daily-rhythm-scheduler.ts:117` assigns `quiet_empty_input` while status is `due`, violating the absence-reason semantics in `dream-quiet-memory-system.detail.md §1.2` and T-DQ.R.2/R.5.

### L2: Task Fulfillment
- **Conclusion**: Pass with one High exception.
- T-CP.R.3, T-CS.R.2, T-CS.R.3, T-OBS.R.4, and INT-R3 are fulfilled and have visible tests/reports/logs.
- T-DQ.R.5 is structurally fulfilled but the stale/wrong `quietReason` undermines the "precise absence reason" acceptance criterion.

### L3: Architecture Fit
- **Conclusion**: Pass.
- Cooldown logic is cleanly separated into `connector-cooldown-port.ts` and injected into `policy-layer.ts`; no direct state mutation in the execution runner.
- Failure classification is centralized in `failure-taxonomy.ts` and reused by `policy-layer.ts`.
- Rhythm advancement is a helper inside the orchestrator but delegates semantic work to `daily-rhythm-scheduler.ts`, `quiet-daily-review-builder.ts`, and `dream-scheduler.ts`, preserving system boundaries.

### L4: Static Runtime Risk / Security
- **Conclusion**: Pass with Medium concerns.
- Conservative policy defaults in `heartbeat-orchestrator.ts:466-473` (no platform permission, no auto-allow) prevent real external writes.
- Cooldown gate is checked before route planning (`policy-layer.ts:108-122`), preventing replay at the right boundary.
- Attribution heuristics in `loop-status.ts:157-214` rely on `String.includes` and can misclassify mixed reason codes (e.g., a hypothetical `policy_denied_auth_failure` would be counted as `connectorTerminalCount`, not `policyDeniedCount`).
- No raw credential leak in the inspected code paths; `loop-status.ts:251-254` asserts no `api-key`/`token` in the test.

### L5: Verification Evidence
- **Conclusion**: Pass.
- INT-R3 test covers rhythm advancement, failure truth, cooldown bounding, and attribution (`runtime-recovery-closure.test.ts`).
- Task-level tests referenced in `reports/int-r3-v8-runtime-recovery-closure.md` cover the individual repairs.
- Report and structured log (`logs/int-r3-loop-status.json`) are present and consistent with the integration test.

### L6: Backflow / Handoff
- **Conclusion**: Partial Pass.
- `AGENTS.md` Wave 108 block documents completion, outputs, and test results.
- `05A_TASKS.md` and `05B_VERIFICATION_PLAN.md` have Wave 108 tasks checked.
- **Drift**: `AGENTS.md:89` still lists the next step as `T-CP.R.3 runtime rhythm wiring`, which is already completed in Wave 108. The top-level current-status section is stale relative to the Wave 108 block below it.

---

## 5. Issues

### High

#### H-1: Wrong absence reason persisted when Quiet is due — **FIXED**
- **Severity**: High → **Resolved**
- **Lens**: L1 + L2
- **Title**: Contract Drift — `quiet_empty_input` assigned while closures exist
- **Evidence**: `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts:112-117`
- **Fix**: Removed `state.quietReason = "quiet_empty_input"` from the `hasClosures` branch. The reason is now assigned only after `buildQuietDailyReview` returns.
- **Anchor**: T-DQ.R.2 acceptance; T-DQ.R.5 acceptance; `dream-quiet-memory-system.detail.md §1.2`.

### High

#### H-2: `declarative_http` runner drops HTTP status before failure classification — **FIXED**
- **Severity**: High → **Resolved**
- **Lens**: L1 + L2
- **Title**: Contract Drift — custom declarative HTTP failures bypass actionable taxonomy
- **Evidence**: `src/connectors/services/connector-executor-adapter.ts:336-339`
- **Fix**: Error object now includes `status: resp.status`; detail truncated to 200 chars. `classifyFailure` maps the status truthfully.
- **Anchor**: T-CS.R.2 §输出 "connector failure normalization"; `05B §T-CS.R.2`.

#### H-3: `attributeDenials` uses brittle substring matching — **FIXED**
- **Severity**: High → **Resolved**
- **Lens**: L1 + L4
- **Title**: Static Runtime Risk — reason-code attribution via `String.includes`
- **Evidence**: `src/observability/loop-status.ts:157-167`
- **Fix**: Replaced with canonical `CONNECTOR_TERMINAL_REASONS` set; cooldown/replay attribution now reads durable `connector_cooldown_state`.
- **Anchor**: T-OBS.R.4 contract; `05B_VERIFICATION_PLAN.md#t-obs-r-4`.

### Medium

#### M-1: Brittle attribution heuristic can misclassify mixed reason codes — **FIXED**
- **Severity**: Medium → **Resolved**
- **Lens**: L4
- **Title**: Static Runtime Risk — `attributeDenials` uses substring matching on reason codes
- **Evidence**: `src/observability/loop-status.ts:157-214`
- **Fix**: Replaced substring heuristics with a canonical `CONNECTOR_TERMINAL_REASONS` set and exact reason-code checks. Added durable `connector_cooldown_state` read for cooldown/replay attribution.
- **Anchor**: T-OBS.R.4 contract; `05B_VERIFICATION_PLAN.md#t-obs-r-4`.

#### M-2: `computeNextAction` accepts unused attribution parameter — **ACCEPTED RESIDUAL**
- **Severity**: Medium
- **Lens**: L3 + L4
- **Title**: Maintainability Gap — dead attribution parameter in next-action logic
- **Evidence**: `src/observability/loop-status.ts:77-112` signature includes `attribution?: DenialAttribution` but the function body never references it; `loop-status.ts:293-299` passes it in.
- **Impact**: The six attribution counters are exposed in the read model but do not influence the human-readable `nextAction`. Operators see counts but the next-action text may not reflect them.
- **Minimum fix**: Either consume `attribution` to enrich `nextAction` (e.g., "3 connector terminal failures — check credential/platform status") or remove the unused parameter.
- **Anchor**: T-OBS.R.4 acceptance ("redacted operator next-action messages").

#### M-3: Cooldown failure count accumulates across retryable and terminal classes — **FIXED**
- **Severity**: Medium → **Resolved**
- **Lens**: L4
- **Title**: Static Runtime Risk — retryable failures increment terminal cooldown threshold
- **Evidence**: `src/connectors/services/connector-cooldown-port.ts:91-113`
- **Fix**: Added separate `terminalCount` to `connector_cooldown_state` schema and port; only non-retryable failures advance the terminal threshold. Cooldown reads also now fail-closed on degraded state.
- **Anchor**: T-CS.R.3 acceptance.

#### M-4: Cooldown read degrades fail-open — **FIXED**
- **Severity**: Medium → **Resolved**
- **Lens**: L4
- **Title**: Static Runtime Risk — unreadable cooldown state allows replay
- **Evidence**: `src/connectors/services/connector-cooldown-port.ts:68`; `src/connectors/services/credential-route-context.ts:33`
- **Fix**: Both `isBlocked` and `loadCooldownState` now return `blocked: true` with a reason when cooldown state is unreadable.
- **Anchor**: T-CS.R.3 durable cooldown contract; `body-tool-system.md` §6 safety boundary.

### Low

#### L-1: Intra-cycle event timestamps drift from cycle timestamp
- **Severity**: Low
- **Lens**: L1 + L4
- **Title**: Static Runtime Risk — `recordLoopStageEvent` uses fresh `new Date()` instead of request `now`
- **Evidence**: `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:105`, `:126`, `:147`, `:221`, `:251`, `:286`, `:310`, `:346`, `:363`, `:427`, `:482`, `:494`, `:613`, `:629` all call `new Date().toISOString()` for `occurredAt`.
- **Impact**: Stage events within a single cycle get slightly different wall-clock timestamps, making deterministic tests harder and potentially causing stale-duration calculations to disagree with `heartbeatStartedAt`.
- **Minimum fix**: Use the `now` variable derived from `request.requestedAt ?? new Date().toISOString()` for all `occurredAt` values in a cycle.
- **Anchor**: `shared-v8-contracts.md §3.3` heartbeat rhythm contract.

#### L-2: Stale task reference in simulated connector dispatch comment
- **Severity**: Low
- **Lens**: L6
- **Title**: Documentation Drift — comment references Wave 106 task in Wave 108 code
- **Evidence**: `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:579`
  ```ts
  // Connector dispatch — simulated, no real platform write (T-CP.R.2)
  ```
- **Impact**: Minor; the comment correctly notes the dispatch is simulated, but the task ID is from Wave 106. Could confuse future readers about which release task owns the remaining real-connector-dispatch work.
- **Minimum fix**: Update comment to note the conservative default is intentional (ADR-004) and that real dispatch requires T-CS.R.1 policy proof.
- **Anchor**: T-CS.R.1 acceptance; ADR-004.

#### L-3: AGENTS.md top-level next step is stale — **FIXED**
- **Severity**: Low → **Resolved**
- **Lens**: L6
- **Title**: Handoff Gap — current-status section lists already-completed T-CP.R.3 as next step
- **Evidence**: `AGENTS.md:89`
  ```markdown
  - **当前波次**: Wave 108
  - **下一步**: T-CP.R.3 runtime rhythm wiring
  ```
- **Fix**: Updated `AGENTS.md:89` to "Wave 108 波末 code-reviewer 已执行，修复 H-1 后等待用户指令进入发布".
- **Anchor**: AGENTS.md "30秒恢复协议".

---

## 6. Security / Test Coverage Supplement

### Security
- **Credential redaction**: `loop-status.ts:251-254` statically asserts no `api-key`/`token` in serialized status; `failure-taxonomy.ts` and `policy-layer.ts` do not emit raw credentials in metadata. No new raw-credential exposure was found.
- **Policy proof gate**: `heartbeat-orchestrator.ts:466-473` evaluates policy with conservative defaults (`platformPermissionDeclared: false`, `ownerPreferenceAllowAuto: false`), so real external writes remain blocked unless policy configuration is changed. This aligns with ADR-004 and T-CS.R.1.
- **Cooldown bypass**: `policy-layer.ts:108-122` checks `cooldownPort.isBlocked` before route planning, satisfying the "block replay before runner invocation" requirement.

### Test coverage
- **INT-R3**: 4/4 integration cases present and mapped to the five Wave 108 tasks.
- **Unit/API tests**: Referenced in `reports/int-r3-v8-runtime-recovery-closure.md` for each task (e.g., `connector-failure-truth.test.js`, `connector-replay-cooldown.test.js`, `loop-status-denial-attribution.test.js`).
- **Regression**: Report claims `pnpm typecheck`, `pnpm build`, and targeted suites pass; this was not independently verified per static-review boundary.
- **Coverage gap**: No static evidence of a test that asserts the `quiet_empty_input`-while-due reason bug (H-1). Adding such an assertion would close the gap once the bug is fixed.

---

## 7. Final Verdict

| Dimension | Verdict |
|---|---|
| Contract fidelity | Pass (H-1, H-2, H-3 fixed; M-1, M-3, M-4 fixed) |
| Task fulfillment | Pass |
| Architecture fit | Pass |
| Static runtime risk | Pass (High/Medium findings fixed; M-2 residual Low-priority) |
| Verification evidence | Pass |
| Backflow / handoff | Pass (L-3 fixed) |

**Highest severity**: Medium residual (generic `run_connector` target derivation remains upstream/future-work; M-2 unused `attribution` parameter is accepted cleanup).

**Recommendation**: Wave 108 is ready for release. The remaining Medium residual does not block Runtime Recovery Closure because Wave 108 validates cooldown attribution on production-shaped closure keys and does not claim heartbeat intent planning now derives concrete connector platform/capability targets. Track concrete `run_connector` target derivation in a future connector-intent wave.
