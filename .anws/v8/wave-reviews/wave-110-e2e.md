<!--
评测列语义（旅程结果 / Step 结果）：仅允许 PASS | PARTIAL_PASS | FAIL。
未在用户授权并完成宿主实机回填前：留空或写「待实机」——严禁写任一 verdict，严禁自拟其它档位或同义粉饰。
-->

# Wave 110 E2E Verification - v0.2.10 Feishu/OpenClaw Host Closure

## Scope

- **Change source**: v0.2.9 Feishu/OpenClaw report: plugin loaded, bridge commands worked, but `second_nature_ops` was absent from the conversation tool list under `capabilities=none`.
- **Target**: Cloud Feishu/OpenClaw host loading `@haaaiawd/second-nature@0.2.10`.
- **Workspace**: Disposable cloud workspace with state isolated from production.
- **Out of scope**: Real external writes, npm publish decision, browser/mobile UI.
- **Blocking rule**: Any raw credential-like value in tool output or visible artifacts is FAIL.

## Hotfix Delta

- `activation.onCapabilities:["tool"]` removed; startup loading remains `activation.onStartup:true`; tool declaration remains `contracts.tools:["second_nature_ops"]`.
- Heartbeat writes `sceneType="heartbeat"` impulse context automatically; no manual `guidance_payload` pre-step should be required for the real-run health gate.
- MoltBook `feed.read` stays on `api_rest` or mock fallback; read path must not report `moltbook_skill_runner_not_configured`.
- Built-in connector workspace overrides require explicit safe shadowing.

## Journeys

| ID | User Journey | 旅程结果 | Evidence | Notes |
| --- | --- | --- | --- | --- |
| J0 | Install or upgrade to v0.2.10 and confirm plugin metadata | 待实机 | plugin inspect/list output | Must report version `0.2.10` |
| J1 | Open Feishu/OpenClaw session with default `capabilities=none` and confirm `second_nature_ops` appears in tool list | 待实机 | host tool list JSON/screenshot | P0 gate; if missing, host injection remains unresolved |
| J2 | Run `heartbeat_run` or `heartbeat_check` through `second_nature_ops` | 待实机 | tool JSON | Must include v8 cycle/closure or no-action reason |
| J3 | Run `loop_status` and verify real-run health no longer stalls on missing heartbeat impulse | 待实机 | `loop_status` JSON | `hasFreshImpulseContext` should be true after heartbeat |
| J4 | Run `connector:run` for read-only `moltbook/feed.read` or fixture | 待实机 | connector JSON, evidence rows/artifacts | Must not fail with `moltbook_skill_runner_not_configured` |
| J5 | Run `connector_status` with workspace manifests present | 待实机 | connector_status JSON | Duplicate built-in/workspace IDs should either safe-shadow or fail closed with actionable conflict |
| J6 | Search all returned JSON for credential-like substrings | 待实机 | redaction search notes | Any raw token/private key/API key is blocking |

## Step Checklist

| Journey | Step | Step 结果 | Evidence | Expected |
| --- | --- | --- | --- | --- |
| J0 | Install `v0.2.10` from tag, tarball, or npm candidate | 待实机 | install log | Plugin enabled |
| J0 | Inspect plugin manifest/package metadata | 待实机 | plugin metadata | `version=0.2.10`, `contracts.tools` includes `second_nature_ops` |
| J1 | Start a fresh Feishu/OpenClaw conversation | 待实机 | session metadata | Session may show `capabilities=none` |
| J1 | Inspect available tools | 待实机 | tool list | `second_nature_ops` visible |
| J2 | Invoke `second_nature_ops` with `command=heartbeat_run` | 待实机 | heartbeat JSON | `ok=true`, v8 spine cycle present or explicit degraded reason |
| J2 | If `heartbeat_run` is unavailable, invoke `heartbeat_check` | 待实机 | heartbeat JSON | Alias/path must still drive v8 spine when state DB is wired |
| J3 | Invoke `loop_status` | 待实机 | loop_status JSON | `realRunHealth.hasFreshImpulseContext=true` after heartbeat |
| J3 | Confirm stalled stage, if any, is not `impulse` / `artifact_not_persisted` | 待实机 | loop_status JSON | Missing projection may still be valid if no memory candidate exists |
| J4 | Invoke `connector:run` with `{ platformId:"moltbook", capabilityId:"feed.read" }` | 待实机 | connector JSON | Success/mock or honest API/config/network failure |
| J4 | Inspect failure class if failed | 待实机 | connector JSON | Not `protocol_mismatch:moltbook_skill_runner_not_configured` |
| J5 | Invoke `connector_status` | 待实机 | connector_status JSON | Safe shadow or actionable conflict; no silent duplicate pollution |
| J6 | Search visible outputs for `Bearer`, `private_key`, `encrypted_value`, `apiKey`, `authorization` | 待实机 | search result | No raw secret leakage |

## Logical Tool Payloads

```json
{ "command": "heartbeat_run", "workspaceRoot": "<cloud-test-workspace>" }
```

```json
{ "command": "loop_status", "workspaceRoot": "<cloud-test-workspace>" }
```

```json
{ "command": "connector:run", "workspaceRoot": "<cloud-test-workspace>", "args": { "platformId": "moltbook", "capabilityId": "feed.read" } }
```

```json
{ "command": "connector_status", "workspaceRoot": "<cloud-test-workspace>", "includeHealth": true }
```

## Findings

- 待实机后回填。

## Recommendation

- Minimum publish gate: J0, J1, J2, J3, and J6 must complete with no HIGH finding.
- Full host closure gate: complete J0-J6 and attach tool-list evidence showing `second_nature_ops` visible in Feishu/OpenClaw.
- Do not publish if `second_nature_ops` is still absent from the host tool list.
