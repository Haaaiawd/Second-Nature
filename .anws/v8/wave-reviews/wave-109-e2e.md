<!--
评测列语义（旅程结果 / Step 结果）：仅允许 PASS | PARTIAL_PASS | FAIL。
未在用户授权并完成宿主实机回填前：留空或写「待实机」——严禁写任一 verdict，严禁自拟其它档位或同义粉饰。
-->

# Wave 109 E2E Verification - v0.2.9 Content-Bearing Living Loop for Claw

> Hotfix delta from v0.2.8 cloud E2E:
> 1. `connector:run` now double-writes v8 `EvidenceItem`, not only v7 `LifeEvidence`.
> 2. Real connector runner envelopes (`capability`/`channel`/`data.items`) are recursively unpacked into evidence items.
> 3. `heartbeat_run` is exposed through the OpenClaw plugin bridge as an alias to `heartbeat_check`.
> 4. The workspace bridge flushes sql.js state after every command so multi-process hosts see persisted rows.
> 5. Dream immediately accepts valid memory projections so they become `active`/`accepted` long-term memory.

## E2E Verification

### Scope
- **PRD / 需求来源**: `.anws/v8/01_PRD.md` §3.1 G1, G2, G5, G7, G8; §4 US-001, US-002, US-005, US-006, US-007, US-008, US-009; `.anws/v8/05A_TASKS.md` Wave 109 (T-CS.R.4, T-CS.R.5, T-PJ.R.2, T-DQ.R.6, T-DQ.R.7, T-OBS.R.5, INT-R4)
- **Target**: Cloud OpenClaw / Claw host loading Second Nature plugin `@haaaiawd/second-nature@0.2.9`
- **Environment**: Dedicated cloud OpenClaw test workspace with `second_nature_ops` visible and workspace state isolated from production use
- **Browser / Viewport（计划）**: N/A; Second Nature v8 is a runtime/plugin surface, not a browser UI. Evidence is collected from OpenClaw tool JSON, workspace artifacts, and optional state DB readback.
- **User Role**: owner/operator; Claw executes the guide and records Evidence, human reviews before npm publish
- **Build / Commit**: `0.2.9` hotfix candidate after cloud `v0.2.8` E2E findings; fixes real-API evidence extraction, `heartbeat_run` surface, workspace bridge flush, and Dream memory activation.
- **Side effects**: `setup_ack`, `heartbeat_check` / `heartbeat_run`, connector execution, Quiet/Dream rhythm advancement, and state inspection write or read workspace state. Use a disposable workspace. Do not perform real external write actions.

### PRD traceability (RTM)
| PRD ref | Summary | Priority | Journeys |
| --- | --- | --- | --- |
| REQ-001 / US-001 | Connector output becomes source-backed, content-bearing `EvidenceItem` | P0 | J2 |
| REQ-002 / US-002 | `PerceptionCard` is readable and derived from evidence payload | P0 | J3 |
| REQ-005 / US-005 | Long-term memory input comes through Quiet/Dream, not direct realtime write | P0 | J4 |
| REQ-006 / US-006 | Quiet/Dream lifecycle records durable completed/blocked/failed reasons | P1 | J4 |
| REQ-007 / US-007 | Public technical text is not blocked by keyword-only sensitivity scan | P1 | J2, J5 |
| REQ-008 / US-008 | `loop_status` explains stage health and does not leak credentials | P1 | J5 |
| REQ-009 / US-009 | Every heartbeat produces closure or explicit no-action reason | P0 | J3, J4 |
| T-CS.R.4 | Generic `NormalizedEvidenceContent` envelope | P0 | J2 |
| T-CS.R.5 | Real heartbeat double-writes content-bearing v8 `EvidenceItem` with dedupe | P0 | J2 |
| T-PJ.R.2 | Perception consumes `payloadJson` and advances evidence lifecycle | P0 | J3 |
| T-DQ.R.6 | Quiet review is non-template and source-backed | P0 | J4 |
| T-DQ.R.7 | Dream executes after scheduling and does not remain stuck `scheduled` | P0 | J4 |
| T-OBS.R.5 | UUID/sourceRef identifiers do not false-trigger secret validation | P0 | J5 |
| INT-R4 | Content-bearing full-loop gate | P0 | J2, J3, J4, J5 |

### Surface coverage
| 功能面 / 入口 | 如何发现 | Journey | PRD ref | Notes |
| --- | --- | --- | --- | --- |
| Cloud OpenClaw plugin install | OpenClaw plugin manager / marketplace / GitHub tag install | J0 | Runtime ops | Install from `0.2.9`; npm publish is not required for this guide if tag/tarball install works |
| `second_nature_ops` tool list entry | Claw session tool list | J1 | Runtime ops | If missing, plugin did not load |
| `setup_hint` | `second_nature_ops` command | J1 | Onboarding | Confirms packaged guidance is available |
| `setup_ack` | `second_nature_ops` command | J1 | Onboarding | Writes workspace ack marker |
| `connector_status` | `second_nature_ops` command | J2 | REQ-001 | Must not return `unknown_command` |
| `connector:run` or heartbeat-selected read connector | `second_nature_ops` command or heartbeat run | J2 | REQ-001 | Use fixture/mock/read-only connector path |
| `heartbeat_check` / `heartbeat_run` | `second_nature_ops` command | J3, J4 | REQ-009 | Core living loop trigger |
| `loop_status` | `second_nature_ops` command | J5 | REQ-008 | Main host-visible health and redaction proof |
| `quiet` / `dream:recent` / `cycle:recent` | `second_nature_ops` commands if available | J4, J5 | REQ-005, REQ-006 | Use `loop_status` fallback if dedicated command is unavailable |
| v8 state readback | `heartbeat_run.v8Spine`, `loop_status`, or host workspace state inspector | J2, J3, J4 | INT-R4 | v0.2.7 does not expose separate `perception_card`, `judgment_verdict`, or `action_closure` tool commands |
| `narrative:diff` | `second_nature_ops` command | J1 | Runtime ops | Confirms v0.2.7 command registration parity |
| Workspace artifacts / state DB | Cloud workspace file/state inspector | J2, J3, J4, J5 | INT-R4 | Optional but preferred evidence for row-level assertions |

### Journeys（旅程级）
| ID | PRD ref | User Journey | 旅程结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J0 | Release ops | Install Second Nature `0.2.9` in cloud OpenClaw and verify plugin registration | 待实机 | Install log; plugin inspect/list output; tool list | Use tag `0.2.9` after release, or uploaded tarball |
| J1 | Runtime ops / Onboarding | Claw opens a fresh workspace, sees `second_nature_ops`, runs setup and basic command registration checks | 待实机 | Tool list; `setup_hint`; `setup_ack`; `connector_status`; `narrative:diff` output | Confirms host surface parity before loop tests |
| J2 | REQ-001, REQ-007, T-CS.R.4, T-CS.R.5 | Produce content-bearing read evidence and verify v8 `EvidenceItem` rows exist, are deduped, and do not fabricate on empty/failure | 待实机 | `connector:run` or `heartbeat_run` JSON; `evidence_item` readback; v7 artifact presence | Use read-only fixture/mock connector |
| J3 | REQ-002, REQ-009, T-PJ.R.2 | Run heartbeat and verify readable `PerceptionCard`, evidence lifecycle advancement, judgment/closure or no-action reason | 待实机 | `heartbeat_run` JSON; `perception_card`; `judgment_verdict`; `action_closure_record`; `loop_status` | Must not be ref-only shell |
| J4 | REQ-005, REQ-006, T-DQ.R.6, T-DQ.R.7 | Advance daily rhythm and verify Quiet review is non-template and Dream reaches completed/blocked/failed | 待实机 | `quiet_daily_review`; `dream_consolidation_run`; `daily_rhythm_state`; `dream:recent` or `loop_status` | Dream must not remain stuck at `scheduled` |
| J5 | REQ-007, REQ-008, T-OBS.R.5 | Verify redaction and diagnostics: UUID/sourceRef identifiers pass, credential-like values are blocked/redacted, health is actionable | 待实机 | `loop_status` JSON; write-validation output if exposed; string search result | Any credential leak is blocking |
| J6 | Release decision | Decide whether `v0.2.7` is publishable after cloud host evidence is reviewed | 待实机 | Completed Evidence table; findings; npm publish decision | NPM publish remains manual |

### Step breakdown
| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J0 | 1. In cloud OpenClaw, install the plugin from GitHub tag `v0.2.9` or the packaged tarball if upload is supported | Release ops | 待实机 | Install log | Preferred source is tag `v0.2.9` after release; fallback tarball is `haaaiawd-second-nature-0.2.9.tgz` |
| J0 | 2. Inspect installed plugin metadata and confirm version `0.2.9` | Release ops | 待实机 | Plugin inspect/list output | If version is older, stop and reinstall |
| J0 | 3. Open a new Claw session in a disposable workspace | Runtime ops | 待实机 | Session/tool list screenshot or JSON | Do not use production workspace |
| J1 | 1. Read the tool list and confirm `second_nature_ops` is visible | Runtime ops | 待实机 | Tool list JSON/screenshot | If absent, plugin registration failed |
| J1 | 2. Call `setup_hint`; output should mention packaged setup guidance / inner guide | Runtime ops | 待实机 | `setup_hint` JSON | Confirms packaged docs are reachable |
| J1 | 3. Call `setup_ack`; workspace should record acknowledgement without exposing secrets | Runtime ops | 待实机 | `setup_ack` JSON; ack artifact if accessible | Mutates only test workspace |
| J1 | 4. Call `connector_status`; command must be registered and return connector inventory or honest empty state | REQ-001 | 待实机 | `connector_status` JSON | Regression for v0.2.7 command registration |
| J1 | 5. Call `narrative:diff` without `from`/`to`; it should return either a diff for recent versions or actionable `requires two versions` guidance | Runtime ops | 待实机 | `narrative:diff` JSON | Validates command surface parity |
| J2 | 1. Prepare a read-only connector fixture or existing mock connector that returns at least one item with title/content/author/url and a stable external id | T-CS.R.4 | 待实机 | Fixture/manifest snippet | Do not call external write endpoint |
| J2 | 2. Run the connector through `connector:run` or trigger `heartbeat_run` until the read connector executes | REQ-001 | 待实机 | Tool JSON; connector attempt log | Use read-only capability such as `feed.read` |
| J2 | 3. Inspect output or state and confirm at least one v8 `EvidenceItem` exists with `payloadJson.title` or `payloadJson.summary`, `sourceRefs`, `platformId`, and content hash | T-CS.R.5 | 待实机 | DB/state readback; JSON excerpt | This is the main Wave 109 evidence fix |
| J2 | 4. Confirm the legacy v7 `LifeEvidence` artifact still exists for the same observation | T-CS.R.5 | 待实机 | Artifact/state readback | Double-write compatibility must hold |
| J2 | 5. Repeat the same connector observation once; confirm duplicate rows do not grow unbounded and repeated item updates seen/observed metadata instead | T-CS.R.5 | 待实机 | Before/after evidence count | Dedupe by external id or content hash |
| J2 | 6. Run or simulate an empty connector result; confirm `evidence_empty` or equivalent no-data reason and no fabricated perception | REQ-001 | 待实机 | Tool JSON; `loop_status` | Empty input must be honest |
| J3 | 1. With J2 evidence present, call `heartbeat_run` or `heartbeat_check` | REQ-009 | 待实机 | Heartbeat JSON | Must include `cycleId` / `cycleSequence` when available |
| J3 | 2. Confirm heartbeat output includes `closureRef` or explicit `noActionReason`; neither may be missing | REQ-009 | 待实机 | Heartbeat JSON | Prevents silent no-op |
| J3 | 3. Inspect `PerceptionCard` readback and confirm summary/topic include real content such as the fixture title or summary, not just ids/ref strings | T-PJ.R.2 | 待实机 | `perception_card` row or tool projection | Ref-only shell is a failure |
| J3 | 4. Confirm the source `EvidenceItem.lifecycleStatus` advanced to `perceived` after card creation | T-PJ.R.2 | 待实机 | Evidence row readback | Prevents repeated pending processing |
| J3 | 5. Confirm a `JudgmentVerdict` exists or the system explains why judgment was skipped/degraded | REQ-003 | 待实机 | `judgment_verdict` row; `loop_status` | Rules-only/degraded is acceptable if explicit |
| J3 | 6. Confirm an `ActionClosureRecord` exists and contains input, decision/output or no-action reason, post-processing, and next-state material | REQ-009 | 待实机 | `action_closure_record` row | Closure is the source for Quiet |
| J4 | 1. Prepare same-day or previous-day content-bearing evidence/perception/closure data from J2/J3 | REQ-005 | 待实机 | State row counts | May reuse J2/J3 workspace |
| J4 | 2. Trigger daily rhythm advancement via heartbeat, or wait for host cadence if configured | T-DQ.R.6 | 待实机 | Heartbeat JSON; rhythm state | Use manual trigger in disposable workspace |
| J4 | 3. Inspect `quiet_daily_review.payloadJson`; `reviewSummary`, `notableSignals`, or `memoryCandidates` should include readable content from evidence/perception/closure | T-DQ.R.6 | 待实机 | Quiet row JSON | Must not be template-only |
| J4 | 4. Search Quiet payload for banned template strings: `Quiet daily report`, `Source-backed quiet summary`, `Evidence-backed note` | T-DQ.R.6 | 待实机 | String search result | Any hit is a failure |
| J4 | 5. Inspect `dream_consolidation_run`; status must be `completed`, `blocked`, or `failed` with reason, not stuck `scheduled` after execution | T-DQ.R.7 | 待实机 | Dream row; `dream:recent` or `loop_status` | `blocked` is acceptable only with precise reason |
| J4 | 6. If a memory candidate exists, confirm sourceRefs point back to evidence/perception/closure; if no candidate exists, confirm precise blocked/empty reason | REQ-005, REQ-006 | 待实机 | Projection candidate or blocked reason | No silent memory failure |
| J5 | 1. Call `loop_status` after J2-J4 | REQ-008 | 待实机 | `loop_status` JSON | Main operator-facing health surface |
| J5 | 2. Confirm `loop_status` includes stage-level health for ingestion, perception, judgment, action closure, quiet review, and dream consolidation | REQ-008 | 待实机 | `causalHealth.stages[]` | Stage list may include extra stages |
| J5 | 3. Confirm `nextAction` is human-readable and points to the actual blocked/stalled stage if any | REQ-008 | 待实机 | `nextAction` text | No vague governance blame |
| J5 | 4. Search all returned JSON for credential-like substrings: `Bearer`, `private_key`, `encrypted_value`, `apiKey`, `authorization`, obvious token values | REQ-008, NG4 | 待实机 | Search output | Any raw credential leak is blocking |
| J5 | 5. Verify UUID/sourceRef identifiers such as `d7903d94-a6df-40e4-8cee-c2ff80c0ade1` do not cause write validation failure | T-OBS.R.5 | 待实机 | Successful write or validation output | If only state readback is available, record as indirect evidence |
| J5 | 6. Verify a credential-shaped value, if safely simulated, is blocked/redacted with field-level attribution | T-OBS.R.5 | 待实机 | Validation/diagnostic output | Use fake token only; do not paste real secrets |
| J6 | 1. Review all captured Evidence against this table; leave result fields as `待实机` until Claw has actually executed each step | Release ops | 待实机 | Completed guide copy | 不伪造结果 |
| J6 | 2. If J0-J5 are verified successfully and no HIGH finding exists, owner may run `npm publish` manually from `plugin/` | Release ops | 待实机 | Publish decision note | Publish remains owner action |

### Claw operation snippets

Use the cloud host's actual tool invocation shape. If the host exposes MCP-style calls, the logical payloads are:

```json
{
  "name": "second_nature_ops",
  "arguments": {
    "command": "setup_hint",
    "workspaceRoot": "<cloud-test-workspace>"
  }
}
```

```json
{
  "name": "second_nature_ops",
  "arguments": {
    "command": "connector_status",
    "workspaceRoot": "<cloud-test-workspace>",
    "includeHealth": true
  }
}
```

```json
{
  "name": "second_nature_ops",
  "arguments": {
    "command": "heartbeat_run",
    "workspaceRoot": "<cloud-test-workspace>"
  }
}
```

```json
{
  "name": "second_nature_ops",
  "arguments": {
    "command": "loop_status",
    "workspaceRoot": "<cloud-test-workspace>"
  }
}
```

If `heartbeat_run` is not exposed by that host, use `heartbeat_check` and record whether it triggers a full v8 spine or only returns a read-only check. A read-only check alone is not sufficient for J2-J4.

`perception_card`, `judgment_verdict`, and `action_closure` are state entity names, not v0.2.7 tool commands. Claw should verify them through `heartbeat_run.v8Spine`, `loop_status`, workspace state inspection, or exported artifacts. If the host cannot inspect state, record those row-level checks as host-limited rather than `unknown_command` failures.

### Findings
- 待实机后回填

### Coverage gaps
- No browser/mobile UI is covered because Wave 109 changes runtime state, connector normalization, Quiet/Dream memory activation, and ops diagnostics.
- Real external platform writes are out of scope; use read-only connectors, fixtures, dry-run, or owner-confirm paths only.
- Full 7-day Dream cadence is not required for this smoke; the guide validates immediate execution after due Quiet and checks that recent Dream interval gating does not leave stale `scheduled` runs.
- If cloud OpenClaw does not allow direct state DB/artifact inspection, use `loop_status`, `dream:recent`, `cycle:recent`, and tool JSON as primary Evidence, and record row-level checks as blocked by host limitations.
- Performance/load testing for 1,000 daily evidence items and 10 platforms is out of scope for this E2E.

### Recommendation
- Minimum cloud publish gate: J0 + J1 + J2 + J3 + J5 must be completed with no HIGH finding and no credential leak.
- Full Wave 109 host gate: complete J0 through J5, including Quiet non-template payload and Dream completed/blocked/failed status.
- Do not run `npm publish` until cloud Evidence is reviewed. If any raw credential-like value appears in `loop_status` or persisted visible payloads, mark FAIL and block publish.

---

## Evidence checklist for Claw回填

- [ ] Installed plugin reports version `0.2.9`
- [ ] `second_nature_ops` visible in cloud Claw tool list
- [ ] `setup_hint` returns packaged setup guidance
- [ ] `setup_ack` succeeds in disposable workspace
- [ ] `connector_status` does not return `unknown_command`
- [ ] `narrative:diff` is registered and returns diff or actionable two-version requirement
- [ ] Read connector or heartbeat creates v8 `EvidenceItem` with content-bearing `payloadJson`
- [ ] v7 `LifeEvidence` artifact compatibility is preserved
- [ ] Duplicate observation does not create duplicate explosion
- [ ] Empty connector result records honest empty reason and does not fabricate perception
- [ ] `PerceptionCard` summary/topic is derived from evidence content
- [ ] `EvidenceItem.lifecycleStatus` advances to `perceived`
- [ ] Heartbeat writes `ActionClosureRecord` or explicit `noActionReason`
- [ ] Quiet review payload contains non-template readable summary/signals/candidates
- [ ] Quiet payload contains no banned template strings
- [ ] Dream run reaches `completed`, `blocked`, or `failed`, not stuck `scheduled`
- [ ] UUID/sourceRef identifiers do not trigger sensitivity false positive
- [ ] Credential-shaped fake value is blocked/redacted with field attribution
- [ ] `loop_status` gives stage-level health and actionable `nextAction`
- [ ] `loop_status` / visible JSON contains no raw credential-like values
- [ ] Owner records publish decision after evidence review
