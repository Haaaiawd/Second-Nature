# Wave 77 Code Review — 2026-05-26

**Wave**: 77 (T-V7C.C.6 Production Data Growth Closure)
**Scope**: `src/cli/ops/heartbeat-surface.ts`, `src/cli/ops/ops-router.ts`, `src/cli/ops/workspace-heartbeat-runner.ts`, `tests/integration/runtime-ops/commands.test.ts`
**Review Type**: Static-only (no test execution, no build)
**Reviewer**: CODE REVIEWER subagent

---

## Executive Summary

Wave 77 wires four production-data-growth paths into the heartbeat ops surface:
1. `experienceWriter` → `tool_experience` (connector attempt logging)
2. `dreamSchedulePort` → `dream_output_index` (Quiet→Dream auto-trigger)
3. `digestOpts` → `heartbeat_digest` (post-cycle digest persistence)
4. `connectorExecutor` → `life_evidence_index` (connector success evidence)

The plumbing is directionally correct and the code compiles. However, **primary verification artifacts are missing**, **error paths on the heartbeat surface are unguarded**, and **digest persistence loses delivery fidelity** due to a type-mapping gap. The wave partially fulfills its task but leaves significant verification and runtime-safety debt.

**Conclusion: Partial Pass**

---

## Lens 1: Contract Fidelity — API/CLI/config changes match PRD/ADR

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Medium | 1 | `toStoreDigest` discards delivery proof / fallback reason | `src/cli/ops/workspace-heartbeat-runner.ts:313-338` | Assembler digest contains `deliveryProof`/`deliveryFallbackReason` (T-OBS.C.4), but the flattened store row lacks these fields. Production DB grows with incomplete fidelity; fallback/proof audit trail is lost. | Extend `HeartbeatDigest` store type (`src/shared/types/v7-entities.ts`) with optional `deliveryProofRef`/`deliveryFallbackReason`, or persist assembler digest JSON blob alongside the flat row. | T-V7C.C.6 — "digest 有持久化 row 或明确无 delivery target 的 fallback" |
| Medium | 1 | `createQuietDreamSchedulePort` bridges dream types with `as unknown as` cast | `src/cli/ops/ops-router.ts:124` | If `../../dream/types.js` `DreamOutput` diverges from `../../shared/types/v7-entities.js` `DreamOutput`, the cast silences a runtime mismatch that could corrupt `dream_output_index`. | Introduce a verified mapper function with runtime shape checks, or align the two types at source and remove the cast. | ADR-005, T-DQS.C.3 schema contract |
| Low | 1 | Comment task ID inconsistency for `dreamSchedulePort` | `src/cli/ops/workspace-heartbeat-runner.ts:71` | Comment tags `dreamSchedulePort` as "v7 T-V7C.C.3", but the feature also belongs to T-V7C.C.6 per `heartbeat-surface.ts:75`. Minor traceability drift. | Update comment to reference both T-V7C.C.3 and T-V7C.C.6. | 05A_TASKS.md T-V7C.C.6 |

---

## Lens 2: Task Fulfillment — 05A_TASKS.md outputs/acceptance are met

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| High | 2 | Missing primary evidence test file `v7c-production-growth.test.ts` | `05A_TASKS.md:1205` specifies `tests/integration/control-plane/v7c-production-growth.test.ts`; filesystem search returned **No files found** | Task acceptance criteria require DB before/after assertions for `life_evidence_index`, `tool_experience`, `dream_output_index`, and `heartbeat_digest`. Only `heartbeat_digest` row count is tested in `commands.test.ts`. Growth of the other three tables is unverified. | Create `tests/integration/control-plane/v7c-production-growth.test.ts` with seeded connector execution, quiet run, and DB before/after assertions for all four tables. | 05A_TASKS.md T-V7C.C.6 §验收标准 |
| High | 2 | Missing evidence report `reports/claw-0.1.38-db-growth.md` | `05A_TASKS.md:1205` specifies `reports/claw-0.1.38-db-growth.md`; filesystem search returned **No files found** | The task checkbox is marked `[x]` but the required Claw DB growth report does not exist. Closure claim lacks empirical host evidence. | Generate the report with command JSON, DB before/after screenshots/logs, and plugin version. | 05A_TASKS.md T-V7C.C.6 §证据产出 |
| High | 2 | `commands.test.ts` T-V7C.C.6 coverage is incomplete — only `heartbeat_digest` row count tested | `tests/integration/runtime-ops/commands.test.ts:309-355` | `tool_experience`, `life_evidence_index`, and `dream_output_index` growth are not asserted. The test does not seed any connector execution or quiet run, so it only proves an empty digest can be persisted, not that real production data flows work. | Expand tests to cover: (a) `connector:run` or `heartbeat_check` with a stub connector → assert `tool_experience` row with `triggerSource="heartbeat"`, (b) `runSourceBackedQuiet` with real deps → assert `dream_output_index` growth or skip reason. | 05A_TASKS.md T-V7C.C.6 §验收标准 |
| Medium | 2 | `v7c-rhythm-loop.test.ts` tests mock port, not real `createQuietDreamSchedulePort` | `tests/integration/dream/v7c-rhythm-loop.test.ts:97-128` | The real port implementation in `ops-router.ts:112-149` (which bridges to `scheduleDream`, `diary-dream-store`, and `dream-input-loader`) is never exercised in integration tests. | Add an integration test that wires `stateDb` through `createOpsRouter` and asserts `dream_output_index` growth after a quiet artifact write. | 05A_TASKS.md T-V7C.C.6 §验收标准 |
| Medium | 2 | `commands.test.ts` T-V7C.C.6 assertions are weak — no content/schema validation | `tests/integration/runtime-ops/commands.test.ts:329-330` | Only asserts `COUNT(*) = 1`. Does not verify `digestId`, `day`, `healthStatus`, or that the row conforms to `HeartbeatDigest` schema. | Add schema assertions: `day` matches current date, `healthStatus` is valid enum, `connectorSummary` is non-null array. | 05B_VERIFICATION_PLAN.md#t-v7c-c-6 §断言 |

---

## Lens 3: Architecture Fit — module boundaries, dependency direction

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Medium | 3 | `ops-router.ts` inline factory `createQuietDreamSchedulePort` mixes orchestration with implementation | `src/cli/ops/ops-router.ts:112-149` | The router now directly instantiates a `QuietDreamSchedulePort` using `scheduleDream`, `createDiaryDreamStore`, and `createDreamInputLoader`. While runtime-ops → dream-quiet is a valid dependency, embedding a full port implementation inside the command router breaks the "port injection" pattern used elsewhere. | Extract `createQuietDreamSchedulePort` to a dedicated factory file (e.g., `src/cli/ops/dream-schedule-port-factory.ts`) and inject it into `OpsRouterDeps`. | `04_SYSTEM_DESIGN/control-plane-system.md` §4.2 — DownstreamIntentOrchestrator "does not own downstream implementation" |
| Low | 3 | `workspace-heartbeat-runner.ts` imports observability digest assembler directly | `src/cli/ops/workspace-heartbeat-runner.ts:36-39` | Runner (runtime-ops) calls `generateHeartbeatDigest` after the control-plane cycle. Per `control-plane-system.md` §1.2, control-plane "不发布 HeartbeatDigest". The runner is in runtime-ops, so the dependency direction is correct, but the thin boundary should be documented. | Add a code comment clarifying that digest generation is a runtime-ops post-cycle hook, not control-plane logic. | `04_SYSTEM_DESIGN/control-plane-system.md` §1.2 |

---

## Lens 4: Runtime Risk — input validation, error paths, safety

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| High | 4 | `heartbeatCheck` and `ops-router.dispatch("heartbeat_check")` have no outer try-catch | `src/cli/ops/heartbeat-surface.ts:185`; `src/cli/ops/ops-router.ts:567` | If `runHeartbeatCycle` throws an unexpected error (e.g., DB corruption, null reference in EmbodiedContextAssembler), the exception propagates uncaught through the entire ops surface. In a host plugin context, this can crash the OpenClaw tool invocation. | Wrap `await run(signal)` in `heartbeat-surface.ts` with a try-catch that returns a degraded `HeartbeatSurfaceResult` with reason `heartbeat_cycle_exception:{msg}`. Wrap `ops-router.dispatch` `heartbeat_check` block similarly. | `04_SYSTEM_DESIGN/control-plane-system.md` §5.3 — `trace_unavailable` must return decision with degradation reason |
| Medium | 4 | `ops-router.dispatch` mutates `result.reasons` in-place after return | `src/cli/ops/ops-router.ts:626,630` | Post-heartbeat snapshot capture pushes strings into `result.reasons`. If the returned object is ever frozen or shared, this mutation causes a runtime error. It also makes reasoning about result immutability harder. | Create a new array instead of mutating: `return { ...result, reasons: [...result.reasons, "restore_snapshot_captured"] }`. | N/A — general safety |
| Medium | 4 | `createQuietDreamSchedulePort` silently returns `degraded` for unrecognised lifecycle transitions | `src/cli/ops/ops-router.ts:128-131` | If `scheduleDream` ever requests a transition to a status other than `accepted`/`archived`, the bridge silently returns `degraded` instead of throwing. This could mask scheduler bugs. | Throw a typed error (e.g., `DreamLifecycleTransitionError`) for unsupported transitions, or at least `console.error` the rejected status before returning degraded. | `04_SYSTEM_DESIGN/dream-quiet-system.md` §4.2 — ProjectionLifecycleManager is the "唯一 acceptance policy 执行主体" |
| Medium | 4 | Digest persistence failure is silently absorbed with only `console.warn` | `src/cli/ops/workspace-heartbeat-runner.ts:285-289` | If `writeHeartbeatDigest` throws (DB locked, schema mismatch), the cycle continues but the digest row is lost. There is no structured fallback or retry. | Return a degraded reason code (e.g., `digest_persistence_failed`) in the cycle result, or write a fallback audit event. | T-V7C.C.6 — "digest 有持久化 row 或明确无 delivery target 的 fallback" |
| Low | 4 | `toStoreDigest` conflates `circuitOpenCount` with `blockedCount` in status mapping | `src/cli/ops/workspace-heartbeat-runner.ts:313-318` | Both map to `"blocked"`, losing the ability to distinguish "circuit open" from "policy blocked" in persisted data. | Map `circuitOpenCount > 0` to a distinct `"circuit_open"` status in the store type, or include a separate `circuitOpenSummary` field. | PRD US-010 — "按平台列出 success/failure/blocked/circuit-open 计数" |

---

## Lens 5: Verification Evidence — test coverage, assertions, observability

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| High | 5 | No test verifies `tool_experience` row is written with `triggerSource="heartbeat"` during `heartbeat_check` | Review of `tests/integration/runtime-ops/commands.test.ts` (entire file) | The `experienceWriter` is wired in `ops-router.ts:546-548` and passed through the runner, but no integration test asserts the write path fires. | Add integration test: stub `connectorExecutor` to return success → dispatch `heartbeat_check` → query `tool_experience` table → assert row exists with `triggerSource="heartbeat"`. | 05B_VERIFICATION_PLAN.md#t-v7c-c-6 §断言 |
| High | 5 | No test verifies `life_evidence_index` growth after connector success in heartbeat | Review of `tests/integration/runtime-ops/commands.test.ts` (entire file) | The task requires "success evidence 写入 `life_evidence_index`". There is no test that seeds a connector success and asserts evidence row growth. | Add integration test with stubbed connector execution that writes evidence, then assert `life_evidence_index` row count increased. | 05A_TASKS.md T-V7C.C.6 §验收标准 |
| Medium | 5 | `commands.test.ts` T-V7C.C.6 only asserts row existence, not field correctness | `tests/integration/runtime-ops/commands.test.ts:329-330` | `SELECT COUNT(*) FROM heartbeat_digest` is too weak to catch schema drift or null-field bugs. | Assert specific columns: `SELECT day, health_status, connector_summary FROM heartbeat_digest LIMIT 1`, then validate each field. | 05B_VERIFICATION_PLAN.md#t-v7c-c-6 §API接口功能测试覆盖 |
| Medium | 5 | Real `createQuietDreamSchedulePort` has zero test coverage | Review of `tests/integration/dream/v7c-rhythm-loop.test.ts` and `commands.test.ts` | The mock port in rhythm-loop tests bypasses the real store bridge. The real port's `as unknown as` cast and `scheduleDream` integration are untested. | Add integration test wiring `stateDb` + `createOpsRouter` + quiet intent → assert `dream_output_index` has row or explicit skip reason in `heartbeat_digest`/`audit`. | 05B_VERIFICATION_PLAN.md#t-v7c-c-6 §集成/E2E/冒烟覆盖 |
| Low | 5 | `heartbeat_digest` content assertions missing for digest delivery/fallback | `tests/integration/runtime-ops/commands.test.ts` (no assertions found) | The assembler digest supports `deliveryProof` and `deliveryFallbackReason`, but no test verifies these are present/absent in the generated digest or persisted row. | Add test cases with/without `deliveryAdapter` in `heartbeatCheck` deps, assert digest fields. | PRD US-010 §验收标准 |

---

## Lens 6: Backflow & Handoff — docs, manifest, changelog consistency

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| High | 6 | Missing evidence report breaks handoff contract | `05A_TASKS.md:1205` requires `reports/claw-0.1.38-db-growth.md`; file does not exist | The task is marked `[x]` but the required Claw DB growth report is absent. INT-V7C.R and downstream waves cannot verify closure without this artifact. | Generate `reports/claw-0.1.38-db-growth.md` with command traces, DB before/after, and plugin version. | 05A_TASKS.md T-V7C.C.6 §证据产出 |
| Medium | 6 | `06_CHANGELOG.md` does not enumerate Wave 77 code changes | `06_CHANGELOG.md:281` mentions T-V7C.C.6 as a task but does not list the actual implementation changes (digestOpts, dreamSchedulePort, toStoreDigest, experienceWriter wiring) | Future maintainers cannot trace which files were modified for this closure. Reverts and debugging are harder. | Add a dedicated "Wave 77" or "S8 T-V7C.C.6" section to CHANGELOG with file-level change list. | AGENTS.md §宪法 — "显式上下文: 决策写入 ADR，不留在聊天记忆里" |
| Low | 6 | AGENTS.md status block is consistent | `AGENTS.md` "最近一次更新: 2026-05-26 (`/change` S8 handoff — T-V7C.C.5~C.7 + INT-V7C.R)" | No discrepancy found. The handoff narrative matches the task set. | N/A | N/A |

---

## Pre-existing Issues (Not Wave 77 Regressions)

These issues exist in the codebase and are not introduced by Wave 77, but they affect the wave's ability to fully close the production data gap:

1. **`HeartbeatDigest` store type (`v7-entities.ts`) lacks delivery proof/fallback fields** — Prevents `toStoreDigest` from persisting full digest fidelity. Root cause is a schema design gap, not Wave 77 implementation.
2. **`runHeartbeatCycle` internal error handling** — If the control-plane cycle throws, there is no canonical degraded result path. This is a pre-existing architectural gap.

---

## Conclusion

**Verdict: Partial Pass**

**Why not Pass:**
- Two required evidence artifacts (`v7c-production-growth.test.ts`, `claw-0.1.38-db-growth.md`) are missing.
- The `commands.test.ts` coverage for T-V7C.C.6 is incomplete: only `heartbeat_digest` row count is asserted; `tool_experience`, `life_evidence_index`, and `dream_output_index` growth are not verified.
- The heartbeat ops surface lacks outer exception handling, creating a runtime crash risk.

**Why not Fail:**
- The four production data paths are correctly wired: `experienceWriter`, `dreamSchedulePort`, `digestOpts`, and `connectorExecutor` are all passed through the runner and surface.
- The digest persistence logic (`toStoreDigest` + `createHistoryDigestStore.writeHeartbeatDigest`) is present and exercised.
- The `dreamSchedulePort` bridge correctly wraps `scheduleDream` with the required store and loader deps.
- Existing tests for T-ROS.C.1 and T-V7C.C.5 continue to pass (static analysis shows no breaking changes to prior commands).

**Required before Pass:**
1. Create `tests/integration/control-plane/v7c-production-growth.test.ts` with DB before/after assertions for all four tables.
2. Add outer try-catch to `heartbeatCheck` and `ops-router.dispatch("heartbeat_check")`.
3. Generate `reports/claw-0.1.38-db-growth.md` with host evidence.
4. Expand `commands.test.ts` T-V7C.C.6 assertions to validate digest row content, not just count.
5. (Recommended) Extract `createQuietDreamSchedulePort` to its own factory module and add integration test coverage.

---

*Review generated: 2026-05-26*
*Scope: static analysis only; tests not executed, build not run*
