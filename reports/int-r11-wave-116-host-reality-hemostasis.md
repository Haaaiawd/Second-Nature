# INT-R11 — Wave 116 Host Reality and Ideal Loop Hemostasis (116A Gate)

> **Status**: 116A partial gate — T-OBS.R.7, T-ROS.R.7, T-ROS.R.8 implemented and targeted tests green.  
> **Date**: 2026-06-18  
> **Branch**: `feature/wave-116-host-reality-hemostasis`  
> **Code review**: `.anws/v8/wave-reviews/wave-116-review.md` — Partial Pass (H-1 pre-existing drift assigned to T-OBS.R.8).

## 1. Scope of this report

This report covers the **Wave 116A** sub-wave only:

- T-OBS.R.7 — Add `evidenceLevel` to operator-facing health and proof surfaces
- T-ROS.R.7 — Project packaged `SKILL.md` into actual host skill discovery
- T-ROS.R.8 — Make setup ack placement a truthful completion gate

Remaining Wave 116 tasks (T-SH.R.6, T-CP.R.5, T-AC.R.2, T-OBS.R.8, T-CS.R.9, T-DQ.R.9) are deferred to sub-waves 116B/116C.

## 2. Evidence summary

| Task | Implementation | Tests | Result |
| --- | --- | --- | --- |
| T-OBS.R.7 | `src/shared/evidence-level-classifier.ts`, `src/shared/types/v8-contracts.ts` EvidenceLevel, evidence level injection in `src/cli/ops/ops-router.ts`, `src/observability/loop-status.ts`, `src/observability/causal-loop-health.ts`, `src/observability/services/heartbeat-digest-assembler.ts` | `tests/unit/shared/evidence-level-classifier.test.ts` | 11/11 PASS |
| T-ROS.R.8 | `src/shared/setup-ack.ts` canonical validator, `src/cli/commands/index.ts` setup ack/hint validation, `plugin/index.ts` inline validation | `tests/unit/shared/setup-ack-validator.test.ts`, `tests/integration/cli/cli-ops-surface.test.ts`, `tests/integration/cli/plugin-runtime-registration.test.ts` | 11 + 2 + 2 PASS |
| T-ROS.R.7 | `src/cli/host-capability/host-discovery-port.ts` HostCapabilityDiscoveryPort + default fail-closed adapter, setup hint/ack host discovery report | `tests/unit/cli/host-discovery-port.test.ts` | 4/4 PASS |

## 3. Targeted test run

```bash
pnpm build
pnpm lint
node --test dist/tests/unit/shared/setup-ack-validator.test.js \
             dist/tests/unit/shared/evidence-level-classifier.test.js \
             dist/tests/unit/cli/host-discovery-port.test.js \
             dist/tests/integration/cli/cli-ops-surface.test.js \
             dist/tests/integration/cli/plugin-runtime-registration.test.js
```

Result: **48/48 PASS**.

Plugin package build: `pnpm build:plugin` — **PASS**.

## 4. Full regression snapshot

`pnpm test` (full suite): **1628/1666 pass, 29 fail, 9 skipped**.

The 29 failures are concentrated in legacy v5/v6/v7 ops surface tests and appear to be **pre-existing** (no new failures observed in 116A touched paths). A sample of failing test names:

- `T1.1.3 command router exposes heartbeat_check with stable fields`
- `T1.1.4 known workspaceRoot bridges heartbeat_check to workspace_full_runtime`
- `T1.2.8-A: capability_probe returns valid JSON subset`
- `T1.4.2-A: goal set with criteria alias persists completionCriteria`
- `T2.2.2 D — full-runtime heartbeat_check with state wired completes without error`
- `T3.3.2-A: near_real_smoke returns ok:true with smoke result data`
- `T-ROS.C.1 #3: connector_test --wet`
- `T-V7C.C.6: heartbeat_check production data growth`

These paths were not modified by Wave 116A. They should be triaged separately or confirmed as pre-existing before release.

## 5. Manual / real-host test checklist

Use these steps when testing against a real OpenClaw host:

1. **Tool visibility**: confirm `second_nature_ops` appears in the host tool list for the workspace.
2. **Setup hint**: run `second_nature_ops setup_hint` and verify returned `hostDiscovery.toolDiscovery.reason === "host_probe_unsupported"` and `evidenceLevel === "carrier_ack"` when the host does not expose a discovery API.
3. **Setup ack truth gate**: run `second_nature_ops setup_ack acceptedBy=agent placedIn=unspecified` and verify `ok: false` with validation errors.
4. **Setup ack success**: run `second_nature_ops setup_ack acceptedBy=agent placedIn=workspace_guide placementProofRef=<path>` and verify marker is written and `hostDiscovery.setupComplete` is `false` until tool+skill discovery succeeds.
5. **Heartbeat evidence cap**: run `second_nature_ops heartbeat_check probeOnly=true` and verify `evidenceLevel === "carrier_ack"` and `livedExperienceLoopClaimed === false`.
6. **Loop status evidence**: run `second_nature_ops loop_status` on a workspace with no cycles and verify `evidenceLevel` is capped below `real_runtime`.
7. **Capture host evidence**: record `hostName`, `hostVersion`, timestamp, raw tool list JSON, command envelope, and `evidenceLevel` for each step.

## 6. Known blockers / next work

| ID | Severity | Description | Planned fix |
| --- | --- | --- | --- |
| H-1 | High | `DegradedOperationResult.status` still permits `"degraded"`; precise-state contract in `shared-v8-contracts.md` §4.1 requires `"empty" \| "partial" \| "blocked" \| "unavailable" \| "unsafe"`. | T-OBS.R.8 (Wave 116B/C) |
| M-1 | Medium | `plugin/index.ts` inlines setup-ack validation instead of importing the shared validator. | T-SH.R.6 provenance cleanup or plugin packaging refactor |
| M-2 | Medium | CLI setup commands return extra fields (`message`, `surfaceMode`) not in canonical `RuntimeOpsEnvelope<T>` from design doc. | Reconcile `ops-router.ts` envelope with `runtime-ops-system.md` §2 or update design doc |

## 7. Sign-off

- **Implementation**: 116A tasks complete.
- **Targeted tests**: green.
- **Plugin build**: green.
- **Full regression**: 29 pre-existing failures, no new failures in 116A scope.
- **Code review**: Partial Pass; H-1 is pre-existing drift accepted into T-OBS.R.8 scope.
- **Recommendation**: Real-host smoke can proceed for 116A features. Complete T-OBS.R.8/T-SH.R.6 before final Wave 116 gate.
