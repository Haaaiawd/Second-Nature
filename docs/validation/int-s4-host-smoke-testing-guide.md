# INT-S4 — Host smoke & release readiness（E2E / 手动验证指南）

> 依据 `.cursor/skills/e2e-testing-guide/SKILL.md` 编排；目标用户是 **操作者 / 宿主维护者**，不是「测组件是否存在」。
>
> **契约来源**: `.anws/v5/05_TASKS.md` **INT-S4**；`01_PRD.md` US-007 / US-008；`04_SYSTEM_DESIGN/cli-system.md` §12.2。

> **🧭 新版（人类观感 + carrier 诚实）**  
> CH-09/10 回流后（仓库 **`3792d06`** 起），`second_nature_ops` 的 **`status` / `quiet` / `heartbeat_check`** 语义已变：**不再用「全绿空盘」冒充读模型**。若你关心「用起来心里踏不踏实、Quiet 有没有骗人」，请优先跟 **`docs/validation/int-s4-human-operator-testing-guide.md`**；本文件的 J2/J 表若与插件行为冲突，以该指南 + 当前 `plugin/index.ts` 为准。

---

## E2E Plan（执行前填写）


| 字段                | 填写                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Target            | 你的 OpenClaw 实例（桌面 / 网关 / 远程 workspace 路径）                                                    |
| Environment       | 例：`OpenClaw x.y.z` + `second-nature` 插件 `file:…` 或 npm 安装                                    |
| Host UI / Surface | OpenClaw 对话或网关 UI（若有）；**以及**可执行 `openclaw plugins …` 的 shell                                 |
| User Role         | Owner / operator（可装插件、可看日志、可触发 heartbeat）                                                    |
| Build / Commit    | 本仓库 `git rev-parse HEAD` 与 `pnpm build:plugin` 是否已跑                                          |
| Data Setup        | 最小 `workspace/`：`SOUL.md` `USER.md` `IDENTITY.md` `MEMORY.md`（见根 `README.md`）                |
| Journeys          | 下文 J1–J7（可按宿主裁剪）                                                                             |
| Side Effects      | 真实 heartbeat 可能写 state / observability / workspace artifacts；**不在生产用户上试 outreach 文案**除非已明确授权 |
| Blockers          | 无 `openclaw` CLI、无插件加载权限、无 workspace 路径 → 记 **BLOCKED**                                      |


**本文件在仓库内的生成状态**

- **Execution（Cursor / CI）**: **PARTIAL** — 已在真实 OpenClaw 仪表盘会话（隧道）跑通 `second_nature_ops` 多命令；**J3–J5 仍未闭合**；**PRD US 主链未全开绿**。逐项证据与 US 对照见 `**reports/int-s4-e2e-prd-confirmation.md`**（以该报告为 E2E/PRD 确认 SoT，本文件表格可由操作者同步回填）。

---

## E2E Verification

### Scope

- **Target**: 已安装并启用的 `second-nature` OpenClaw 插件 + 可写 workspace 根目录。
- **Environment**: 与 `README.md` §Install 一致；扩展目录须含 `openclaw.plugin.json`、`index.js`、`runtime/`（见 README「extension root layout」）。
- **Browser / Viewport**: 不适用典型 Web SPA；记录 **OpenClaw 宿主版本、对话或网关界面视口**（若用 UI 触发 heartbeat）。
- **User Role**: 能执行插件 CLI、触发一次真实 heartbeat turn、导出或复制工具调用 transcript 的操作者。
- **Build / Commit**: `________________`

### Checklist


| ID  | User Journey                                                                                                                                                                                      | Status  | Evidence                | Notes                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------- | ------------------------------------------------------------------ |
| J0  | **准备**：`pnpm build && pnpm build:plugin`；将 `plugin/` 内容安装到宿主扩展目录；`openclaw plugins list` 出现 `second-nature` 且 **enabled**                                                                         | NOT RUN | 终端输出路径 + 时间戳            | 安装布局错误会导致后续全部 BLOCKED                                              |
| J1  | **包加载**：宿主启动无报错；`plugins info second-nature`（或等价）显示版本与入口                                                                                                                                          | NOT RUN | 截图或文本                   | 对应 release gate「package load」                                      |
| J2  | **显式 `heartbeat_check`**：调用插件暴露的 `heartbeat_check`；**post-3792d06** 在 carrier 上顶层应为 **`status: "runtime_carrier_only"`**、`livedExperienceLoopClaimed: false`、`nextAction: "continue_carrier_surface_only"`，**不应**再出现顶层 **`HEARTBEAT_OK`/`heartbeat_ok`**；full runtime 另论 | NOT RUN | 完整 JSON 或 redacted 摘要   | 旧包若仍返回 `heartbeat_ok` → 先升级插件再测 |
| J3  | **真实 heartbeat turn 与工具调用**：用宿主默认方式跑 **一轮**由模型参与的 heartbeat；从日志或 transcript 提取 **工具调用原文**                                                                                                         | NOT RUN | transcript 片段（可脱敏）      | 用于 J4                                                              |
| J4  | `**heartbeat_tool_not_invoked` 判定**：将 J3 的 tool 调用列表与官方文档期望对照。若应调用 `second_nature_ops` / `heartbeat_check` 却未出现 → **FAIL**（与 `runHostSmoke` fixture 语义一致：`src/cli/host-smoke/run-host-smoke.ts`）  | NOT RUN | 对照表 + 结论                | 子串匹配参考：`heartbeat_check`、`second_nature_ops({ ... heartbeat_check` |
| J5  | **Capability / delivery 语义（target none / ack）**：执行宿主侧的 **capability probe**（若宿主提供 `probe` 或插件文档中的等价命令），保存 `HostCapabilityReport` 或摘要；记录 `deliveryTarget`、`heartbeatToolInvocation`、`ackDrop` 相关字段 | NOT RUN | JSON 摘要 + `hostVersion` | 与 T1.1.2 契约对齐；未知字段标 **unknown**                                    |
| J6  | **Ops：`storage_smoke`**：通过 `second_nature_ops` / tool 调用 `storage_smoke`（可选 `runRepairFixture: true` 于**非生产** workspace），确认报告含 `sql_js` / native 探测结论                                             | NOT RUN | 返回 JSON 摘要              | 对应 T4.1.4                                                          |
| J7  | **Fallback 可见性**：若存在已知 `fallback:` ref（由一次 `delivery_unavailable` 演练产生），调用 `fallback` 子命令 / tool；确认视图 `**status: not_sent`** 且文案不冒充已投递                                                            | NOT RUN | JSON + 截图（如有 UI）        | T1.2.2                                                             |


**状态枚举**（必须二选一语义）：`PASS` | `FAIL` | `BLOCKED` | `NOT RUN`。

### Findings

*执行后在此列出。若无问题：*

```text
No E2E issues found in executed journeys. Remaining risk: <例如仅覆盖单宿主版本、未测云端多副本等>。
```

若有问题，使用：

- **[HIGH]** …
  - **Expected**:
  - **Actual**:
  - **Repro**:
  - **Evidence**:
  - **Suggested Fix**:

### Coverage Gaps

- 未在真实用户聊天里发送 outreach（若未授权）→ 不覆盖「用户可见收到 DM」全链。
- 多宿主版本矩阵（仅测单一 `hostVersion`）→ 在 `reports/int-s4-release-readiness.md` 标注 **unknown**。
- `ack drop` / `HEARTBEAT_OK` 细语义依赖宿主实现 → 与 `ADR_007` 对齐记录为 pass/fail/**unknown**。

### Recommendation

- 全部 **J0–J7** 至少达到 `PASS` 或已解释的 `unknown`（无隐瞒）后，可将 `**reports/int-s4-release-readiness.md`** 更新为「真实宿主」行 **pass**，并在 `.anws/v5/05_TASKS.md` 勾选 **INT-S4**。
- 任一 **FAIL**（尤其 J4、J7）→ **不要**勾选 INT-S4；开 bug/fix 波次并附证据链。

---

## Journey 详解（操作步骤）

### J0 — 构建与安装

1. 在克隆目录：`pnpm install`（若尚未）。
2. `pnpm build && pnpm build:plugin`。
3. 将 `**plugin/` 目录内容**（不是嵌套多一层 `plugin/plugin`）复制或 `openclaw plugins install file:./plugin` 到宿主扩展根。
4. `openclaw plugins enable second-nature`（或宿主等价命令）。

**失败征象**：网关启动报错、`configSchema` 校验失败（README 已说明勿写未知键）。

### J2 — `heartbeat_check`（显式）

使用宿主文档中调用插件 tool/command 的方式，传入至少：

- `workspaceRoot`：指向含锚点文件的目录。

**期望**：返回 JSON 含明确 `status` / `scope` / `reasons`；若 runtime 未载入，应显式出现 carrier-only 类语义而非静默成功。

### J3 — J4 — 真实 turn transcript

1. 用宿主 UI 触发一次日常 heartbeat（与生产用户流程一致）。
2. 导出模型 tool 调用序列（OpenClaw 日志、trace、或 UI 复制）。
3. 检查是否出现对 `**heartbeat_check`** 的调用（命名以宿主为准，但内容应匹配 `run-host-smoke.ts` 中的正则意图）。

**判据**：文档声称「必须调用 Second Nature heartbeat」而 transcript 无匹配 → **FAIL**（`heartbeat_tool_not_invoked`）。

### J5 — Capability probe

在实现/文档允许的入口运行 probe，保存：

- `hostVersion`、`deliveryTarget`、`heartbeatToolInvocation`、`conflictRecords`（若有）。

与 `README`「validation-needed」段对照：任何未知项在 release gate 表记 **unknown**。

### J6 — `storage_smoke`

通过 `second_nature_ops` 映射调用 `storage_smoke`；可选在非生产 workspace 加 `runRepairFixture: true`。

确认：sql.js 路径不假设 WAL；`nativeSqliteProbe` 有明确布尔结果。

### J7 — `fallback`

需先有 `fallback:` ref（例如由测试环境构造一次 delivery failed）。调用插件 `fallback` 命令；核对返回体中 **不得** 将未发送呈现为已发送。

---

## 与仓库自动化测试的关系


| 本指南（真实宿主）           | 仓库 CI                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| J3–J5 依赖真实 OpenClaw | `pnpm test` 使用 fixture / `:memory:` DB                                                   |
| transcript 人工提取     | `tests/integration/cli/host-smoke-heartbeat-tool.test.ts` 用字符串 fixture 验证 `runHostSmoke` |


CI **不能**替代本文件 J3–J5；INT-S4 勾选依赖本指南在目标环境的 **PASS / unknown 证据**。

---

## 证据归档建议

将以下材料路径写入 `reports/int-s4-release-readiness.md` 或本文件末尾附录：

1. `hostVersion` + OpenClaw 构建标识
2. J2 / J6 / J7 的 JSON（脱敏）
3. J3 transcript 片段（脱敏）
4. J5 capability 摘要
5. 执行日期与操作者签名（可选）

---

## Appendix — 快速命令备忘（非权威，以宿主为准）

```bash
# 在仓库内（验证构建）
pnpm exec tsc --noEmit
pnpm test

# 在宿主环境（示例 — 以你安装的 CLI 为准）
openclaw plugins list
openclaw plugins info second-nature
```

插件侧 `second_nature_ops` 所支持的 `command` 值以 `src/cli/commands/index.ts` 中注册的 `name` 为准（如 `heartbeat_check`、`storage_smoke`、`fallback`、`explain`）。