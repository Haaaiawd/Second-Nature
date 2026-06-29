# E2E Verification — T1.1.4 workspace 读桥 + 宿主诚实边界

> 按 `.cursor/skills/e2e-testing-guide/SKILL.md` 重写。  
> 这是一份**执行指南**，不是“事后报告”。除非你已经实机跑过，否则 `旅程结果`、`Step 结果`、`Evidence` 一律填 `待执行` 或由真人回填。  
> 读者默认是**第一次在 OpenClaw 里验收该插件的人**。所以每一步都先写“此刻你应看到什么”，再写“你要做什么”。

---

## E2E Verification

### Scope

- PRD / 需求来源: `.anws/v5/01_PRD.md` `US-001` / `REQ-019`、`US-006` / `REQ-024`；`.anws/v5/05_TASKS.md` `T1.1.4`、`INT-S4`
- Target: 已构建并安装到目标宿主的 `second-nature` OpenClaw 插件
- Environment: `A. 仓库本地回归` + `B. 真实 OpenClaw 宿主`
- Browser / Viewport（计划）: OpenClaw 桌面会话；证据以工具原始 JSON、宿主 transcript 截图、红acted 路径截图为主
- User Role: owner / 操作者（能设置 `SECOND_NATURE_WORKSPACE_ROOT`，或能在工具顶层传 `workspaceRoot`）
- Build / Commit: 执行前填写当前 `git rev-parse HEAD`、插件包版本、安装来源

### PRD traceability (RTM)


| PRD ref  | Summary                                                           | Priority | Journeys                                                        |
| -------- | ----------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| `US-001` | `heartbeat_check` 在根已知时应进入真实 workspace 读路径，而非停留在 carrier-only ack | P0       | `J-REPO-01`, `J-HOST-02`, `J-HOST-03`                           |
| `US-006` | Quiet 在根 unknown 时必须诚实拒绝；在根已知时才允许给出真实读结果                          | P1       | `J-HOST-01`, `J-HOST-02`                                        |
| `T1.1.4` | `env` / `tool_args` 两种根解析都要可验证；`unknown` 必须保持 honest failure      | P0       | `J-REPO-01`, `J-HOST-01`, `J-HOST-02`, `J-HOST-03`, `J-HOST-04` |
| `INT-S4` | 真实宿主要留证，未有宿主 transcript 不得把里程碑写成完成                                | P0       | `J-HOST-01`, `J-HOST-02`, `J-HOST-03`, `J-HOST-04`              |


### Surface coverage


| 功能面 / 入口                                         | 如何发现                                                                                       | Journey                                            | PRD ref            | Notes                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| `second_nature_ops` 工具入口                         | 在 OpenClaw 会话里让模型列出可用工具，或直接请求调用 `second_nature_ops`                                        | `J-HOST-01` - `J-HOST-04`                          | `T1.1.4`           | 第一屏必须先确认工具真的存在，再继续后面的命令                                 |
| `status`                                         | 在同一工具 shell 中传 `command=status`                                                            | `J-HOST-01`, `J-HOST-02`                           | `T1.1.4`           | 用来区分 honest unavailable 和旧版“全绿空盘”                       |
| `quiet`                                          | 在同一工具 shell 中传 `command=quiet`                                                             | `J-HOST-01`, `J-HOST-02`                           | `US-006`           | 看 carrier-only 拒绝是否诚实、root-known 后是否转为真实读结果             |
| `heartbeat_check`                                | 在同一工具 shell 中传 `command=heartbeat_check`                                                   | `J-HOST-01`, `J-HOST-02`, `J-HOST-03`, `J-HOST-04` | `US-001`           | 重点看 `status`、`surfaceMode`、`livedExperienceLoopClaimed` |
| `explain`                                        | 在同一工具 shell 中传 `command=explain` + `args.subject`                                          | `J-HOST-01`, `J-HOST-02`, `J-HOST-04`              | `T1.1.4`           | carrier-only 必须拒绝，bridge 打开后才允许进入 explain 读面            |
| `storage_smoke`                                  | 在同一工具 shell 中传 `command=storage_smoke`                                                     | `J-HOST-01`                                        | `T4.1.4`, `INT-S4` | 这是 packaging / driver 烟雾，不等价 full bridge                |
| `SECOND_NATURE_WORKSPACE_ROOT` / `workspaceRoot` | 通过宿主网关 env、工具顶层参数、或会话启动配置发现                                                                | `J-HOST-02`, `J-HOST-03`, `J-HOST-04`              | `T1.1.4`           | 必须记录“根从哪里来的”以及是否与 agent workspace 对齐                    |
| `fallback` / `report` / `session` / `credential` | 在有 fixture 或 staging 数据时作为扩展读面测试                                                           | `J-HOST-04`                                        | `T1.1.4`           | 没有数据时写进 `Coverage gaps`，不要硬编 PASS                       |
| 本地桥接回归测试                                         | 开发者在仓库根执行 `pnpm build`、`pnpm build:plugin`、`node --test ...plugin-workspace-ops-bridge...` | `J-REPO-01`                                        | `T1.1.4`           | 这是契约基线，不替代真实宿主验证                                        |


### Journeys（旅程级）


| ID          | PRD ref                      | User Journey                                                               | 旅程结果 | Evidence | Notes                    |
| ----------- | ---------------------------- | -------------------------------------------------------------------------- | ---- | -------- | ------------------------ |
| `J-REPO-01` | `T1.1.4`                     | 在仓库本地完成构建与桥接集成测试，确认代码回归基线是绿的                                               | 待执行  | 待执行      | 这是“先看代码没炸”的入口，不代表真实宿主已闭合 |
| `J-HOST-01` | `US-006`, `T1.1.4`           | 不设置任何 workspace 根，在 OpenClaw 中走一遍 carrier-only 基线，确认它诚实拒绝而不是装作读过库          | 待执行  | 待执行      | 这是第一次打开产品的人最先该看到的观感      |
| `J-HOST-02` | `US-001`, `US-006`, `T1.1.4` | 设置 `SECOND_NATURE_WORKSPACE_ROOT` 指向真实 agent workspace，验证 full bridge 真的打开 | 待执行  | 待执行      | 这是 INT-S4 的主旅程           |
| `J-HOST-03` | `T1.1.4`                     | 清掉 env，只通过工具顶层 `workspaceRoot` 再跑一遍，验证 `tool_args` 路径与 env 路径一致            | 待执行  | 待执行      | 用来防止“只有 env 好使，工具参数是假入口” |
| `J-HOST-04` | `T1.1.4`, `INT-S4`           | 故意制造错根、空根、残留 env 等场景，确认不会产出假信心；有条件时补跑扩展读面                                  | 待执行  | 待执行      | 这是风险旅程，不是 happy path     |


### Step breakdown


| Journey     | Step | PRD ref  | Step 结果 | Evidence                                                                        | Notes                                                                                                                                                       |
| ----------- | ---- | -------- | ------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `J-REPO-01` | 1    | `T1.1.4` | 待执行     | `pnpm build` / `pnpm build:plugin` 终端输出                                         | 看：仓库根脚本存在；做：顺序构建；应见：构建完成且 `plugin/runtime` 被打包，没有缺 artifact 报错                                                                                              |
| `J-REPO-01` | 2    | `T1.1.4` | 待执行     | `node --test dist/tests/integration/cli/plugin-workspace-ops-bridge.test.js` 输出 | 看：测试文件存在；做：执行桥接集成测试；应见：通过、且覆盖 root unknown / root known / env-only / bad root 基线                                                                            |
| `J-HOST-01` | 1    | `T1.1.4` | 待执行     | 工具列表截图或 transcript                                                              | 看：OpenClaw 会话已加载插件；做：确认 `second_nature_ops` 可见；应见：工具真实存在，而不是让模型口头复述命令                                                                                       |
| `J-HOST-01` | 2    | `T1.1.4` | 待执行     | `status` 原始 JSON                                                                | 看：当前未设置根；做：调用 `second_nature_ops command=status`；应见：若读面不可用，要明确 unavailable，而不是 `ok:true` 配一堆空数组                                                             |
| `J-HOST-01` | 3    | `US-006` | 待执行     | `quiet` 原始 JSON                                                                 | 看：同一会话、同一 carrier-only 状态；做：调用 `command=quiet`；应见：`ok:false`、`evaluated:false`、带 `unavailableReason` 或同级明确拒绝语义                                              |
| `J-HOST-01` | 4    | `US-001` | 待执行     | `heartbeat_check` 原始 JSON                                                       | 看：仍未设根；做：调用 `command=heartbeat_check`；应见：`status=runtime_carrier_only`、`surfaceMode=host_safe_carrier`、`livedExperienceLoopClaimed=false`                   |
| `J-HOST-01` | 5    | `US-001` | 待执行     | `heartbeat_check` with `probeOnly:true` 原始 JSON                                 | 看：仍在 carrier-only；做：再调一次 `probeOnly:true`；应见：`status=heartbeat_ok`、`surfaceMode=capability_probe`、`reasons` 含 `probe_only`                                  |
| `J-HOST-01` | 6    | `T1.1.4` | 待执行     | `explain` 原始 JSON                                                               | 看：仍未设根；做：调用 `command=explain args={"subject":"probe:int-s4-human"}`；应见：`ok:false` + `EXPLAIN_READ_SURFACE_UNAVAILABLE`，而不是半成功                               |
| `J-HOST-01` | 7    | `INT-S4` | 待执行     | `storage_smoke` 摘要 JSON                                                         | 看：carrier-only 仍允许 packaging smoke；做：调用 `command=storage_smoke`；应见：driver / smoke 结论清楚，但不要把它当成 bridge 已打开                                                   |
| `J-HOST-02` | 1    | `T1.1.4` | 待执行     | 网关 env 截图（路径脱敏）或配置文本                                                            | 看：你能修改目标宿主的运行环境；做：设置 `SECOND_NATURE_WORKSPACE_ROOT`；应见：记录根来源、红acted 后仍能说明它等于 agent workspace                                                                |
| `J-HOST-02` | 2    | `T1.1.4` | 待执行     | `ls <root>/data`、`SOUL.md` / `HEARTBEAT.md` 证据                                  | 看：该路径真的是 Second Nature 的工作根；做：核对 `data/state.db` 与锚文件存在；应见：不是一个刚创建的空目录                                                                                      |
| `J-HOST-02` | 3    | `US-001` | 待执行     | `heartbeat_check` 原始 JSON                                                       | 看：同一会话已设根；做：调用 `command=heartbeat_check`；应见：`surfaceMode=workspace_full_runtime`，且不再是 `runtime_carrier_only`                                                |
| `J-HOST-02` | 4    | `US-006` | 待执行     | `quiet` 原始 JSON                                                                 | 看：bridge 已打开；做：调用 `command=quiet`；应见：给出真实读结果，或至少是非 carrier-only 的同级显式错误                                                                                     |
| `J-HOST-02` | 5    | `T1.1.4` | 待执行     | `explain` 原始 JSON                                                               | 看：bridge 已打开；做：调用 `command=explain args={"subject":"probe:bridge-test"}`；应见：不再返回 `EXPLAIN_READ_SURFACE_UNAVAILABLE`                                         |
| `J-HOST-03` | 1    | `T1.1.4` | 待执行     | 清 env 的说明、会话 transcript                                                         | 看：准备验证 `tool_args` 路径；做：移除 `SECOND_NATURE_WORKSPACE_ROOT`，避免 env 抢优先级；应见：后续 `workspaceRootResolution` 变为 `tool_args` 而非 `env`                               |
| `J-HOST-03` | 2    | `T1.1.4` | 待执行     | `heartbeat_check` with top-level `workspaceRoot` 原始 JSON                        | 看：命令参数里明确出现 `workspaceRoot`；做：调用 `command=heartbeat_check workspaceRoot=<root>`；应见：`surfaceMode=workspace_full_runtime`、`workspaceRootResolution=tool_args` |
| `J-HOST-03` | 3    | `T1.1.4` | 待执行     | 与 `J-HOST-02` 的并排对照                                                             | 看：env 路径与 tool_args 路径都跑完；做：逐字段对照核心结果；应见：除 resolution 来源外，桥接读面语义一致                                                                                          |
| `J-HOST-04` | 1    | `T1.1.4` | 待执行     | 错根或空根说明、截图                                                                      | 看：准备验证负路径；做：故意传一个错根、空目录，或保留陈旧 env；应见：你能明确说明这次“根为什么可能错”                                                                                                      |
| `J-HOST-04` | 2    | `T1.1.4` | 待执行     | `heartbeat_check` / `quiet` / `explain` 原始 JSON                                 | 看：负路径条件已建立；做：至少跑 `heartbeat_check`，必要时补 `quiet`、`explain`；应见：若桥接失败，要给 `WORKSPACE_FULL_OPS_BRIDGE_FAILED`；若技术上成功但语义为空，要记 `partial` 而不是 PASS                  |
| `J-HOST-04` | 3    | `INT-S4` | 待执行     | `fallback` / `report` / `session` / `credential` 中实际可跑者的 JSON，或 blocker 说明      | 看：目标 workspace 是否具备 fixture / staging 数据；做：任选至少一项扩展读面；应见：有数据就给真实读结果，没数据就诚实写 blocker，不要硬凑成功                                                                  |


### Findings

- `[HIGH/MEDIUM/LOW]` 标题
  - PRD ref:
  - Expected / Actual / Repro / Evidence / Suggested fix:
- `[MEDIUM]` 示例: 根已知但 `workspaceRootResolution` 仍为 `unknown`
  - PRD ref: `T1.1.4`
  - Expected / Actual / Repro / Evidence / Suggested fix: 说明 env/参数位置错误，附原始 JSON 与调用方式
- `[MEDIUM]` 示例: 错根时自动建了空 `data/state.db`，结果看起来“成功”但没有真实语义
  - PRD ref: `T1.1.4`, `INT-S4`
  - Expected / Actual / Repro / Evidence / Suggested fix: 记录该路径为什么不是 agent workspace，并建议补锚文件校验或宿主配置修复
- `[LOW]` 示例: 模型自然语言仍说 `HEARTBEAT_OK`，但 JSON 明确显示 `runtime_carrier_only`
  - PRD ref: `INT-S4`
  - Expected / Actual / Repro / Evidence / Suggested fix: 以 JSON 为准，把口语漂移记为 Finding

### Coverage gaps

- **会话工具可见性前置**：若 agent 会话枚举的工具列表不含 `second_nature_ops`，则 **`J-HOST-01`～`04` 不得开工判定 PASS**，也不得把失败归因成「模型不肯调工具」；须先按 `reports/second-nature-ops-tool-visibility-issue-2026-05-06.md` 排查宿主 profile、tool allowlist、插件加载与版本对齐（心跳侧「正常」与会话工具表分裂在架构上可并存）。
- 若无法修改宿主 env，`J-HOST-02` 会被阻塞；只能做 `J-HOST-01` 与部分 `J-HOST-03`
- 若目标环境没有 fixture / staging 数据，`fallback` / `report` / `session` / `credential` 可暂记 blocker，但不能把空结果写成 PASS
- `process.chdir()` 的并发风险不在本指南直接判定；若宿主支持并发工具调用，应另开专项验证
- 主动联系 / 投递路径不在本文件范围内；相关宿主冒烟见 `reports/int-s4-release-readiness.md` 与 `.anws/v5/05_TASKS.md` INT-S4 验证说明

### Recommendation

- 建议先跑 `J-REPO-01`，再确认宿主会话工具表含 `second_nature_ops`，然后跑 `J-HOST-01`，最后连续完成 `J-HOST-02` 与 `J-HOST-03`。这个顺序最像真人第一次接手时的判断路径。
- 若 `J-HOST-02` 无法拿到红acted 根证据或 transcript，不要勾选 `INT-S4` 完成。
- 若 `J-HOST-04` 证实存在“错根也成功”的假信心，再回到 `/change` 讨论锚文件校验或 Plan B，不要在报告里粉饰过去。

---

## 与现有指南的关系


| 文档                                                       | 用途                                           |
| -------------------------------------------------------- | -------------------------------------------- |
| `reports/int-s4-release-readiness.md`                    | INT-S4 阻塞 / Finding / 路径一致性的人类记录面（与 J-HOST 表并列）        |
| `reports/openclaw-carrier-host-brief.md`                 | 宿主侧 JSON 真源、carrier 话术、已知风险与附录归档             |
| **本文件**                                                  | 面向执行者的 E2E guide：范围、旅程、步骤、证据要求、Coverage gaps |


---

## 执行计划（短文）

- Target: 目标 OpenClaw 宿主 + 当前仓库构建出的插件包
- Environment: 先本地、后宿主；两边结论不得混写
- Role: owner / 运维 / 有权限改宿主配置的人
- Data setup: `J-REPO-01` 不需要额外数据；`J-HOST-02` - `J-HOST-04` 需要真实或 staging workspace
- Side effects: 读取真实 state、可能触发 DB 打开、可能在错根目录下自动创建 `data/`
- Blockers: 无宿主权限、无 transcript 导出能力、无法确认 agent workspace 实际路径、插件版本不是当前构建

