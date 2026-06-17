<!--
评测列语义（旅程结果 / Step 结果）：仅允许 PASS | PARTIAL_PASS | FAIL。
未在用户授权并完成实机回填前：留空或写「待实机」；本文件为 guide-only，不填 verdict。
-->

## E2E Verification

### Scope
- PRD / 需求来源: `.anws/v8/01_PRD.md` US-001..US-009, `.anws/v8/05B_VERIFICATION_PLAN.md`, `plugin/openclaw.plugin.json` ops surface.
- Target: Second Nature OpenClaw plugin / CLI ops surface / v8 Living Perception Loop.
- Environment: Local workspace with `@haaaiawd/second-nature@0.2.12` installed or packed; stable writable workspace root; `SECOND_NATURE_WORKSPACE_ROOT` points to that workspace.
- Browser / Viewport（计划）: Not applicable; this is runtime/ops E2E. If OpenClaw provides a tool panel, capture tool result JSON screenshots or logs.
- User Role: Owner/operator with access to OpenClaw `second_nature_ops` tool and local workspace files.
- Build / Commit: `0.2.12`; exact git commit to be filled after release-prep commit.

### PRD traceability (RTM)
| PRD ref | Summary | Priority | Journeys |
| --- | --- | --- | --- |
| REQ-001 / US-001 | Connector read results become source-backed `EvidenceItem` without fabrication. | P0 | J1, J4 |
| REQ-002 / US-002 | Evidence becomes readable `PerceptionCard` with topic, summary, relevance, risk and source refs. | P0 | J1, J4 |
| REQ-003 / US-003 | Agent judgment produces reasoned verdicts and downgrades unsafe/missing-source cases. | P0 | J1, J3 |
| REQ-004 / US-004 | Platform-neutral action policy gates all write-side autonomous actions. | P0 | J3, J5 |
| REQ-005 / US-005 | Quiet/Dream, not realtime code, forms accepted long-term memory projections. | P0 | J2 |
| REQ-006 / US-006 | Quiet/Dream lifecycle exposes scheduled/blocked/completed reasons. | P1 | J2, J6 |
| REQ-007 / US-007 | Sensitivity classifier distinguishes public technical words from credential-shaped secrets. | P1 | J4, J5 |
| REQ-008 / US-008 | `loop_status` localizes causal loop stalls and degraded storage/runtime states. | P1 | J6 |
| REQ-009 / US-009 | Every heartbeat produces action closure or explicit no-action reason. | P0 | J1, J6 |

### Surface coverage
| 功能面 / 入口 | 如何发现 | Journey | PRD ref | Notes |
| --- | --- | --- | --- | --- |
| OpenClaw plugin registration | Install package, start OpenClaw, confirm `second_nature_ops` tool exists. | J0 | Runtime ops / REQ-008 | Capture tool list or host log showing registration. |
| Workspace binding | `SECOND_NATURE_WORKSPACE_ROOT` or tool `workspaceRoot` parameter. | J0, J1 | Runtime ops / REQ-009 | Must point to same workspace the agent is using. |
| `heartbeat_check` / `heartbeat_run` | Call `second_nature_ops` with command `heartbeat_check` or alias `heartbeat_run`. | J1 | REQ-001..REQ-009 | Primary real loop entrance. |
| `connector:run` / `connector_status` | Call connector command through ops tool. | J4 | REQ-001, REQ-007 | Prefer read-only `moltbook feed.read` fixture unless real credentials are authorized. |
| `loop_status` | Call ops command after heartbeat cycles. | J6 | REQ-008 | Main causal health readout. |
| `heartbeat_digest` | Call after at least one heartbeat. | J6 | REQ-008, REQ-009 | Confirms operator-facing summary. |
| `guidance_payload` | Call after heartbeat or seeded impulse context. | J3 | REQ-003, REQ-004 | Confirms expression boundary and source-backed guidance. |
| `tool_affordance` | Call before connector write/read scenarios. | J3, J5 | REQ-004 | Confirms body/tool side-effect posture. |
| `self_health` | Call before and after E2E. | J0, J6 | REQ-008 | Captures runtime/storage/secret health. |
| `snapshot:capture` / `restore` | Call in a disposable workspace only. | J7 | Runtime safety | Side-effectful state operation; requires explicit owner authorization. |
| `runtime_secret_bootstrap` | Call without exposing key material. | J5 | REQ-007 / NG4 | Must never return raw encryption key. |
| `setup_hint` / `setup_ack` | First-run guide surface in plugin. | J0 | Runtime ops | Optional, verifies packaged guide availability. |

### Journeys（旅程级）
| ID | PRD ref | User Journey | 旅程结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J0 | Runtime ops / REQ-008 | First-run plugin and workspace readiness: operator installs package, starts OpenClaw, confirms tool registration, workspace binding, setup hint, and self health. | 待实机 | Host tool list, `second_nature_ops self_health` JSON, setup hint JSON. | No external write. |
| J1 | REQ-001, REQ-002, REQ-003, REQ-009 | Living loop heartbeat: run heartbeat from a clean workspace and confirm evidence/no-evidence, perception/judgment, closure, rhythm and impulse context are explicit. | 待实机 | `heartbeat_check` JSON, state DB row counts, `loop_status` JSON. | Empty input must still produce no-action closure. |
| J2 | REQ-005, REQ-006 | Quiet/Dream memory path: create enough source-backed closures, run heartbeat rhythm, verify Quiet review, Dream run lifecycle, and accepted projection visibility. | 待实机 | `heartbeat_check` rhythm fields, DB rows, projection artifact/log. | Long-term memory acceptance may require seeded test fixture or manual acceptance step. |
| J3 | REQ-003, REQ-004 | Policy and guidance boundary: verify agent can draft/notify without bypassing policy, and unsafe write-side action downgrades or denies. | 待实机 | `guidance_payload`, `tool_affordance`, action closure JSON. | Do not perform real external write without owner authorization. |
| J4 | REQ-001, REQ-002, REQ-007 | Connector read evidence path: run read-only connector or fixture, verify content-bearing evidence, public technical sensitivity, perception and no fabrication on empty/failure. | 待实机 | `connector:run` JSON, evidence rows/artifacts, `loop_status`. | Use mock/stub unless real credential route is intentionally tested. |
| J5 | REQ-004, REQ-007, NG4 | Secret and safety boundaries: verify runtime secret health reports, no plaintext key exposure, credential-shaped content blocks raw exposure, and public technical text is not overblocked. | 待实机 | `runtime_secret_bootstrap`, `self_health`, classifier/connector outputs. | Never paste real secrets into prompts or logs. |
| J6 | REQ-008, REQ-009 | Observability and diagnosis: after normal and degraded cycles, verify `loop_status` attributes stall/degraded reason to ingestion/perception/judgment/policy/execution/closure/quiet/dream. | 待实机 | `loop_status`, `heartbeat_digest`, diagnostic redaction output. | Force degradation only in disposable workspace. |
| J7 | Runtime safety | Snapshot and restore safety: capture snapshot in disposable workspace, mutate safe state, restore bounded safe entities only. | 待实机 | `snapshot:capture`, `restore`, state before/after summaries. | Requires explicit authorization because it changes local state. |

### Step breakdown
| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J0 | Read screen/log first: OpenClaw should show plugin loaded and `second_nature_ops` available; then run `self_health` with `workspaceRoot`. | Runtime ops / REQ-008 | 待实机 | Host log plus `self_health` JSON. | If tool missing, stop and inspect plugin install/version. |
| J0 | Read response: setup status should be explicit; then run `setup_hint` and inspect returned guide text without applying hidden actions. | Runtime ops | 待实机 | `setup_hint` JSON. | Optional but useful for first install. |
| J0 | Read workspace binding fields; then run `heartbeat_check` with `probeOnly: true`. | REQ-008 | 待实机 | Carrier/probe JSON. | Confirms workspace route without claiming full loop. |
| J1 | Read current `loop_status`; then run `heartbeat_check` with current timestamp in an empty workspace. | REQ-008, REQ-009 | 待实机 | Before/after `loop_status`, heartbeat JSON. | Expect explicit no-action or evidence-empty reason, not silent success. |
| J1 | Read heartbeat JSON structure; verify `surfaceMode`, `reasons`, `v8Spine`, `closureRef` or `noActionReason`; then save evidence. | REQ-009 | 待实机 | Raw JSON artifact. | No verdict without actual JSON. |
| J1 | Read state DB or ops readout; verify closure count increased or no-action closure exists. | REQ-009 | 待实机 | DB query output or `loop_status` closure refs. | Prefer ops surface over manual DB if available. |
| J2 | Read rhythm fields after heartbeat; verify Quiet status is `completed`, `skipped`, or `blocked` with reason. | REQ-006 | 待实机 | `v8Spine.rhythmState` JSON. | No blank rhythm state. |
| J2 | Seed or wait for source-backed closures; then run heartbeat again and inspect Quiet Daily Review content. | REQ-005 | 待实机 | Quiet review row/artifact. | Data must be source-backed. |
| J2 | Read Dream lifecycle; verify scheduled/started/completed/blocked reason is durable. | REQ-006 | 待实机 | Dream run row and reason. | Do not infer from absence. |
| J2 | If candidate projection exists, perform accepted-projection step in disposable data; then verify next heartbeat loads it into context. | REQ-005 | 待实机 | Projection row and heartbeat context output. | Manual acceptance step may be needed. |
| J3 | Read `tool_affordance`; verify connector capabilities show read/write/local side-effect posture and breaker state. | REQ-004 | 待实机 | `tool_affordance` JSON. | Unsafe/unavailable posture should block or defer. |
| J3 | Trigger a guidance-producing scenario or call `guidance_payload`; verify expression boundary and source refs are present. | REQ-003 | 待实机 | `guidance_payload` JSON. | Guidance owns wording, not delivery permission. |
| J3 | Attempt policy-denied write-side proposal in disposable/mock path; verify downgrade/deny closure and no external write proof. | REQ-004 | 待实机 | Closure JSON, connector attempt absence/policy denial. | Requires owner authorization even in mock. |
| J4 | Read connector status; verify target connector exists or failure explains missing config. | REQ-001 | 待实机 | `connector_status` JSON. | Missing credential should be honest, not auth spoof. |
| J4 | Run read-only `connector:run` with fixture/mock or authorized credential; inspect success/empty/failure shape. | REQ-001 | 待实机 | `connector:run` JSON. | Avoid publish/reply capabilities. |
| J4 | Run heartbeat after connector read; verify `EvidenceItem` has platform id, source refs, content hash/content envelope, observedAt, sensitivity class. | REQ-001, REQ-007 | 待实机 | Evidence rows/artifacts. | Empty connector output must not create fake evidence. |
| J4 | Read perception output; verify public technical text with words like token/secret is classified as public technical unless credential-shaped value exists. | REQ-002, REQ-007 | 待实机 | Perception card and sensitivity result. | Use synthetic public text, not real secrets. |
| J5 | Run `runtime_secret_bootstrap`; read output for management location/health only. | NG4 / REQ-007 | 待实机 | JSON with no raw key. | Fail if raw key material appears. |
| J5 | Run `self_health`; verify missing/wrong key states are explicit and redacted. | REQ-008 / NG4 | 待实机 | `self_health` JSON. | Do not log key. |
| J5 | Submit public technical fixture and credential-shaped fixture through safe test path; verify public text passes and Bearer/private key shape blocks raw exposure. | REQ-007 | 待实机 | Sensitivity/perception JSON. | Use fake tokens only. |
| J6 | After J1/J4, run `loop_status`; read stage attribution and next action. | REQ-008 | 待实机 | `loop_status` JSON. | Must not report healthy when DB unreadable. |
| J6 | Force a safe degraded state in disposable workspace, such as missing connector credential; then run `loop_status`. | REQ-008 | 待实机 | Degraded reason JSON. | No production credentials. |
| J6 | Run `heartbeat_digest`; verify digest includes connector/quiet/dream/closure or honest empty-state coverage. | REQ-008, REQ-009 | 待实机 | Digest JSON. | Digest must not leak raw private payloads. |
| J7 | Read current safe state summary; then run `snapshot:capture` in disposable workspace. | Runtime safety | 待实机 | Snapshot id and before summary. | Requires explicit owner authorization. |
| J7 | Mutate only safe test state, run `restore`, then compare safe entities restored and sensitive entities excluded. | Runtime safety / NG4 | 待实机 | Before/after state summary. | Do not use real personal data. |

### Findings
- [MEDIUM] Guide-only E2E still needs real OpenClaw host verification after npm publish.
  - PRD ref: REQ-008 / runtime ops.
  - Expected / Actual / Repro / Evidence / Suggested fix: Expected host lists `second_nature_ops`; Actual pending; Repro install `0.2.12` and open tool list; Evidence host screenshot/log; Suggested fix if missing is inspect plugin registration/manifest path.
- [LOW] Real connector growth cannot be proven without authorized credentials.
  - PRD ref: REQ-001.
  - Expected / Actual / Repro / Evidence / Suggested fix: Expected read connector creates EvidenceItem; Actual pending; Repro run read-only connector with authorized credential or mock; Evidence connector JSON and state rows; Suggested fix is use fixture when credential unavailable.

### Coverage gaps
- No browser/UI page coverage is planned because Second Nature is an OpenClaw runtime plugin and CLI/ops system, not a web UI.
- Real external write actions are not planned by default because REQ-004 requires owner authorization and policy proof.
- Real credential-backed connector E2E is optional because NG4 forbids exposing raw secrets and local fixtures cover no-fabrication/read paths.
- Long-term memory acceptance may need a seeded candidate or manual acceptance operation because E2E guide must not fabricate accepted memory.

### Recommendation
- Do not treat this guide as executed evidence; run it after npm publish against a disposable workspace first.
- Release candidate is suitable for host E2E if `pnpm test`, `build:plugin`, and `npm pack --dry-run` remain green on the final commit.
