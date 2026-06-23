# Wave 116D Code Review — 2026-06-20

## 总结结论

**Partial Pass（静态意义下）**。

T-ROS.R.6 的核心修复已在 `src/cli/ops/ops-router.ts` 与 `src/cli/ops/heartbeat-surface.ts` 中落地，并同步重建到 `plugin/runtime/*` 产物。`plugin-workspace-ops-bridge.test.ts` 的验收断言在源码层面均有对应实现。但新引入的 `normalizeEnvelopeResult` 对缺少 `command` 字段的分支处理不够保守，会导致部分错误路径的语义被掩盖；同时 `heartbeat_check` 异常路径的 `surfaceMode` 标注存在不一致。这些问题不直接阻塞本次验收用例，但属于契约漂移，应在合并前修复。

## 审查范围与静态边界

- **已读源码**：
  - `src/cli/ops/ops-router.ts`（完整）
  - `src/cli/ops/heartbeat-surface.ts`（完整）
  - `src/cli/runtime/runtime-artifact-boundary.ts`（完整）
  - `src/cli/commands/index.ts`（createCliCommands 相关片段）
  - `plugin/workspace-ops-bridge.ts`（完整）
  - `plugin/index.ts`（完整）
  - `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`（完整）
  - `.anws/v8/05A_TASKS.md` T-ROS.R.6 段落
  - `.anws/v8/05B_VERIFICATION_PLAN.md` T-ROS.R.6 段落
  - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md`（完整）
  - `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` runtime-ops-system 段落
  - `AGENTS.md` 当前状态块
- **已验证构建产物**：抽样确认 `plugin/runtime/cli/ops/ops-router.js`、`plugin/runtime/cli/ops/heartbeat-surface.js`、`plugin/index.js` 包含本次源码改动（`normalizeEnvelopeResult`、v8 spine 透传、`impulseContext` 暴露）。
- **未执行**：未运行测试、未编译、未修改代码、未连接外部服务。测试是否实际通过无法通过静态审查确认。

## 契约 → 代码映射摘要

| 任务承诺 | 实现位置 | 关键证据 |
|---|---|---|
| full-runtime 命令返回 `surfaceMode: "workspace_full_runtime"` | `normalizeEnvelopeResult` 根据 `runtimeMode` 推导 fallback surface | `src/cli/ops/ops-router.ts:160-167`, `src/cli/ops/ops-router.ts:180-193` |
| `heartbeat_check` 暴露 v8 spine/closure proof | `heartbeatCheck` 设置 `v8Spine`；`dispatch` 透传并包装为 envelope | `src/cli/ops/heartbeat-surface.ts:253-291`, `src/cli/ops/ops-router.ts:848-858` |
| `probeOnly` 返回 `status: "heartbeat_ok"` | `heartbeatCheck` 提前返回 `status: "heartbeat_ok"` | `src/cli/ops/heartbeat-surface.ts:182-190` |
| v6 ops 命令与 `connector_test` 可达 | `WORKSPACE_BRIDGE_COMMANDS` 白名单 + `createCliCommands` 注册 | `plugin/index.ts:287-328`, `src/cli/commands/index.ts:617-640` |
| env-only workspace bridge 工作 | `resolveWorkspaceRoot` 读取环境变量；`routeSecondNatureCommand` 路由到 bridge | `plugin/index.ts:392-408`, `plugin/index.ts:355-390` |
| impulse context 在 artifact 存在时暴露 | `heartbeatCheck` 读取并附加 `impulseContext` | `src/cli/ops/heartbeat-surface.ts:303-336` |

## Lens 结果摘要

- **L1 契约忠实度**：整体符合 T-ROS.R.6 任务契约；`RuntimeOpsEnvelope.surfaceMode` 类型在设计上扩展了未文档化的值（`cli`/`openclaw_tool`/...），与 `runtime-artifact-boundary.ts` 的 `SurfaceMode` 三值定义存在漂移（Low）。
- **L2 任务兑现与交付闭合**：核心交付已落地并同步到 plugin runtime。`normalizeEnvelopeResult` 对缺少 `command` 的返回会丢失原始错误码（Medium）。`heartbeat_check` 异常路径 `surfaceMode: "cli"` 与 runtimeMode 不一致（Low）。
- **L3 架构适配与复杂度健康**：`normalizeEnvelopeResult` 是正确的集中化，但 `ops-router.ts` 内 `fallback` 缺失 ref、`unknown_ops_command`、`dream:recent`/`cycle:recent` 等分支与 `createCliCommands` 存在重复/不一致，部分分支缺少 `command` 导致 envelope 失效（Medium/Low）。
- **L4 静态运行风险与安全边界**：未发现新增密钥/凭证泄露风险；`readRowsFromTable` 表名来自硬编码映射，无用户注入风险；输入校验保持原有水平。
- **L5 验证证据与可观测性**：`plugin-workspace-ops-bridge.test.ts` 覆盖了任务 acceptance 的主要场景，但未覆盖 envelope 异常/错误路径；测试实际是否通过需运行时确认。
- **L6 回流一致性与交接证据**：`AGENTS.md` 已更新为 Wave 116D 状态；`05A_TASKS.md` T-ROS.R.6 仍 unchecked（待验证后勾选，符合流程）；`05B_VERIFICATION_PLAN.md` 对 probeOnly 的 `surfaceMode` 描述与测试断言存在轻微漂移（Low）。

## Issues

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Medium | L1+L3 | Envelope normalization masks error codes when dispatch branch omits `command` | `src/cli/ops/ops-router.ts:883`（fallback 缺少 ref 返回 `{ ok: false, error: {...} }` 无 `command`）；`src/cli/ops/ops-router.ts:2095`（`unknown_ops_command` 返回 `{ ok: false, error: {...} }` 无 `command`） | 调用者收到 `OPS_RESULT_NOT_AN_ENVELOPE` 与通用 message，丢失 `MISSING_FALLBACK_REF` / `unknown_ops_command` 等可actionable code 和 nextStep | 所有 `dispatch` 分支统一返回至少包含 `command` 与 `runtimeMode`/`surfaceMode` 的对象；或让 `normalizeEnvelopeResult` 的非 envelope 分支优先透传 `raw.error` | `05B_VERIFICATION_PLAN.md#t-ros-r-6`；`04_SYSTEM_DESIGN/runtime-ops-system.md` §2 |
| Medium | L2+L3 | `dream:recent` / `cycle:recent` ops-router branches return data-only shapes inconsistent with CLI path | `src/cli/ops/ops-router.ts:1245-1274` 返回 `{ ok: true, data }` 无 `command`；`src/cli/commands/index.ts:708-730` 定义了同名 custom execute | 若直接调用 `opsRouter.dispatch("dream:recent")`，结果会被 `normalizeEnvelopeResult` 判定为非 envelope，导致 `ok: false` 且 `data` 丢失 | 移除 ops-router 中这两个 dead branches（CLI/bridge 已通过 `createCliCommands` 处理），或使其返回完整 `RuntimeOpsEnvelope` | `05A_TASKS.md` T-ROS.R.6 |
| Low | L1+L6 | `RuntimeOpsEnvelope.surfaceMode` 扩展了未在系统设计中定义的枚举值 | `src/cli/ops/ops-router.ts:109` 类型包含 `"cli"`, `"openclaw_tool"`, `"plugin_command"`, `"cron_probe"`；`src/cli/runtime/runtime-artifact-boundary.ts:14` 仅定义三值 `SurfaceMode` | 设计文档 `runtime-ops-system.md` 的 `RuntimeOpsEnvelope` 未声明 `surfaceMode`，实际类型与 artifact boundary 概念不一致 | 在 `04_SYSTEM_DESIGN/runtime-ops-system.md` §2 显式定义 `surfaceMode` 取值与语义，或收敛 `ops-router.ts` 类型到 `SurfaceMode` | `04_SYSTEM_DESIGN/runtime-ops-system.md` §2 |
| Low | L2 | `heartbeat_check` 异常 envelope 的 `surfaceMode` 未反映 `runtimeMode` | `src/cli/ops/ops-router.ts:866` 异常路径写死 `surfaceMode: "cli"`，而同块 `runtimeMode` 可为 `workspace_full_runtime` | 异常响应的 surface 标签与运行时可获得性不一致，可能让 host/operator 误判为 CLI-only 失败 | 改为 `surfaceMode: runtimeAvailable ? "workspace_full_runtime" : "cli"`，或统一经 `normalizeEnvelopeResult` 包装 | `05A_TASKS.md` T-ROS.R.6 |
| Low | L6 | Verification plan 对 `probeOnly` 的 `surfaceMode` 描述与测试断言不一致 | `.anws/v8/05B_VERIFICATION_PLAN.md:1090` 写 `asserts surfaceMode="workspace_full_runtime"`；`tests/integration/cli/plugin-workspace-ops-bridge.test.ts:469` 断言 `surfaceMode: "capability_probe"` | 后续维护者可能对验收期望产生混淆 | 更新 `05B_VERIFICATION_PLAN.md` T-ROS.R.6 条目，区分 full-runtime heartbeat_check 与 probeOnly 的 surfaceMode 期望 | `05B_VERIFICATION_PLAN.md#t-ros-r-6` |

## 安全 / 测试覆盖补充

- **安全**：本次改动未引入新的密钥/凭证访问路径；`runtime_secret_bootstrap` 与 `guidance_payload` 仍通过已有端口访问，无明文 key 落盘或返回。`normalizeEnvelopeResult` 的 spread 行为对内部命令结果不会额外放大泄露面，但建议审查所有返回对象是否意外携带 raw audit/private payload。
- **测试覆盖**：
  - 覆盖充分（sufficient）的场景：`heartbeat_check` full-runtime/probeOnly、v6 ops reachability、`connector_test` dry-run、env-only bridge、impulse context presence。
  - 覆盖缺失（missing）的场景：bridge 异常路径、`normalizeEnvelopeResult` 对非 envelope 输入的处理、缺少 `command` 的错误分支。
  - 实际测试通过状态：无法通过静态审查确认，需执行 `plugin-workspace-ops-bridge.test.ts` 及 Wave 108-115 回归样本。
