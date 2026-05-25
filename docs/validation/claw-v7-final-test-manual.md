<!--
评测列语义（旅程结果 / Step 结果）：仅允许 PASS | PARTIAL_PASS | FAIL。
未在用户授权并完成 Claw / OpenClaw 实机回填前：留空或写「待实机」。
严禁写任一 verdict 冒充已验证，严禁自拟其它档位或同义粉饰。
-->

# Second Nature v7 Final Claw Test Manual

## E2E Verification

### Scope
- PRD / 需求来源: `.anws/v7/01_PRD.md`, `.anws/v7/05A_TASKS.md`, `.anws/v7/05B_VERIFICATION_PLAN.md`, `reports/int-s6-e2e-release-gate-v7.md`
- Target: `@haaaiawd/second-nature@0.1.30`
- Environment: Claw / OpenClaw host with npm registry access and a real agent workspace
- Browser / Viewport（计划）: N/A unless Claw UI is used for plugin install; primary verification is host CLI + agent tool transcript
- User Role: plugin operator / Claw agent owner
- Build / Commit: fill with local commit SHA before running
- Package source: publish from `D:\PROJECTALL\Second-Nature\plugin` using `npm publish`

### Preconditions
- Node.js and npm are available in the host environment.
- `npm whoami` returns an account allowed to publish or install `@haaaiawd/second-nature`.
- `npm config get registry` returns `https://registry.npmjs.org/` unless deliberately testing a private registry.
- Plugin version fields are aligned: root `package.json`, `plugin/package.json`, and `plugin/openclaw.plugin.json` all read `0.1.30`.
- Claw agent workspace path is known. Prefer a single absolute path that contains or will contain `data/`, `workspace/`, `SOUL.md`, and `HEARTBEAT.md`.
- Set `SECOND_NATURE_WORKSPACE_ROOT` to the agent workspace path for full workspace bridge tests.
- Set `SECOND_NATURE_ENCRYPTION_KEY` to a stable host-managed value for credential/runtime secret tests. Do not paste the key into logs.
- If the agent uses DeepSeek or another external model provider, verify that provider health first. A provider HTTP 500 is an environment failure, not a Second Nature plugin failure.

### PRD traceability (RTM)
| PRD ref | Summary | Priority | Journeys |
| --- | --- | --- | --- |
| REQ-001 | Heartbeat reads embodied context slices | P0 | J4, J5 |
| REQ-002 | Agent-facing ToolAffordanceMap is reachable | P1 | J5 |
| REQ-003 | ToolExperience and pain signals are observable | P1 | J5 |
| REQ-004 | Goal lifecycle and idle curiosity are available through heartbeat/runtime state | P0 | J4, J5 |
| REQ-005 | Quiet/Dream projection can be read by runtime surfaces | P1 | J5 |
| REQ-006 | Channel feedback path is present and does not claim delivery without proof | P1 | J6 |
| REQ-007 | SelfHealthSnapshot is available and bounded | P0 | J5 |
| REQ-008 | IdentityProfile can be consumed by embodied context | P1 | J4 |
| REQ-009 | Connector probe / circuit breaker / manual wet probe surface is available | P0 | J5, J6 |
| REQ-010 | HeartbeatDigest is available | P1 | J5 |
| REQ-011 | NarrativeTimeline and RestoreSnapshot are available | P0 | J5, J6 |
| REQ-012 | Runtime secret anchor and recovery surface are available without exposing plaintext | P0 | J2, J5 |
| T-ROS.C.2 | Plugin registration exposes command/tool/services | P0 | J2, J3 |
| T-ROS.C.3 | ManualRunDispatcher routes manual ops without affecting heartbeat cadence | P0 | J5 |
| T-ROS.C.4 | README / AGENTS bootstrap recovery docs are aligned | P1 | J1 |
| INT-S6 | S6 release gate closes package, plugin, docs, regression, and host smoke | P0 | J1-J6 |

### Surface coverage
| 功能面 / 入口 | 如何发现 | Journey | PRD ref | Notes |
| --- | --- | --- | --- | --- |
| npm package publish/install | Operator runs `npm publish` from `plugin/`, then host installs package | J1 | INT-S6 | Publish is destructive to registry state; operator authorization required |
| plugin manifest | Host reads `plugin/openclaw.plugin.json` from package | J1, J2 | T-ROS.C.2 | Must expose `second_nature_ops`, `second-nature`, lifecycle/runtime services |
| plugin module entry | Host imports `index.js` | J2 | T-ROS.C.2 | Must not require `openclaw/plugin-sdk` at module import time |
| Claw plugin list / info | Operator runs Claw plugin inspection command | J2 | T-ROS.C.2 | Exact command depends on host version |
| agent tool list | Agent session exposes `second_nature_ops` | J3 | T-ROS.C.2 | Tool visibility is the primary session-level evidence |
| host-safe carrier | Agent calls `heartbeat_check` without workspace root | J4 | REQ-001, T-ROS.C.2 | Expected carrier acknowledgement, not full runtime |
| workspace full bridge | Agent calls commands with `SECOND_NATURE_WORKSPACE_ROOT` or `workspaceRoot` | J5 | REQ-001 through REQ-012 | Expected `runtimeMode` or surface mode to show workspace/full bridge where applicable |
| v7 runtime ops | `self_health`, `heartbeat_digest`, `timeline`, `restore`, `runtime_secret_bootstrap`, `connector_test --wet` | J5, J6 | T-ROS.C.1, T-ROS.C.3 | Some commands may return explicit unavailable if optional ports are not configured |
| external model provider | Claw / agent model API such as DeepSeek | J0 | INT-S6 | Provider 500 must be recorded as environment blocker |

### Journeys（旅程级）
| ID | PRD ref | User Journey | 旅程结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J0 | INT-S6 | Preflight external dependency health before blaming plugin | 待实机 | Provider health check log, failed request ID if any | DeepSeek HTTP 500 is env blocker, not plugin defect |
| J1 | INT-S6, T-ROS.C.4 | Publish/install package from folder and confirm package metadata | 待实机 | npm publish/install log, package version, manifest excerpt | Run from `plugin/` |
| J2 | T-ROS.C.2 | Host loads plugin module and registers command/tool/services | 待实机 | Claw plugin info, gateway log with Second Nature sentinels | Must not crash during import |
| J3 | T-ROS.C.2 | Agent session sees and can invoke `second_nature_ops` | 待实机 | Tool list screenshot/log, tool call transcript | Tool visibility failure is host config or plugin load issue |
| J4 | REQ-001, REQ-004 | Host-safe carrier heartbeat works without workspace root | 待实机 | `heartbeat_check` JSON response | Expected carrier mode, not full runtime |
| J5 | REQ-001-REQ-012 | Full workspace bridge executes v7 ops against real workspace | 待实机 | JSON outputs for each command, workspace DB/file evidence | Requires correct workspace root |
| J6 | REQ-006, REQ-009, REQ-011 | Failure/recovery boundaries are explicit and non-destructive | 待实机 | connector/restore/runtime secret outputs, audit/fallback evidence | Do not run wet connector against production without authorization |

### Step breakdown
| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J0 | Read screen/log first: confirm Claw host, model provider, and network are healthy. Then run a simple non-plugin agent/model request. Observable result: provider request succeeds or fails with provider-specific error. | INT-S6 | 待实机 | Claw log and provider response status | If DeepSeek returns 500, pause plugin judgment |
| J0 | If provider is unhealthy, record exact timestamp, provider name, request ID if available, and retry after provider recovery. Observable result: plugin tests are marked blocked by environment, not failed. | INT-S6 | 待实机 | Blocker note | Do not file plugin bug for provider outage |
| J1 | Read `plugin/package.json` and `plugin/openclaw.plugin.json`; verify both show `0.1.30`, `main: ./index.js`, and `openclaw.runtimeExtensions: ["./index.js"]`. | INT-S6 | 待实机 | File excerpt | Version drift blocks publish |
| J1 | From `D:\PROJECTALL\Second-Nature\plugin`, run `npm publish --dry-run`. Observable result: npm prints `+ @haaaiawd/second-nature@0.1.30` and lists `index.js`, `workspace-ops-bridge.js`, `openclaw.plugin.json`, `SKILL.md`, `agent-inner-guide.md`, and `runtime/`. | INT-S6 | 待实机 | Command log | Dry-run only, no registry side effect |
| J1 | With operator authorization, run `npm publish` from `plugin/`. Observable result: npm publishes `@haaaiawd/second-nature@0.1.30` to configured registry. | INT-S6 | 待实机 | Publish log and npm package page/version query | Registry write; requires explicit operator approval |
| J1 | On the Claw host, install or update to `@haaaiawd/second-nature@0.1.30` using the host's plugin install flow. Observable result: package resolves to `0.1.30`, not `0.1.29`. | INT-S6 | 待实机 | Install log | Exact Claw command depends on host |
| J2 | Read Claw plugin info/list screen or command output. Expected visible structure: plugin id `second-nature`, name `Second Nature`, version `0.1.30`, contracts for command `second-nature`, tool `second_nature_ops`, services `second-nature-runtime` and `second-nature-lifecycle`. | T-ROS.C.2 | 待实机 | Plugin info log/screenshot | If shape says non-capability, that can be expected for tool-only plugin |
| J2 | Restart or reload Claw gateway. Expected log sequence includes `[second-nature] module evaluated`, `register() entered`, and `register() completed`. | T-ROS.C.2 | 待实机 | Gateway log excerpt | Absence means host did not load entry |
| J2 | Confirm plugin import does not fail with `ERR_MODULE_NOT_FOUND` for `openclaw/plugin-sdk`. Observable result: no such error in gateway or install logs. | T-ROS.C.2 | 待实机 | Gateway/install log | This was the 0.1.29 package risk |
| J3 | Open a fresh agent session. Read the available tool list before prompting. Expected structure: `second_nature_ops` appears as an available tool. | T-ROS.C.2 | 待实机 | Tool list transcript/screenshot | If hidden, inspect Claw tools profile/allow list |
| J3 | Ask the agent to call `second_nature_ops` with `{ "command": "heartbeat_check", "args": { "probeOnly": true } }`. Observable result: JSON content is returned, not a natural-language-only answer. | T-ROS.C.2 | 待实机 | Tool call transcript | Tool shell must be executable |
| J4 | With no `SECOND_NATURE_WORKSPACE_ROOT` and no `workspaceRoot` argument, call `heartbeat_check` probe-only. Expected result: explicit host-safe/carrier response with `runtime_carrier_only` or equivalent bridge acknowledgement. | REQ-001 | 待实机 | JSON response | This is allowed and should not be treated as full runtime |
| J4 | Call `status`, `quiet`, and `explain` without workspace root. Expected result: explicit unavailable or carrier response that names missing workspace root/read models, not a crash and not fake success. | REQ-001, REQ-005 | 待实机 | JSON responses | Confirms honest boundary |
| J5 | Set `SECOND_NATURE_WORKSPACE_ROOT` to the real agent workspace. Read screen/log first: confirm the same path contains or will contain `data/state.db`, `data/observability.db`, `SOUL.md`, and `HEARTBEAT.md`. | REQ-001 | 待实机 | Env log and directory listing | Wrong root is the most common false failure |
| J5 | Call `heartbeat_check` with `probeOnly: true` and known workspace root. Expected result: workspace bridge path is attempted and response identifies workspace root resolution as env or tool args. | REQ-001 | 待实机 | JSON response | If bridge fails, capture error code |
| J5 | Call `heartbeat_check` with `probeOnly: false`. Expected result: full heartbeat path reads available state slices or returns explicit missing-state reasons without crashing. | REQ-001, REQ-004, REQ-008 | 待实机 | JSON response, DB timestamp if changed | Do not require outreach delivery in this step |
| J5 | Call `self_health`. Expected result: RuntimeOpsEnvelope with self-health data, bounded probe outcomes, and no unhandled exception. | REQ-007 | 待实机 | JSON response | P95 measurement requires repeated sampling |
| J5 | Call `heartbeat_digest`. Expected result: digest data if audit store has entries, or explicit `AUDIT_STORE_UNAVAILABLE` / no-data reason if not seeded. | REQ-010 | 待实机 | JSON response | No-data is not a plugin failure |
| J5 | Call `timeline` and `narrative:diff` with valid versions if available. Expected result: timeline page/diff data or explicit missing-version message. | REQ-011 | 待实机 | JSON response | Do not invent narrative versions |
| J5 | Call `runtime_secret_bootstrap`. Expected result: recovery/status view never contains plaintext `SECOND_NATURE_ENCRYPTION_KEY`; missing or wrong key returns recovery steps. | REQ-012 | 待实机 | Redacted JSON response | Secret must not appear in logs |
| J5 | Call `tool_affordance`. Expected result: affordance data if port is wired, or explicit `TOOL_AFFORDANCE_PORT_UNWIRED` if not. | REQ-002 | 待实机 | JSON response | Explicit unwired is acceptable if documented |
| J5 | Call `connector_status`. Expected result: registry/trust/capability status is returned, or explicit missing registry/workspace reason. | REQ-009 | 待实机 | JSON response | Requires connector manifests |
| J6 | With explicit authorization only, run `connector_test` dry-run first. Expected result: dry-run does not perform wet external side effects. | REQ-009, T-ROS.C.3 | 待实机 | JSON response | No external write expected |
| J6 | With explicit authorization only, run `connector_test --wet` or equivalent args for a non-production connector. Expected result: returned status reflects real probe attempt, `dryRun=false`, and manual trigger does not affect heartbeat cadence. | REQ-009, T-ROS.C.3 | 待实机 | JSON response, connector service log | Do not run against production without approval |
| J6 | Prepare a restore test workspace with disposable state. Call `restore` with `restoreTarget`, `fromVersion`, and `toVersion`. Expected result: bounded restore calls RestoreSnapshotStore, writes restore audit, reports completed/failed entities, and does not restore credentials. | REQ-011 | 待实机 | JSON response, DB/audit evidence | Never test restore on irreplaceable state |
| J6 | Simulate missing workspace root, missing secret key, and unavailable provider one at a time. Expected result: each failure returns a specific error/recovery code and does not collapse into generic internal server error. | REQ-006, REQ-012 | 待实机 | JSON responses and Claw logs | One failure per run for clean attribution |

### Expected command payload examples

Use the host's native tool-call UI when available. If writing JSON manually, keep payloads structurally equivalent.

```json
{ "command": "heartbeat_check", "args": { "probeOnly": true } }
```

```json
{
  "command": "heartbeat_check",
  "args": { "probeOnly": false },
  "workspaceRoot": "D:\\PROJECTALL\\Second-Nature"
}
```

```json
{ "command": "self_health", "args": {} }
```

```json
{ "command": "heartbeat_digest", "args": { "date": "2026-05-24" } }
```

```json
{
  "command": "restore",
  "args": {
    "restoreTarget": "narrative",
    "fromVersion": "test-from",
    "toVersion": "test-to"
  }
}
```

### Evidence capture rules
- Capture raw JSON for every `second_nature_ops` response.
- Capture Claw gateway logs around plugin load/reload.
- Capture tool list evidence before the first tool call.
- Redact `SECOND_NATURE_ENCRYPTION_KEY`, connector tokens, user private content, and provider API keys.
- For failures, capture timestamp, command payload, response JSON, gateway log excerpt, and whether DeepSeek or another provider was healthy at the same time.
- Use only PASS, PARTIAL_PASS, or FAIL when filling verdicts after实机. If blocked by environment, leave result as `待实机` and add a blocker note.

### Findings
- [HIGH/MEDIUM/LOW] 实机后填写
  - PRD ref:
  - Expected / Actual / Repro / Evidence / Suggested fix:

### Coverage gaps
- Browser viewport and visual UI are N/A unless the Claw plugin manager UI is part of the test.
- Real delivery to an owner channel is not required unless a safe test channel and host proof are available.
- Wet connector tests must use non-production credentials or a disposable connector target.
- Restore must be tested only on disposable state.
- P95 heartbeat/self-health numbers require repeated sampling; single-call smoke only proves basic responsiveness.

### Blockers
- DeepSeek or selected model provider returning HTTP 500 blocks agent-level testing and must not be recorded as a plugin failure.
- Missing `SECOND_NATURE_WORKSPACE_ROOT` limits tests to host-safe carrier behavior.
- Missing or wrong `SECOND_NATURE_ENCRYPTION_KEY` blocks credential/runtime-secret success paths but should produce recovery guidance.
- Host tool profile may hide `second_nature_ops`; if so, inspect Claw `tools.allow` or tool profile configuration before filing a plugin bug.

### Recommendation
- This document is a guide-only handoff until Claw 实机 evidence is filled.
- Proceed with Claw testing after provider health, workspace root, and runtime secret preconditions are satisfied.
- If J1-J3 fail, stop and fix installation/plugin registration before testing runtime commands.
- If J4 passes but J5 fails, focus on workspace root, packaged runtime bridge, and DB path alignment.
- If only J0 fails, treat it as external provider outage.
