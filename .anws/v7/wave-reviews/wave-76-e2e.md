# Wave 76 E2E Verification — T-V7C.C.5 Host Ops Surface Parity

**波次**: Wave 76
**任务**: T-V7C.C.5
**模式**: guide-only（实机 Claw 复测，浏览器不适用）
**日期**: 2026-05-26

---

## 1. RTM（需求追溯表）

| 验收条目 | PRD/05A Ref | 验证方式 | 状态 |
|---|---|---|---|
| guidance_payload Claw 可达 | 05A T-V7C.C.5 AC-1 | Claw `second_nature_ops` JSON 调用 | 待实机 |
| connector_test dryRun:false 成功 → ok=true | 05A T-V7C.C.5 AC-2 | Claw `connector_test` JSON 调用 | 待实机 |
| restore snapshotId 兼容 | 05A T-V7C.C.5 AC-3 | Claw `restore` JSON 调用 | 待实机 |
| manifest 描述与实际 whitelist 一致 | 05A T-V7C.C.5 AC-4 | `openclaw plugins info` / manifest 对比 | 待实机 |

---

## 2. Surface Coverage

| 入口 | 说明 | 是否覆盖 |
|---|---|---|
| OpenClaw `second_nature_ops` tool | Claw agent session 中调用 | 是 |
| CLI `sn` commands | 本地 workspace 直接调用 | 是（集成测试已覆盖） |
| Plugin manifest `openclaw.plugin.json` | 宿主加载时读取 | 是（静态审查已覆盖） |

---

## 3. Journey / Steps

### Journey A: guidance_payload 可达性验证

**前置**: Claw 已加载 Second Nature plugin 0.1.38+；`SECOND_NATURE_WORKSPACE_ROOT` 指向有效 workspace。

| Step | 读屏预期 | 动作 | 结果 | Evidence |
|:---|:---|:---|:---|:---|
| A1 | Agent session 可用；`second_nature_ops` 在工具列表中 | 向 agent 发送指令调用 `second_nature_ops` 并传入 `{ command: "guidance_payload", args: { sceneType: "social", capabilityIntent: "post.publish" } }` | 待实机 | Claw JSON response 截图/复制 |
| A2 | Response 返回 `ok: true`，data 含 `impulseText`、`atmosphereText`、`capabilityClass: "broadcast"` | 对比返回字段与预期 | 待实机 | response JSON |
| A3 | 传入 `capabilityIntent: "agent.heartbeat"` | 重复 A1，capabilityIntent 改为 `"agent.heartbeat"` | 待实机 | response JSON（预期 `impulseText: null`） |

### Journey B: connector_test wet truth 验证

**前置**: workspace 中至少有一个 connector manifest（如 moltbook）已注册。

| Step | 读屏预期 | 动作 | 结果 | Evidence |
|:---|:---|:---|:---|:---|
| B1 | `second_nature_ops` 可用 | 调用 `connector_test dryRun:false` 对已知 capability | 待实机 | response JSON |
| B2 | Response `ok: true`（当 endpoint 返回 HTTP 200） | 检查 `data.ok` 与 `data.actualStatus` | 待实机 | response JSON + capability_probe_result DB row |
| B3 | 若 endpoint 返回 429/503，预期 `ok: false` | 人为触发 rate-limit 场景或 mock 服务端 | 待实机 | response JSON（`actualStatus: "degraded"`） |

### Journey C: restore snapshotId 验证

**前置**: workspace 已有 restore snapshot（通过 `snapshot:capture` 或历史数据）。

| Step | 读屏预期 | 动作 | 结果 | Evidence |
|:---|:---|:---|:---|:---|
| C1 | `snapshot:capture` 已产生 snapshot | 调用 `restore` 仅传入 `{ snapshotId: "<已知id>" }` | 待实机 | response JSON |
| C2 | Response `ok: true`，`data.restoreTarget` 等于传入的 snapshotId | 检查 response 字段 | 待实机 | response JSON + restore_snapshot / restore_audit DB rows |
| C3 | 传入不存在的 snapshotId | 调用 `restore` 传入 `{ snapshotId: "no-such-id" }` | 待实机 | response JSON（预期 `error.code: "SNAPSHOT_NOT_FOUND"`） |

---

## 4. Coverage Gaps

- 无浏览器 UI 验证（Second Nature 无前端界面，验证全部为 CLI/Tool JSON surface）。
- 实机 connector wet probe 依赖外部平台可用性；若平台不可用，用 `connector_test dryRun:false` 仍应返回结构化 `actualStatus`，不崩溃。

---

## 5. Findings

| ID | PRD Ref | 发现 | 严重度 | 状态 |
|---|---|---|---|---|
| — | — | 初稿未发现静态问题 | — | 待实机回填 |

---

## 6. Blockers

- 需 Claw 0.1.38+ 实机环境以验证 plugin 加载与 `second_nature_ops` 工具可见性。
- 需 workspace 含已注册 connector 以验证 wet probe 真实 status。
