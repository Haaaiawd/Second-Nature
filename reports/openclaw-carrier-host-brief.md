# OpenClaw 宿主 — carrier 面操作简报（单一归档）

**日期**: 2026-05-05  
**用途**: 合并原分散的 INT-S4 宿主 JSON 归档与操作者说明；**以后宿主相关「怎么说、怎么做」只维护本文件 + `HEARTBEAT.md`**。

> **可行性现状（2026-05-05 survey + subagent 审查）**：carrier-only 路径（根 unknown）已在真实宿主验证有效（J-HOST-01 PASS）。full-bridge 路径（根 known，dynamic import + sql.js + chdir）代码级 + 进程内 parity 高确定性，真实宿主 sandbox 下尚无独占 transcript（J-HOST-02/03/04 partial / ⏳）。**独立审查判定：48/100，部分有效（需真实宿主确认）**。关键风险：根设错时桥接可自动建 `data/state.db` 而产生"假信心"；sandbox 是否允许 wasm + chdir 未知；env 优先级高于工具参数，残留旧 env 会导致误判。本次本地回归（9/9 pass）已验证代码侧没有回归。

**契约真源**

- 心跳语义、成功/下一步边界：**`HEARTBEAT.md`**
- 插件根目录几何（为何需要 `SECOND_NATURE_WORKSPACE_ROOT`）：**`HEARTBEAT.md` 与 `.anws/v5/05_TASKS.md` T1.1.4 运维约定**
- E2E / PRD 矩阵（US 对照）：**`docs/validation/e2e-v5-prd-full-lived-experience.md`**（RTM）；执行细节回填 **`reports/int-s4-release-readiness.md`**
- T1.1.4 旅程表（J-HOST / J-REPO）：**`docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`**

---

## 1. Claw（助手）在 carrier + 根 unknown 时的推荐行为

与 **`HEARTBEAT.md`** 对齐后的可操作版（口头 `HEARTBEAT_OK` **不能**代替下面 JSON 字段）：

1. **Success semantics**  
   - 在 **shipping host-safe 插件** 且 **`workspaceRootResolution` 为 `unknown`** 时，`heartbeat_check` 典型为 **`status: "runtime_carrier_only"`**，表示 **本表面本轮已确认、不冒充全量 lived-experience 决策环**。  
   - 若 JSON 中出现显式 **`status: "heartbeat_ok"`**（读模型已接线时），按该表面的契约处理。

2. **Next-step semantics**  
   - 以 JSON 为准：carrier 常见为 **`nextAction: "continue_carrier_surface_only"`**（不是泛指的 `"continue"` 字符串）。  
   - 含义：**继续常规 heartbeat 轮询**；**不要**在本表面凭 carrier ack 推断 Quiet / reflection / obligation 等 **已基于 workspace 读模型执行**。

3. **助手实际动作（甲方自述、已采纳）**  
   - 可用 **单行确认** 回应「本轮 carrier 已 ack」（与团队沟通习惯一致）。  
   - **不要**在根仍为 `unknown` 时，于同一表面强行串联 `status` / `quiet` / `explain` 并当作「已评估」——这些命令在 carrier 上会 **诚实拒绝**（见附录 JSON）。

4. **背后原因（与实现对齐）**  
   - `host_safe_carrier`：**同步注册/加载**语义；**未声明根**时 **不加载**持久 workspace 读模型。  
   - 因此 **节律决策、Quiet、explain** 等依赖读面的流程 **在当前表面不可用**；只能保持 **最小心跳响应**，直到网关设置 **`SECOND_NATURE_WORKSPACE_ROOT`** 或工具 **顶层**传入 **`workspaceRoot`** 且读桥成功（见 `HEARTBEAT.md`）。

---

## 2. 硬证据解读备忘（避免误报）

- **`workspaceRootResolution: "unknown"`** 且响应里 **没有** `bridgeAttempted`：通常表示 **未走读桥**（根未在插件进程内解析为 `env` / `tool_args`）。  
- 若声称已传 `workspaceRoot` 仍为 `unknown`：先核对 OpenClaw 是否把路径放在 **`second_nature_ops` 与 `command`、`args` 同级的顶层字段**（勿只塞进 `args`）。  
- **`ok: false` + `WORKSPACE_READ_SURFACE_UNAVAILABLE`** 在 **unknown** 路径上是 **预期占位**，不等于「MEMORY.md 缺失」一类内容问题。

---

## 3. 附录 — 归档用原始 JSON（单行）

> 来源：此前 `int-s4-t1-1-4-host-json-evidence-2026-05-04.md` 精简迁入。插件版本随时间变化时，以你本机 **`pnpm build:plugin`** 产物 + 宿主 **View Raw** 为准。

### A — 未设根（carrier baseline）

**`command=status` `args={}`**

```json
{"ok":false,"surfaceMode":"host_safe_carrier","workspaceReadModelsEvaluated":false,"message":"Host-safe plugin package keeps synchronous register/load semantics, but mutating workspace runtime flows remain unavailable here.","error":{"code":"WORKSPACE_READ_SURFACE_UNAVAILABLE","message":"Aggregated status requires workspace state; the host-safe plugin does not load persisted read models on this surface.","requiredUserInput":["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"],"nextStep":"run_workspace_second_nature_cli_or_full_runtime_package"},"data":{"workspaceRootResolution":"unknown","carrier":{"host":"openclaw-plugin","serviceStatus":"running","updatedAt":"2026-05-04T03:39:38.890Z"}}}
```

**`command=explain` `args={"subject":"probe:int-s4-j-host-01"}`**

```json
{"ok":false,"surfaceMode":"host_safe_carrier","workspaceReadModelsEvaluated":false,"message":"Host-safe plugin package keeps synchronous register/load semantics, but mutating workspace runtime flows remain unavailable here.","error":{"code":"EXPLAIN_READ_SURFACE_UNAVAILABLE","message":"Evidence-backed explain requires persisted workspace read models; host-safe carrier did not evaluate operator explain (CH-11-02).","requiredUserInput":["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"],"nextStep":"run_workspace_second_nature_cli_or_full_runtime_package"},"data":{"subjectType":"probe","evaluated":false,"workspaceRootResolution":"unknown"}}
```

**`command=quiet` `args={}`**

```json
{"ok":false,"surfaceMode":"host_safe_carrier","workspaceReadModelsEvaluated":false,"message":"Host-safe plugin package keeps synchronous register/load semantics, but mutating workspace runtime flows remain unavailable here.","error":{"code":"QUIET_READ_SURFACE_UNAVAILABLE","message":"Quiet read surface requires workspace runtime; not evaluated in host-safe carrier mode.","requiredUserInput":["SECOND_NATURE_WORKSPACE_ROOT or tool workspaceRoot"],"nextStep":"run_workspace_second_nature_cli_or_full_runtime_package"},"data":{"evaluated":false,"unavailableReason":"host_safe_carrier_no_workspace_db","workspaceRootResolution":"unknown"}}
```

**`command=heartbeat_check` `args={"timestamp":"2026-05-04T12:00:00.000Z"}`**

```json
{"ok":true,"status":"runtime_carrier_only","livedExperienceLoopClaimed":false,"scope":"rhythm","trigger":"heartbeat_bridge","reasons":["runtime_carrier_only","host_safe_bridge_ack"],"nextAction":"continue_carrier_surface_only","message":"Packaged carrier acknowledged this heartbeat round. This is not a full lived-experience decision loop; use the workspace CLI when read models are required.","data":{"workspaceRootResolution":"unknown","runtime":{"host":"openclaw-plugin","serviceStatus":"running","updatedAt":"2026-05-04T03:39:38.890Z"},"surface":{"tool":"second_nature_ops","command":"second-nature heartbeat_check"},"bridge":{"timestamp":"2026-05-04T12:00:00.000Z","sessionContextProvided":false,"heartbeatChecklistProvided":false,"serviceEntryMode":"runtime_carrier_only"}}}
```

### B — 同提交插件进程内「已设根」对照（非宿主独占）

**`quiet` — `SECOND_NATURE_WORKSPACE_ROOT=<tmp>`**

```json
{"ok":true,"data":{"mode":"unknown","sourceCount":0,"reportCount":0,"recentJournalCount":0}}
```

**`heartbeat_check` — env 设根 或 仅顶层 `workspaceRoot=<tmp>`（本采样中两段逐字一致）**

```json
{"ok":true,"status":"denied","surfaceMode":"workspace_full_runtime","reasons":["intent-exploration:deny(missing_source_refs)","intent-social:deny(missing_source_refs)","intent-outreach:deny(missing_source_refs)"],"livedExperienceLoopClaimed":false}
```

### C — J-REPO-01（仓库）

```bash
pnpm build && pnpm build:plugin && node --test dist/tests/integration/cli/plugin-workspace-ops-bridge.test.js
```

（示例一次跑通：`# tests 6` / `# pass 6` / `# fail 0`。）

### Findings（保留）

- **宿主 UI 长 JSON 截断**：以 **View Raw / transcript 导出** 或 **本附录** 为完整文本源。  
- **会话文案滞后**：如口头 `HEARTBEAT_OK`；**验收以工具 JSON** 为准（见 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md` 与 `.anws/v5/05_TASKS.md` INT-S4 验证说明）。

---

## 4. 已废弃路径（勿再新增内容）

以下报告已 **删除**，内容并入上文：

- ~~`reports/int-s4-t1-1-4-host-json-evidence-2026-05-04.md`~~
- ~~`reports/e2e-browser-openclaw-int-s4-2026-05-04.md`~~（未连上网关的浏览器跑次，无保留价值）
