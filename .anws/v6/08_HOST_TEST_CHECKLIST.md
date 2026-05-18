# Second Nature v6 Host Test Checklist

> **版本**: 0.1.24  
> **日期**: 2026-05-16  
> **用途**: 交给 OpenClaw 宿主在会话中留意/触发的验证项  
> **自动化基线**: `pnpm test` 全量 pass（单测 + 集成测）

---

## A. 插件加载验证（宿主启动时自动发生）

| # | 检查项 | 预期行为 | 观察方式 |
|---| --- | --- | --- |
| A1 | 插件 register() 无报错 | 控制台出现 `[second-nature] register() completed` | 宿主启动日志 |
| A2 | `second_nature_ops` 出现在会话工具表 | 工具列表包含 `second_nature_ops` | 宿主工具枚举或 `/tools` |
| A3 | 插件版本正确 | `@haaaiawd/second-nature@0.1.24` | `npm ls @haaaiawd/second-nature` 或宿主插件列表 |

---

## B. `second_nature_ops` 命令验证（宿主会话中调用）

### B1. 已实现命令（0.1.24 应正常工作）

| # | 命令 | 输入示例 | 预期输出 | 风险 |
|---| --- | --- | --- | --- |
| B1.1 | `heartbeat_check` | `{ action: "heartbeat_check" }` | `ok:true` + `runtimeMode` + decision 摘要 | 无 workspaceRoot 时返回 `runtime_carrier_only` |
| B1.2 | `connector:status` | `{ action: "connector:status" }` | `ok:true` + summary (total/builtIn/executable/pendingTrust) + connectors 列表 | 无 registry 时返回 `REGISTRY_UNAVAILABLE` |
| B1.3 | `connector:test` (executable) | `{ action: "connector:test", platformId: "moltbook" }` | `ok:true` + dry-run health checks | 默认 dry-run，不触发外部副作用 |
| B1.4 | `connector:test` (pending-trust) | `{ action: "connector:test", platformId: "custom-agent" }` | `ok:false` + `PENDING_TRUST_DENIED` | **关键安全项**：不可执行 connector 必须返回 denied |
| B1.5 | `connector:init` | `{ action: "connector:init", platformId: "test-plat", runnerKind: "custom_adapter" }` | `ok:true` + manifestPath + adapterPath + typesPath | 生成 3 个文件；目标已存在返回 `ok:false` |
| B1.6 | `status` | `{ action: "status" }` | `ok:true` + v6 聚合摘要 (narrative+dream+cycles) | 缺 workspaceRoot 时退化为 carrier-only |
| B1.7 | `explain` | `{ action: "explain", subject: "narrative" }` | 结构化解释或 `EXPLAIN_READ_SURFACE_UNAVAILABLE` | carrier 模式下诚实返回不可用 |
| B1.8 | `quiet` | `{ action: "quiet" }` | `ok:true` + reflection 结果或 `nothing_yet` | 依赖 source-backed evidence |
| B1.9 | `storage_smoke` | `{ action: "storage_smoke" }` | `ok:true` + sql.js 语义验证 | 仅验证存储层可用 |
| B1.10 | `narrative` | `{ action: "narrative" }` | `ok:true` + NarrativeState 摘要 / `nothing_yet` | workspace state db  required |
| B1.11 | `dream:recent` | `{ action: "dream:recent", limit: 5 }` | `ok:true` + DreamTrace 列表 / `totalRuns:0` | workspace audit db required |
| B1.12 | `goal` | `{ action: "goal", action: "list" }` | `ok:true` + goal 列表 | workspace state db required |
| B1.13 | `cycle:recent` | `{ action: "cycle:recent", limit: 5 }` | `ok:true` + cycle buckets / `nothing_yet` | workspace audit db required |

### B2. 未实现命令

v6 周期内所有计划命令均已实现（T1.2.1–T1.2.6）。无未实现命令。

---

## C. 安全边界验证（宿主应特别留意）

| # | 安全项 | 验证方法 | 预期 | 严重度 |
|---| --- | --- | --- | --- |
| C1 | pending-trust connector 不被执行 | 调用 `connector:test` 对 custom_adapter 类型 | `ok:false` + `PENDING_TRUST_DENIED` | **High** |
| C2 | connector:init 不覆盖已有文件 | 对已存在 platformId 再次 init（无 force） | `ok:false` + reason 含 "force" | **High** |
| C3 | connector:init 生成物不被自动信任 | init 后调用 `connector:status` | 新 connector 的 `executable=false` + `trustStatus=custom_adapter_pending_trust` | **High** |
| C4 | connector:init 路径不逃逸 | platformId 含 `..` 或 `/` | `ok:false` + path safety denied | **High** |
| C5 | carrier 模式不伪造数据 | 无 workspaceRoot 时调用 status/explain | 诚实返回 `runtime_carrier_only` 或 `unavailable` | Medium |
| C6 | 无敏感数据泄漏 | 检查 status/explain 输出 | 不含 raw prompt/token/credential | Medium |

---

## D. Connector 运行时验证

| # | 检查项 | 验证方法 | 预期 |
|---| --- | --- | --- |
| D1 | 内置 connector 可见 | `connector:status` | moltbook + evomap + agent-world 三个 built_in |
| D2 | Moltbook 可 dry-run | `connector:test` platformId=moltbook | `ok:true` + healthChecks=["ok"] |
| D3 | EvoMap 可 dry-run | `connector:test` platformId=evomap | `ok:true` + healthChecks=["ok"] |
| D4 | Agent-world 可见但 pending | `connector:status` 查 agent-world | `executable=false` + `custom_adapter_pending_trust` |
| D5 | workspace connector 扫描 | 在 `.second-nature/connectors/` 放一个 manifest.yaml 后调用 `connector:status` | workspace source 出现 |

---

## E. 心跳与生命周期验证

| # | 检查项 | 验证方法 | 预期 |
|---| --- | --- | --- |
| E1 | 心跳可执行 | `heartbeat_check` | `ok:true` + decision trace |
| E2 | 心跳写入观测记录 | 心跳后调用 `explain subject=heartbeat` | 可看到最近决策 |
| E3 | 心跳 connector action 路由 | 有 connector evidence 时心跳 | connector action 出现在 effect 路径 |
| E4 | store 失败不吞错误 | 模拟存储不可用 | trace 中可见 store failure 信号 |

---

## F. 回归验证（v5 不倒退）

| # | 检查项 | 预期 |
|---| --- | --- |
| F1 | v5 heartbeat surface 不变 | `heartbeat_check` 返回字段与 0.1.23 一致 |
| F2 | v5 state schema 可读写 | SessionChronicle / NarrativeState / AgentGoal CRUD 正常 |
| F3 | v5 connector parity | Moltbook/InStreet/EvoMap 行为与硬编码路径一致 |
| F4 | 插件 runtime package 结构 | `plugin/index.js` + `plugin/runtime/` 完整 |
| F5 | 审计 hash chain | `verifyAuditHashChain` 通过 |

---

## G. 待实现任务验证（未来版本留意）

以下任务在 0.1.24 **未实现**，宿主在后续版本升级时应验证：

| 任务 | 描述 | 阻塞项 | 预计解锁版本 |
| --- | --- | --- | --- |
| T7.1.1 | Dream Pipeline | 无（S1 已完成） | 0.2.0 |
| T7.1.2 | Dream 调度器 | T7.1.1 | 0.2.0 |
| T7.1.3 | Insight Extraction | T7.1.1 | 0.2.0 |
| T7.1.4 | Narrative Update proposal | T7.1.1 | 0.2.0 |
| T7.1.5 | Relationship Update proposal | T7.1.1 | 0.2.0 |
| T5.1.1 | DreamTrace 审计层 | T7.1.1 | 0.2.0 |
| T5.1.2 | NarrativeTrace 审计层 | T2.1.5 ✓ | 0.1.25 |
| T2.3.1 | Outreach v6 judgment | T6.1.1 ✓ | 0.1.25 |
| T1.2.1 | sn narrative 命令 | T5.1.2 | 0.2.0 |
| T1.2.2 | sn dream:recent 命令 | T5.1.1, T7.1.1 | 0.2.0 |
| T1.2.4 | sn goal 命令 | T4.1.4 ✓ | 0.1.25 |
| T1.2.5 | sn cycle:recent | T5.1.1, T5.1.2 | 0.2.0 |
| T1.2.6 | v6 status 聚合 | T1.2.1-T1.2.5 | 0.2.0 |
| INT-S1 | S1 关门报告 | S1 任务已完成，缺正式报告 | 0.1.25 |
| INT-S2 | S2 关门报告 | T7.1.1-T7.1.5 | 0.2.0 |
| INT-S3 | S3 关门报告 | T2.3.1 | 0.1.25 |
| INT-S4 | S4 关门报告 | T1.2.1-T1.2.6 | 0.2.0 |

---

## 快速冒烟脚本

宿主可在终端执行以下命令做 30 秒冒烟：

```bash
# 1. 确认插件版本
npm ls @haaaiawd/second-nature

# 2. 自动化测试全绿
cd <repo-root> && pnpm test

# 3. 在宿主会话中调用 second_nature_ops 验证：
#    - heartbeat_check → ok:true
#    - connector:status → ok:true + 3 built-in
#    - connector:test moltbook → ok:true dry-run
#    - connector:test custom-agent → ok:false PENDING_TRUST_DENIED
```

---

## 变更摘要 (0.1.24 vs 0.1.23)

| 变更 | 说明 |
| --- | --- |
| CR7-01 修复 | `connector:init` 现生成 manifest.yaml + adapter.ts + types.ts；目标已存在返回 `ok:false` |
| CR7-02 修复 | `connector:test` 对 pending-trust/non-executable 返回 `ok:false` + `PENDING_TRUST_DENIED` |
| agent-world connector | 新增内置 agent-world connector（manifest + adapter + index） |
| DynamicConnectorRegistry 接线 | registry 接入 CliRuntimeDeps / OpsRouter / workspace-ops-bridge |
| 436 测试 | 从 433 增至 436，新增 connector-init / connector-status / registry 测试 |
