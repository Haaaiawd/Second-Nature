# INT-V7C.U — Heartbeat Unlock Integration Verification Report

**验证日期**: 2026-05-27
**验证范围**: T-V7C.C.8 (Guard Pass) + T-V7C.C.9 (Execution Unlock) + Wave 83 (Declarative HTTP Runner)
**执行人**: `/forge` Wave 80-83
**基线**: `main` @ `397b615` + Wave 80-83 未提交改动

---

## 1. 验证目标

确认心跳失败的三步因果链已完全打通：

1. `planCandidateIntents` 生成非空 `sourceRefs`
2. `evaluateHardGuards` 放行（无 `missing_source_refs` / `affordance_unavailable`）
3. `connectorExecutor` 成功执行并返回数据

同时验证 Wave 83 新增的**通用自定义 connector 执行能力**。

---

## 2. 环境

- **项目**: Second Nature v7
- **版本**: `0.1.40`
- **Runtime**: Node.js 22.16.0 + TypeScript 5.x
- **存储**: SQLite/sql.js (`:memory:` for tests)
- **测试框架**: node:test

---

## 3. 验证项与结果

### 3.1 SourceRefs Goal-Bound Fallback (T-V7C.C.8)

| 测试 | 描述 | 结果 |
|------|------|------|
| W80-T1 | exploration intent 无 lifeEvidence 时从 accepted goal 填充 sourceRefs | ✅ PASS |
| W80-T2 | social intent 同上 | ✅ PASS |
| W80-T3 | outreach intent 同上 | ✅ PASS |
| W80-T4 | 有 lifeEvidence 时优先使用 evidence refs | ✅ PASS |
| W80-T5 | 无 goal 时不修改 sourceRefs | ✅ PASS |
| W80-T6 | goal-based refs 上限 4 个 | ✅ PASS |

**证据**: `tests/unit/control-plane/intent-planner-source-ref-fallback.test.ts`

### 3.2 Affordance Default Posture (T-V7C.C.8)

| 测试 | 描述 | 结果 |
|------|------|------|
| W80-T7 | built-in connector 无 probe 时 posture 为 `needs_auth` 而非 `unavailable` | ✅ PASS |

**证据**: `tests/unit/body/affordance-assembler.test.ts` (built-in platforms test)

### 3.3 Moltbook Mock Runner (T-V7C.C.9)

| 测试 | 描述 | 结果 |
|------|------|------|
| W81-T1 | mock 数据存在时 moltbook feed.read 成功并标记 `source: "mock"` | ✅ PASS |
| W81-T2 | mock 数据不存在时返回 `configuration_missing` | ✅ PASS |

**证据**: `tests/integration/connectors/moltbook-mock-runner.test.ts`

### 3.4 Full Chain E2E (Wave 82)

| 测试 | 描述 | 结果 |
|------|------|------|
| W82-E2E | intent → guard allow → mock execution success 全链路 | ✅ PASS |

**证据**: `tests/integration/control-plane/v7c-heartbeat-unlock-e2e.test.ts`

### 3.5 Declarative HTTP Runner (Wave 83)

| 测试 | 描述 | 结果 |
|------|------|------|
| W83-T1 | `connectorInit --baseUrl` 生成 `runner.config.baseUrl` + `declarative_trusted` | ✅ PASS |
| W83-T2 | `connectorInit custom_adapter` 生成 `custom_adapter_pending_trust` | ✅ PASS |
| W83-T3 | `declarative_a2a` / `declarative_mcp` 也生成 `declarative_trusted` | ✅ PASS |
| W83-T4 | 自定义 declarative_http connector 被通用 runner 执行，GET `/feed/read` | ✅ PASS |
| W83-T5 | 自定义 declarative_http connector POST `/post/publish` | ✅ PASS |
| W83-T6 | `credentials: []` 的 declarative_http connector 无 credential 也能执行，且不发送 Authorization header | ✅ PASS |

**证据**:
- `tests/unit/cli/connector-init-manifest.test.ts`
- `tests/integration/connectors/declarative-http-runner.test.ts`

---

## 4. 核心改动清单

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/core/second-nature/orchestrator/intent-planner.ts` | 修改 | goal-based sourceRefs fallback + capabilityIntent |
| `src/cli/index.ts` | 修改 | affordance assembler built-in `needs_auth` posture |
| `src/connectors/services/connector-executor-adapter.ts` | 修改 | moltbook mock runner + 通用 HTTP runner + workspace manifest 加载 |
| `src/cli/commands/connector-init.ts` | 修改 | declarative_http → `declarative_trusted`；baseUrl → `runner.config.baseUrl` |
| `.second-nature/mock/moltbook-feed.json` | 新增 | Mock 数据模板 |
| `tests/unit/control-plane/intent-planner-source-ref-fallback.test.ts` | 新增 | 6 单元测试 |
| `tests/unit/body/affordance-assembler.test.ts` | 扩展 | 1 单元测试 |
| `tests/integration/connectors/moltbook-mock-runner.test.ts` | 新增 | 2 集成测试 |
| `tests/integration/control-plane/v7c-heartbeat-unlock-e2e.test.ts` | 新增 | 1 E2E 测试 |
| `tests/unit/cli/connector-init-manifest.test.ts` | 新增 | 3 单元测试 |
| `tests/integration/connectors/declarative-http-runner.test.ts` | 新增 | 3 集成测试 |

---

## 5. 回归测试

```
核心回归: 364 tests, 361 pass, 0 fail, 3 justified skips
Wave 83 新增: 6 tests, 6 pass, 0 fail
```

`pnpm build` ✅  
`pnpm lint` ✅

---

## 6. 已知限制

1. **evomap**: 仍返回 `not_implemented`，未实现真实 runner 或 mock
2. **agent-world**: 需要 `SECOND_NATURE_AGENT_WORLD_BASE_URL` 环境变量，无 mock 回退
3. **通用 HTTP runner 路径映射**: 当前使用 `/{capabilityId.replace('.', '/')}` 的约定，复杂 REST API 可能需要更灵活的路径配置
4. **sourceRefs 长期方案**: 当前是 goal fallback，真实 evidence pipeline 仍需后续建设

---

## 7. 结论

**三步因果链已打通**：
```
planCandidateIntents (sourceRefs: [goal://...]) 
  → evaluateHardGuards (verdict: "allow")
  → connectorExecutor (success: true)
```

**通用自定义 connector 已解锁**：
```
connector init my-api --baseUrl https://api.example.com
  → manifest.yaml (declarative_http + declarative_trusted + runner.config.baseUrl)
  → DynamicConnectorRegistry 加载
  → planCandidateIntents 生成意图
  → evaluateHardGuards 放行
  → 通用 HTTP runner 执行 GET/POST 请求
```

**状态**: ✅ PASS
