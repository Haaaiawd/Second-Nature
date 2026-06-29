# Second Nature：`second_nature_ops` 会话工具不可见 — 问题报告

**报告日期**: 2026-05-06  
**关联验证**: `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`（INT-S4 / T1.1.4 宿主与会话侧）  
**前置探索报告**: 已归档删除（原 `explore/reports/2026-05-05_second-nature-ops-registration-gap.md`）。

---

## 1. 执行摘要

在目标 OpenClaw 网关（经 `127.0.0.1:18789` 仪表盘会话验证）上，**Second Nature 的心跳/HEARTBEAT 配置已被宿主正常消费**，但 **代理会话内枚举到的工具列表不包含 `second_nature_ops`**（`second_nature_ops_present: false`），导致基于 `second_nature_ops` 的 E2E 旅程（如 `J-HOST-01..04`）无法在「会话工具 JSON」层面验收通过。

**干系人结论（你已确认）**: 安装与启用状态在你侧可信；本问题按 **Second Nature 插件在宿主上的「工具注册/可见性」缺陷（P0）** 跟踪，直至在目标 OpenClaw 版本上 **新会话工具表稳定出现 `second_nature_ops`**。

**工程侧备注（证据等级）**: 仓库内声明与集成测试表明 `registerTool` 路径在 **受控加载** 下成立；宿主现场仍缺 **同进程 stderr / 插件加载栈 / OpenClaw 工具合并策略** 的硬日志，故本报告在「根因单点」上保持 **可推翻**：若后续证明为宿主全局过滤非内置工具，则缺陷归属应回写到宿主或配置层。

---

## 2. 现象（Symptoms）

| 维度 | 观察 |
|------|------|
| 心跳/HEARTBEAT | 宿主侧行为符合预期（你已确认：OpenClaw 对心跳配置使用正常） |
| 会话工具表 | 仅见内置类工具（如 `cron`, `edit`, `exec`, `read`, `write`, …），**无** `second_nature_ops` |
| 会话探测 | 返回 `NO_SECOND_NATURE_OPS`；模糊匹配无 `second`/`nature` 相关工具名 |
| 复现范围 | 新会话 + 网关重启后仍可复现（非单纯旧会话污染）——见探索报告 |

**代表性会话侧 JSON（摘要）**

```json
{
  "tools": [
    "cron", "edit", "exec", "memory_get", "memory_search", "process",
    "read", "session_status", "sessions_history", "sessions_list",
    "sessions_send", "sessions_spawn", "sessions_yield", "subagents",
    "update_plan", "web_fetch", "web_search", "write"
  ],
  "second_nature_ops_present": false
}
```

---

## 3. 技术分析：为何「心跳正常」≠「工具可见」

1. **心跳路径**  
   宿主可基于 **workspace 内 `HEARTBEAT.md`、调度与注入策略** 驱动节律与提示词侧行为；该路径 **不依赖** 模型侧 `second_nature_ops` 出现在 tool schema 中。

2. **插件工具路径**  
   `second_nature_ops` 依赖插件入口被加载、`register(api)` 执行，且宿主将 **plugin 注册的工具** 合并进 **当前 agent/会话** 的可用工具集合。任一环节未按 OpenClaw 契约完成，都会出现 **「心跳有、工具无」** 的分裂现象。

因此：**你观察到的组合在架构上是自洽的**；它指向 **工具合并/注册链路** 断裂或 **插件未满足宿主对扩展工具的加载契约**，而不是「安装包不存在」的简单问题。

---

## 4. 仓库侧事实（Second Nature 发布物）

以下用于说明「声明层与自测层」与「宿主会话层」不一致，支撑 **按插件/契约缺陷优先排查**。

| 证据 | 路径 / 说明 |
|------|----------------|
| Manifest 声明工具 | `plugin/openclaw.plugin.json` → `capabilities.tools` 含 `"second_nature_ops"` |
| 运行时注册 | `plugin/index.ts`（及发布物 `plugin/index.js`）在 `register(api)` 内调用 `api.registerTool({ name: "second_nature_ops", ... })` |
| 集成测试 | `tests/integration/cli/plugin-runtime-registration.test.ts` 等在受控 mock 宿主 API 下断言注册发生 |

> 结论：**Second Nature 仓库内「应注册该工具」的意图与测试覆盖是明确的**；现场缺口在 **目标宿主 + 该会话** 的工具可见性。

---

## 5. 影响与门禁

- **INT-S4 / T1.1.4**：凡以「会话内可调用 `second_nature_ops`」为硬门槛的验收项 **不得标绿**，直至工具表稳定包含该名称。  
- **产品风险**：运维/quiet/explain 等 **agent 主动 ops** 能力在会话侧不可用，仅余宿主侧可读心跳等行为时，**lived-experience 闭环不完整**。

---

## 6. 建议后续动作（按优先级）

### P0 — 插件侧（与你的「插件 bug」定性一致）

1. 在 **与生产一致的 OpenClaw 版本** 上复现，抓取 **插件加载与 `register` 调用** 的完整日志（是否有静默失败、是否只加载了 carrier 子图）。  
2. 核对 **发布入口** `plugin/index.js` 与宿主加载器是否对 **同步 `register`、动态 import、vm 沙箱** 有特殊要求；对照 `plugin/index.js` 文件头注释中的 host-safe 边界说明。  
3. 若宿主提供 **工具能力探测 API**（CLI 或 debug 端点），在 **同进程** 下对 `second-nature` 做一次 **声明工具 vs 实际注册工具** 的对账。

### P1 — 宿主/配置侧（用于推翻或确认「纯插件」假设）

1. 确认当前会话 **agent profile / tool allowlist** 是否排除 plugin tools。  
2. 确认仪表盘连接的 **gateway 实例** 与插件安装路径指向 **同一 profile**。  
3. 记录 **OpenClaw 与插件精确版本号**，写入本报告附录（避免「版本握手」暗物质）。

---

## 7. 结论

- **已写入独立报告**：是（本文件）。  
- **与既有探索报告关系**：原探索报告 `explore/reports/2026-05-05_second-nature-ops-registration-gap.md` 已归档删除；本报告为 **面向干系人的汇总与门禁说明**。  
- **当前跟踪定性（按你的要求）**: **Second Nature 插件在目标宿主上的 `second_nature_ops` 会话可见性缺陷（P0）**，在宿主日志与 OpenClaw 工具合并语义补齐前，**根因单点仍保留可推翻空间**。

---

## 8. 附录：引用路径

- `plugin/openclaw.plugin.json`  
- `plugin/index.ts` / `plugin/index.js`  
- `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`
