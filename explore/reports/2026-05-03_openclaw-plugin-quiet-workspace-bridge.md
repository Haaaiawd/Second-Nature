# 探索报告: OpenClaw 插件上启用 Quiet / 完整 heartbeat 读路径

**日期**: 2026-05-03  
**触发**: 用户原话 —「不允许」仅 host-safe carrier 拒绝 Quiet；要求 **/change + /explore** 找解决办法。

---

## 1. 问题与范围

**核心问题**: 作为 OpenClaw 插件，能否在 **不撒谎** 的前提下，让 **Quiet 与 workspace heartbeat 决策链** 在操作者常用的 `second_nature_ops` 面上 **真正执行或可观测**？

**包含**

- 当前技术栅栏（`plugin/index.ts` 注释、同步 `register`、sql.js 异步引导、`readModels` 依赖）。
- 与已有 CLI 路径 `createCliRuntimeDeps` → `createOpsRouter` → `heartbeatCheck` → `createWorkspaceHeartbeatRunner` → `runHeartbeatCycle` 的复用关系（见 `src/cli/index.ts`, `src/cli/ops/heartbeat-surface.ts`, `src/cli/ops/workspace-heartbeat-runner.ts`）。

**不包含**

- 修改 PRD 对 Quiet 的定义或推翻 ADR-003/005/007 核心决策（仍属 v5 前提内 **实现缺口**）。
- 替用户承诺 OpenClaw 官方尚未暴露的 API（仅列为 **宿主依赖**）。

---

## 2. 核心洞察（Key Insights）

1. **不是「OpenClaw 禁止 Quiet」**  
   栅栏主要是 **当前插件装载策略**：同步注册 + 避免在 `register()` 时拉整棵含异步 sql 引导的图；**不是** Quiet 算法不存在。

2. **已有「真跑」流水线在 CLI 侧闭合**  
   `heartbeatCheck` 在 `readModels` 可用且 `runtimeAvailable` 时走 `runHeartbeatCycle`（含 Quiet 编排潜力）。插件缺的是 **同一套 `CliReadModels` 在插件进程内、对正确 `workspaceRoot` 的惰性装配**。

3. **workspace 根已部分解开**  
   `SECOND_NATURE_WORKSPACE_ROOT` + 工具 `workspaceRoot` + `workspaceRootResolution`（CH-10-03）为 **bridge** 提供了前提；下一步是 **在根已知时 lazy-import 装配 read models**，而不是继续只返回 `QUIET_READ_SURFACE_UNAVAILABLE`。

4. **风险最高的捷径是「假成功」回归**  
   任何方案必须保留 **carrier 诚实**：根 `unknown` 时仍 `ok: false`；根已知但 DB 打不开时必须 **显式错误**，不得回退为零计数真值形状。

5. **备选：进程外 CLI**  
   若沙箱内动态 import 仍不可靠，可用 **受控子进程** 调 workspace 内 `second-nature` CLI（成本：打包路径、权限、延迟）；作为 **Plan B** 写进任务验收。

---

## 3. 方案对比（简表）

| 方案 | 思路 | 可行性 | 风险 | 推荐度 |
|------|------|:------:|------|:------:|
| **A. 惰性 full bridge（同进程）** | `register()` 仍同步；首次需要读模型时 `import()` 装配 `createCliRuntimeDeps({... workspaceRoot })` + `createOpsRouter`，`heartbeat_check`/`quiet` 委托 `opsRouter` | 中高 | sql.js/vm 加载顺序、内存 | ⭐ 首选 |
| **B. 子进程 CLI** | 插件 `spawn` 调 `node …/cli … --workspaceRoot` | 高 | 打包路径、I/O、安全 argv | ⭐ 备选 |
| **C. 仅 hook 摘要** | 依赖 OpenClaw `heartbeat_prompt_contribution` 注入摘要；Quiet 仍在别处跑 | 中 | 仍要有「别处」= workspace 进程 | 辅助 A/B |

---

## 4. 行动建议（已落入 `/change` 任务）

| 优先级 | 建议 | 理由 |
|:------:|------|------|
| P0 | 新增 **T1.1.4**（见 `05_TASKS.md`）：在 workspace 根可解析时实现 **plugin → full read path** 的受控桥接；验收含单测 + INT-S4 宿主说明 | 与用户「不允许只有 carrier」直接对应 |
| P1 | 在 `cli-system.detail.md` 或 research 补一节 **「Plugin workspace bridge」** 边界（何时同进程、何时子进程） | 契约可追溯；本次可先仅靠 TASKS + explore 报告，设计文件可按后续 `/forge` 补 |

---

## 5. 局限性与待验证

- OpenClaw **实际 VM / sandbox** 是否允许惰性 `import()` 拉 sql.js：需 **目标宿主** 冒烟。
- 多 workspace / 多租户：根从谁传入（env vs host API）需与运维约定。

---

## 6. 参考（仓库内）

- `plugin/index.ts` — host-safe router、`resolveWorkspaceRoot`
- `src/cli/index.ts` — `createCliRuntimeDeps`, `createOpsRouter`
- `src/cli/ops/heartbeat-surface.ts` — `readModels` 分支
- `src/cli/ops/workspace-heartbeat-runner.ts` — `runHeartbeatCycle` 接线
