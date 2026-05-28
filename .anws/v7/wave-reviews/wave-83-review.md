# 🌊 Wave 83 Review — Declarative HTTP Runner + 自定义 Connector 执行解锁

**签入**: AUTO
**code-reviewer**: 用户确认方案 B 后执行
**状态**: 完成（2026-05-27）
**波次范围**: Wave 83 (T-V7C.C.8, T-V7C.C.9, INT-V7C.U 补全)

---

## 产出

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/cli/commands/connector-init.ts` | 修改 | `declarative_http` → `declarative_trusted`；`baseUrl` → `runner.config.baseUrl` |
| `src/connectors/services/connector-executor-adapter.ts` | 修改 | `createDeclarativeHttpRunner` 通用 HTTP runner + `findWorkspaceManifest` + workspace connector fallback |
| `reports/int-v7c-u-heartbeat-unlock.md` | 新增 | 全链路验证报告 |
| `tests/unit/cli/connector-init-manifest.test.ts` | 新增 | 3 单元测试 |
| `tests/integration/connectors/declarative-http-runner.test.ts` | 新增 | 2 集成测试（GET + POST） |

---

## 核心问题闭环

**原问题**: `connector-executor-adapter.ts:222-226` 硬编码白名单只允许 `moltbook/evomap/agent-world`，任何自定义 platformId 返回 `unknown_platform`。

**修复**: 在 built-in 分支之后添加 workspace declarative_http fallback：
```ts
const workspaceManifest = findWorkspaceManifest(platformId, workspaceRoot);
if (workspaceManifest && workspaceManifest.runner.kind === "declarative_http") {
  const httpRunner = createDeclarativeHttpRunner(workspaceManifest, credential);
  return httpRunner.run(_plan, request);
}
```

---

## 测试摘要

| 测试文件 | 类型 | 通过 | 失败 |
|---------|------|------|------|
| `connector-init-manifest.test.ts` | 单元 | 3 | 0 |
| `declarative-http-runner.test.ts` | 集成 | 2 | 0 |
| Wave 80-82 既有测试 | 混合 | 20 | 0 |

**总计**: 25 pass / 0 fail

---

## 最高严重度

none

---

## 残留待跟进

- **evomap**: 仍返回 `not_implemented`，未实现真实 runner 或 mock
- **agent-world**: 仍需要 `SECOND_NATURE_AGENT_WORLD_BASE_URL` 环境变量，无 mock 回退
- **通用 HTTP 路径映射**: 当前使用 `/{capabilityId.replace('.', '/')}` 约定，复杂 API 可能需要 capability 级 path 配置
- **sourceRefs 长期**: goal fallback 能过 guard，但真实 evidence pipeline 仍需后续建设

---

## 自定义 Connector 现在怎么工作

```bash
# 1. 初始化
second-nature connector init my-api \
  --runnerKind declarative_http \
  --baseUrl https://api.example.com

# 生成 .second-nature/connectors/my-api/manifest.yaml:
#   runner:
#     kind: declarative_http
#     config:
#       baseUrl: https://api.example.com
#   trust:
#     status: declarative_trusted

# 2. 心跳触发
planCandidateIntents → my-api intent (sourceRefs from goal)
  → evaluateHardGuards (allow)
  → connectorExecutor → 通用 HTTP runner
  → GET  https://api.example.com/feed/read
  → POST https://api.example.com/post/publish
```
