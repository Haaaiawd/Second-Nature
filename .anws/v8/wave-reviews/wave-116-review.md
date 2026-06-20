# Wave 116 Code Review — 2026-06-18

## 1. 总结结论

**Verdict: Partial Pass (static).**

Wave 116A lands the three tasks it signed up for: host skill discovery probe with explicit `skill_projection_unavailable` (T-ROS.R.7), setup-ack truth gate rejecting `placedIn: "unspecified"` (T-ROS.R.8), and an `EvidenceLevelClassifier` that caps carrier/smoke/state evidence below `real_runtime` (T-OBS.R.7). Unit tests cover the new surfaces and no Critical issues were found.

The wave cannot receive a full Pass because:

1. `src/shared/types/v8-contracts.ts` still defines `DegradedOperationResult.status` as `"degraded" | "blocked"`, which directly contradicts the T-OBS.R.8 / shared-v8-contracts.md §4.1 precise-state contract (`"empty" | "partial" | "blocked" | "unavailable" | "unsafe"`). This drift blocks the remaining Wave 116 tasks that depend on the precise degraded taxonomy.
2. `plugin/index.ts` re-implements setup-ack validation instead of importing the shared `src/shared/setup-ack.js` contract, creating divergence risk between CLI and plugin ack files.
3. CLI `setup_hint`/`setup_ack` return ad-hoc shapes (`data`, `message`, `surfaceMode`) rather than the canonical `RuntimeOpsEnvelope` (`result`, `generatedAt`), which weakens the host-reality envelope contract from runtime-ops-system.md §2.

Remaining Wave 116 tasks (T-ROS.R.5, T-SH.R.6, T-CP.R.5, T-AC.R.2, T-OBS.R.8, T-CS.R.9, T-DQ.R.9, INT-R11) are explicitly out of 116A scope and are treated as planned next steps, not as findings.

## 2. 审查范围与静态边界

Read anchors:

- `.anws/v8/05A_TASKS.md` Wave 116 116A tasks T-ROS.R.7, T-ROS.R.8, T-OBS.R.7 and the explicitly deferred remainder (**05A_TASKS.md:1912-1955**, scope as of 2026-06-18).
- `.anws/v8/05B_VERIFICATION_PLAN.md` T-ROS.R.7, T-ROS.R.8, T-OBS.R.7 and INT-R11 evidence expectations (**05B_VERIFICATION_PLAN.md:1041-1094**).
- `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md` §2/§3.1/§3.2/§3.3: `RuntimeOpsEnvelope`, `HostCapabilityDiscoveryPort`, `SetupAck` schema, evidence caps.
- `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md` §2/§4.1/§4.2: `SourceRef` family, `DegradedOperationResult` precise states, evidence levels.
- Implementation files changed in 116A: `src/shared/setup-ack.ts`, `src/shared/evidence-level-classifier.ts`, `src/shared/types/v8-contracts.ts`, `src/cli/host-capability/host-discovery-port.ts`, `src/cli/commands/index.ts`, `plugin/index.ts`, and their unit tests.

Static boundary:

- No tests, build, typecheck, or SQLite runtime execution were run in this review.
- Findings are anchored to source lines and design documents only.

## 3. 契约 → 代码映射摘要

| Contract / task promise | Static implementation evidence |
| --- | --- |
| T-ROS.R.7 — host skill discovery probe or explicit `skill_projection_unavailable` | `src/cli/host-capability/host-discovery-port.ts` defines `HostCapabilityDiscoveryPort`, `createDefaultHostDiscoveryPort` returns `status: "unsupported"` with `reason: "skill_probe_unsupported"`, and `probeHostDiscovery` reports `setupComplete: false` / `evidenceLevel: "carrier_ack"` when host probe is unsupported (**src/cli/host-capability/host-discovery-port.ts:50-92**). Tests cover missing tool, missing skill, and complete discovery cases (**tests/unit/cli/host-discovery-port.test.ts:27-97**). |
| T-ROS.R.8 — `placedIn: "unspecified"` is incomplete | `src/shared/setup-ack.ts` rejects `placedIn === "unspecified"` and missing `placedIn` with explicit `field: "placedIn"` errors (**src/shared/setup-ack.ts:80-95**). CLI `setup_ack` refuses to write the marker when validation fails (**src/cli/commands/index.ts:195-208**). Tests cover unspecified, missing, unknown placements (**tests/unit/shared/setup-ack-validator.test.ts:29-49**). |
| T-OBS.R.7 — evidence level taxonomy and caps | `src/shared/evidence-level-classifier.ts` defines `EVIDENCE_LEVEL_ORDER`, `classifyEvidenceLevel`, `capEvidenceLevel`, `minEvidenceLevel`, `promoteEvidenceLevel` with monotonic rules; carrier/smoke/state cannot be reported as `real_runtime` without proof flags (**src/shared/evidence-level-classifier.ts:1-180**). Tests cover all five levels and cap/promote semantics (**tests/unit/shared/evidence-level-classifier.test.ts:23-158**). |
| `EvidenceLevel` type added to shared contracts | `src/shared/types/v8-contracts.ts` adds `EvidenceLevel` union and imports it where needed (**src/shared/types/v8-contracts.ts:159-164**). |
| Host discovery evidence levels are honest | Default unsupported probe reports `carrier_ack`; partial host state (tool or skill present but incomplete) reports `state_present`; full discovery reports `state_present` because it is durable state, not live runtime execution (**src/cli/host-capability/host-discovery-port.ts:66-92**). This respects runtime-ops-system.md §3.3 caps. |
| `setup_hint` returns packaged SKILL and guide content | `src/cli/commands/index.ts` reads `SKILL.md` and `agent-inner-guide.md` and returns summary or full content, plus host discovery and ack status (**src/cli/commands/index.ts:106-170**). |

## 4. Issues

### H-1 — `DegradedOperationResult.status` still permits `"degraded"`, violating precise-state contract

- **Severity**: High
- **Lens**: Contract Fidelity / Task Fulfillment
- **Evidence**: `src/shared/types/v8-contracts.ts:183` defines `status: "degraded" | "blocked"`. Design authority `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md:186-196` requires `status: "empty" | "partial" | "blocked" | "unavailable" | "unsafe"` and states `"degraded"` is aggregate/read-model only.
- **Impact**: Stage-level diagnostics and downstream consumers can still carry the generic `"degraded"` string, directly contradicting T-OBS.R.8 (precise operational status taxonomy). Any code that switches on `DegradedOperationResult.status` will not handle the precise states, so the new taxonomy cannot be enforced.
- **Minimum fix**: Change `DegradedOperationResult.status` to the precise-state union and fix any compile errors in consumers. Update `tests/unit/contracts/v8-shared-contracts.test.ts` to assert the new shape.
- **Anchor**: `src/shared/types/v8-contracts.ts:182-189`, `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md:186-196`.

### M-1 — Plugin duplicates setup-ack validation instead of sharing canonical contract

- **Severity**: Medium
- **Lens**: Architecture Fit / Backflow & Handoff
- **Evidence**: `plugin/index.ts:205-296` re-implements `validateSetupAck`, `VALID_PLACEMENTS`, `VALID_WRITERS`, and error shapes. The canonical validator lives in `src/shared/setup-ack.ts`. `plugin/runtime/shared/` currently does not package `setup-ack.js`.
- **Impact**: Future changes to placement targets, writers, or error schema must be edited in two places; the plugin and CLI can silently diverge, producing ack files that one side accepts and the other rejects.
- **Minimum fix**: Add `src/shared/setup-ack.ts` to the plugin runtime artifact list (likely `scripts/build-plugin-package.ts`) and import the shared validator from `plugin/index.ts`. If packaging constraints force duplication, add a source-of-truth comment with a hard link to `src/shared/setup-ack.ts` and a CI check that diffs the two validators.
- **Anchor**: `plugin/index.ts:205-296`, `src/shared/setup-ack.ts:66-147`.

### M-2 — CLI `setup_hint`/`setup_ack` return ad-hoc shapes instead of `RuntimeOpsEnvelope`

- **Severity**: Medium
- **Lens**: Contract Fidelity
- **Evidence**: `src/cli/commands/index.ts:161-169` and `:219-232` return objects with `ok`, `command`, `surfaceMode`, `evidenceLevel`, `message`, `data`. Runtime-ops-system.md §2 defines `RuntimeOpsEnvelope<T>` with fields `ok`, `command`, `evidenceLevel`, `result?`, `degraded?`, `generatedAt` — no `surfaceMode`, `message`, or `data`.
- **Impact**: Host/bridge consumers that expect the canonical envelope will miss `result`, `degraded`, and `generatedAt`, and may fail to parse `data`/`message`. This weakens the host-reality contract T-ROS.R.5/R.7 rely on.
- **Minimum fix**: Align setup command returns with `RuntimeOpsEnvelope`: put the payload under `result`, add `generatedAt: new Date().toISOString()`, and surface degraded state under `degraded` when host discovery is blocked. Keep `message` as a human-readable string inside `result` if needed, but not as a top-level envelope field.
- **Anchor**: `src/cli/commands/index.ts:161-169`, `src/cli/commands/index.ts:219-232`, `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md:36-44`.

### L-1 — `SourceRefFamily` includes `"projection"` not defined in design authority

- **Severity**: Low
- **Lens**: Contract Fidelity
- **Evidence**: `src/shared/types/v8-contracts.ts:73` includes `"projection"` in the `SourceRefFamily` union. `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md:47-57` lists the canonical families as `"evidence"`, `"perception"`, `"judgment"`, `"action_closure"`, `"quiet_review"`, `"dream_run"`, `"memory_projection"`, `"tool_experience"`, `"connector_result"`, `"audit"` — no `"projection"`.
- **Impact**: Extra enum value invites ambiguous refs; consumers cannot resolve `"projection"` against the documented URI family shape `sn://{family}/{id}`.
- **Minimum fix**: Remove `"projection"` from `SourceRefFamily` or add it to `shared-v8-contracts.md` §2 with a documented meaning if it is intentional.
- **Anchor**: `src/shared/types/v8-contracts.ts:65-76`, `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md:47-57`.

### L-2 — Plugin `SetupAckMarker.source` differs from CLI ack `source`

- **Severity**: Low
- **Lens**: Contract Fidelity / Backflow & Handoff
- **Evidence**: `plugin/index.ts:171` constrains `source` to `"second-nature-plugin"`; `src/cli/commands/index.ts:189` writes `"second-nature-cli"`. The shared `SetupAck` contract in `src/shared/setup-ack.ts:26-36` and runtime-ops-system.md §3.2 does not include `source` at all.
- **Impact**: Type-only mismatch; validator ignores the field so runtime behavior is unaffected, but the plugin's local type misleads maintainers about what a valid ack file looks like.
- **Minimum fix**: Either add `source` to the canonical `SetupAck` contract with allowed values for both CLI and plugin, or drop `source` from both the CLI write path and the plugin `SetupAckMarker` interface.
- **Anchor**: `plugin/index.ts:163-175`, `src/cli/commands/index.ts:172-193`, `src/shared/setup-ack.ts:26-36`.

## 5. Lens 结果摘要

- **Lens 1 — Contract Fidelity: Degraded.** T-ROS.R.7/R.8/OBS.R.7 implementations match their immediate design contracts, but `DegradedOperationResult.status` and `SourceRefFamily` drift from `shared-v8-contracts.md`, and CLI setup command envelopes drift from `RuntimeOpsEnvelope`.
- **Lens 2 — Task Fulfillment: Partial Pass.** The three 116A tasks are implemented and unit-tested. Remaining Wave 116 tasks are explicitly deferred and not evaluated here.
- **Lens 3 — Architecture Fit: Partial Pass.** Host discovery port and evidence classifier are clean, dependency-free shared utilities. Plugin duplication of setup-ack validation is a maintainability regression that should be unified.
- **Lens 4 — Runtime Risk From Static Evidence: Pass.** No secrets, no unbounded loops, no unsafe external writes in the new code. Evidence levels are capped honestly; default host discovery fails closed with explicit reasons.
- **Lens 5 — Verification Evidence: Pass for 116A scope.** Unit tests exist for all three delivered tasks and cover the key branches (unsupported probe, missing tool/skill, unspecified placement, evidence-level caps). INT-R11 does not yet exist because the rest of Wave 116 is not implemented.
- **Lens 6 — Backflow & Handoff: Partial Pass.** `05A_TASKS.md` correctly reflects 116A progress. The review report should be linked in `06_CHANGELOG.md` when 116A settles. Plugin/CLI ack divergence must be resolved before T-SH.R.6 provenance work can safely reuse setup proof refs.

## 6. 安全 / 测试覆盖补充

- **No new runtime secrets or external dependencies**: Wave 116A adds only validation, classification, and probe adapters; no new env vars beyond optional host probe inputs.
- **Evidence-level caps are conservative**: `setup_hint` caps at `contract_smoke`, default host discovery at `carrier_ack`, partial host state at `state_present`; no surface falsely claims `real_runtime`.
- **Test gaps for envelope shape**: No test currently asserts that `setup_hint`/`setup_ack` return a `RuntimeOpsEnvelope`-compatible shape; add one before T-ROS.R.5 host-tool injection work.
- **Recommended next order**: (1) fix H-1 `DegradedOperationResult` precise states; (2) unify M-1 plugin/CLI setup-ack validation; (3) align M-2 setup envelopes; (4) proceed to 116B (T-CP.R.5, T-AC.R.2, T-OBS.R.8) with the corrected contract.
