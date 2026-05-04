# INT-S4 — 人类操作者观感测试指南（Lived-experience honesty）

> **理念**：不只问「接口有没有返回」，而问 **一个真人在 OpenClaw 里用 Second Nature 时，心里是踏实还是被骗**。  
> **适用**：宿主上已安装 `second-nature` 插件；通过 **对话里让模型调 `second_nature_ops`**，或等价 CLI/工具入口。  
> **契约锚点**：`.anws/v5` PRD / `cli-system`；**实现语义锚点**：仓库 `3792d06` 及之后（CH-09/10 回流：**carrier 诚实**、**无假读模型**、**heartbeat_check 不再冒充 `HEARTBEAT_OK`**）。

---

## 0. 版本门槛（上传 / 换包前先对一下）


| 检查                                 | 人类可理解的说法                                                                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 你手里的插件是否 **≥ 本仓库 `3792d06` 那套语义**？ | 若 `heartbeat_check` 仍出现顶层 `**heartbeat` / `HEARTBEAT_OK`**，或 `status` 在 无 workspace 读模型 时仍 `**ok: true` 且一堆空数组** → 那是 **旧包**，本指南下文期望 **全部不成立**。请先 `pnpm build:plugin` 再装宿主。 |
| `git rev-parse HEAD`               | 记录在 E2E Plan 里，方便和报告对照。                                                                                                                                                     |


**你刚贴的那段「助手解释」**（`quiet.mode: "unknown"` + `heartbeat_check` `nextAction: "continue"` + `host_safe_bridge_ready`）对应的是 **回流前的旧语义**。当前实现里：`**quiet` 不再用 `mode: "unknown"` 冒充已读**；`**heartbeat_check` 顶层为 `runtime_carrier_only`**，且 `**nextAction: "continue_carrier_surface_only"`**。不要用旧截图验收新包。

---

## 1. E2E Plan（执行前写一行就够）


| 字段                  | 填写                                                           |
| ------------------- | ------------------------------------------------------------ |
| Target              | OpenClaw 网关 / 隧道 URL / 会话 ID                                 |
| Human               | 谁在看（你自己 / 运维）                                                |
| Plugin commit / 包来源 | `git rev-parse HEAD` 或构建产物路径                                 |
| Workspace root 意识   | 是否设置 `SECOND_NATURE_WORKSPACE_ROOT` 或在工具参数里传 `workspaceRoot`；**推荐** 与 OpenClaw **agent workspace** 同一路径（默认 `~/.openclaw/workspace` 或 `openclaw.json` → `agents.defaults.workspace`）；sandbox / 多 agent 时以**实际落库路径**为准（见 `explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md`） |
| 情绪基线                | 你期望的是「诚实拒绝」还是「看起来像仪表盘全绿」——后者在 **carrier-only** 下应 **失败**     |


---

## 2. 观感维度（测「感觉」而不是测字段存在）

把下面每一行当成 **自问自答**；答案只能是：**踏实 / 困惑 / 生气（被骗感）**。任何 **困惑或生气** 都记为 Finding，留证据（JSON 片段或截图）。

### D1 — 「全绿空盘」还有没有？

- **问**：`status` 看起来像「一切正常、只是没数据」吗？  
- **新语义期望**：应感到 **「被拦了一下，但说明白了」** — `ok: false`，有 `error.code`（如 `WORKSPACE_READ_SURFACE_UNAVAILABLE`），`surfaceMode: "host_safe_carrier"`，**真实 carrier 状态在 `data.carrier`**（`serviceStatus`、`updatedAt`、`lastRuntimeTraceId`），**没有**假 `connectors: []` / `credentials: []` 冒充已扫库。  
- **若仍全绿空盘**：旧包或未部署成功。

### D2 — 「Quiet 到底在不在工作？」

- **问**：我想知道 Quiet 有没有在「管我」——宿主上 **一眼** 能知道吗？  
- **诚实答案**：在 **host-safe carrier** 上，**Quiet 决策链不在这条面上执行**；你能验证的是 **「没有假装读过 Quiet」**。  
- **新语义期望**：单独调 `quiet` 子命令时，应感到 **明确拒绝** — `ok: false`，`data.evaluated: false`，`unavailableReason`（如 `host_safe_carrier_no_workspace_db`），`error.code: QUIET_READ_SURFACE_UNAVAILABLE`，并带 `workspaceRootResolution`。  
- **不应再出现**：`quiet.mode: "unknown"` 配 `**ok: true`** 配 **零计数** 那种「好像读了但不知道」的暧昧组合。

### D3 — 「这一轮心跳算跑完了吗？」

- **问**：`heartbeat_check` 让我安心还是让我误以为跑完了一整轮 lived experience？  
- **新语义期望**：应感到 **「 ack 了载体，但没 claim 闭环」** — 顶层 `status: "runtime_carrier_only"`，`livedExperienceLoopClaimed: false`，`nextAction: "continue_carrier_surface_only"`，`reasons` 含 `runtime_carrier_only` / `host_safe_bridge_ack`；**没有** `HEARTBEAT_OK` 字符串当成功图腾。  
- **若仍出现 `HEARTBEAT_OK` / `heartbeat_ok` 当顶层成功**：旧包。

### D4 — 「根目录对不对？」

- **问**：插件读的是我 **以为** 的那个 workspace 吗？  
- **新语义期望**：看 `workspaceRootResolution`：`env` / `tool_args` / `unknown`。`unknown` 时应伴随 **可理解的 nextStep**（提示 `SECOND_NATURE_WORKSPACE_ROOT` 或工具 `workspaceRoot`），而不是静默用错目录还给你一堆假状态。  
- **人类动作**：故意不设 env 调一次，再设 env 调一次 — **观感应从「心里没底」变成「根对齐了」**（若仍跑 carrier 读面，至少 **resolution 诚实**）。
- **路径对齐（T1.1.4 运维约定）**：根已知验收时，在 E2E Plan 或证据里写清所设路径是否 **等于** 宿主 **OpenClaw agent workspace**（`agents.defaults.workspace` 或沙箱内实际挂载根），避免「口头说是默认 `~/.openclaw/workspace`」与网关真实 cwd 漂移；详见 `explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md`。

### D5 — 「存储至少硬吗？」

- **问**：我只信「能落盘」——`storage_smoke` 调完是 **心里有底** 还是 **更慌**？  
- **期望**：`ok: true` 且报告里 driver/语义清晰（与 T4.1.4 一致）。这条在 carrier 上 **允许真跑**，因为它走打包 smoke，不是冒充 workspace 读模型。

### D6 — 「最坏也要说最坏」

- **问**：`fallback` 在没库时会不会 **装成已送达**？  
- **期望**：显式 `HOST_SAFE_`* 或 `ok: false` — **感到诚实**，而不是「undefined 成功」。

### D7 — 「explain 有没有装成读过？」

- **问**：我只看 `ok: true`，会不会以为已经查了证据链？  
- **carrier（根 unknown 或未桥接）期望**：`explain` **不得**单独用 `ok: true` + `evaluated: false` 冒充「读到了 explain 索引」；应与 `status`/`quiet` 同族诚实（`ok: false` + `error.code`，见 `07_CHALLENGE_REPORT.md` CH-11-02）— **T1.1.4 交付后**，根已知且 DB 可开时应与 CLI `explainSurfaceSubject` 一致或同级显式错误。  
- **人类动作**：用有效 `subject`（如 `probe:test`）在 **未设** `SECOND_NATURE_WORKSPACE_ROOT` 下调一次 — 期望顶层 `ok: false` 且含 `error.code`（与仓库集成测 `tests/integration/cli/plugin-workspace-ops-bridge.test.ts` 中 CH-11-02 用例一致）。

---

## 3. 对话里怎么问（给模型的人类提示词模板）

把下面整段丢给宿主里的主模型（按需改 workspace 路径）：

```text
你是操作者验收 Second Nature（post carrier-honesty 版本）。请只做工具调用、不要编故事：
1) second_nature_ops command=status — 把完整 JSON 贴出。判断：若 ok 为 true 且出现大量空 connectors/credentials，判 FAIL（旧语义）。
2) second_nature_ops command=quiet — 贴完整 JSON。判断：若 ok 为 false 且含 evaluated:false 与 unavailableReason，判 PASS（诚实）；若 quiet.mode 为 unknown 且 ok 为 true，判 FAIL（旧包）。
3) second_nature_ops command=heartbeat_check — 贴完整 JSON。判断：若顶层 status 为 runtime_carrier_only 且无 HEARTBEAT_OK，判 PASS；否则 FAIL。
4) second_nature_ops command=storage_smoke args={} — 贴摘要。判 sql_js / native 结论是否存在。
5) second_nature_ops command=explain args={"subject":"probe:int-s4-human"} — 贴完整 JSON。判断：若根 unknown 且顶层 ok 为 false 且含 `EXPLAIN_READ_SURFACE_UNAVAILABLE`（或同类明确拒绝码），判 PASS（CH-11-02）；若 ok 为 true 且无 error，判 FAIL（旧半成功形状）。
6) 若网关可设环境变量：说明是否已设置 SECOND_NATURE_WORKSPACE_ROOT（**推荐** 与 `agents.defaults.workspace` / 默认 `~/.openclaw/workspace` 一致），并解释 `workspaceRootResolution` 字段含义。
7) **真源声明**：若模型自然语言（如口头「HEARTBEAT_OK」「闭环跑完」）与 **本条 1–5 步贴出的 `second_nature_ops` JSON** 冲突 —— **以 JSON 为准** 判 PASS/FAIL，并把口语漂移记为 Finding（不要求模型当场改口，但报告里不得用口语覆盖 JSON）。
```

### D8 — 「助手说的」和「工具 JSON」谁说了算？

- **问**：宿主会话里模型仍用旧话术（例如顶层 `HEARTBEAT_OK` 叙事），和工具返回一致吗？  
- **期望**：**验收与 E2E 表以 `second_nature_ops` 原始 JSON 为真源**；自然语言与 JSON 不一致时，记 **Finding**（网关 env 脱敏 / 未采集时 E2E 表可不标全 PASS，与证据报告一致即可）。

---

## 4. Quiet「有没有用」——两种语境别混谈


| 语境                              | 人类一句话                                | 在宿主上能证明什么                                                                  |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| **设计 / full workspace runtime** | Quiet 参与节律、guard、source-backed 收纳与反思 | 需要 **可读 workspace + 真实 heartbeat 决策链**（INT-S4 仍未宣称全闭合的部分）                  |
| **host-safe carrier 插件面**       | 这条面 **不负责跑 Quiet pipeline**          | 只能证明 **没假装跑** — `evaluated: false` + `unavailableReason` + 明确 `error.code` |


**结论句（可照抄进报告）**：  
「Quiet 机制在 **完整 runtime** 里有设计级作用；在 **carrier 插件面** 上，**正确的作用**是 **拒绝暴露假 Quiet 状态** —— 若你感到『被拒绝』而不是『全绿但 unknown』，那反而是 **新版本的正确观感**。」

---

## 5. 与旧 J0–J7 指南的关系

- **机械旅程**（安装、transcript、capability probe）：仍见 `docs/validation/int-s4-host-smoke-testing-guide.md`。  
- **人类观感 + carrier 诚实语义**：以 **本文件** 为准；旧指南里若仍写「仅 `runtime_carrier_only` 记 unknown」等句子，请以 **本文件 + 当前 `plugin/index.ts`** 为准更新旧表。

---

## 6. 输出物（可选）

- 将每条 D1–D6 的 **踏实 / 困惑 / 生气** 记一行表，附 JSON 片段 → 可并入 `reports/int-s4-e2e-prd-confirmation.md` 或单独 `reports/int-s4-human-operator-run-YYYYMMDD.md`。

