# 🌊 Wave 80-82 Review — Heartbeat Unlock: SourceRefs / Affordance / Execution 因果链修复

**签入**: AUTO
**code-reviewer**: 默认执行
**状态**: 完成（2026-05-27）
**波次范围**: T-V7C.C.8, T-V7C.C.9, INT-V7C.U

---

## 产出

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/core/second-nature/orchestrator/intent-planner.ts` | 修改 | 添加 `capabilityIntent` 到候选意图；sourceRefs 空时回退到 goal-based refs |
| `src/cli/index.ts` | 修改 | `createWorkspaceAffordanceAssembler` 的 `credentialRequired` 改为 built-in platforms 返回 `true` |
| `src/connectors/services/connector-executor-adapter.ts` | 修改 | 新增 `createMoltbookMockRunner` + moltbook 分支 mock 回退 |
| `.second-nature/mock/moltbook-feed.json` | 新增 | Mock 数据模板 |
| `tests/unit/control-plane/intent-planner-source-ref-fallback.test.ts` | 新增 | 6 单元测试 |
| `tests/unit/body/affordance-assembler.test.ts` | 扩展 | 1 单元测试（built-in → needs_auth） |
| `tests/integration/connectors/moltbook-mock-runner.test.ts` | 新增 | 2 集成测试 |
| `tests/integration/control-plane/v7c-heartbeat-unlock-e2e.test.ts` | 新增 | 1 E2E 测试（全链路） |

---

## 问题修复因果链

**修复前:**
```
planCandidateIntents (sourceRefs: []) → evaluateHardGuards (missing_source_refs ❌) → execution (从未到达)
                                    ↓
                              affordanceMap (unavailable ❌)
```

**修复后:**
```
planCandidateIntents (sourceRefs: [goal://...]) → evaluateHardGuards (allow ✅) → connectorExecutor (mock success ✅)
                                          ↓
                                    affordanceMap (needs_auth ✅)
```

---

## 测试摘要

| 测试文件 | 类型 | 通过 | 失败 |
|---------|------|------|------|
| `intent-planner-source-ref-fallback.test.ts` | 单元 | 6 | 0 |
| `affordance-assembler.test.ts` | 单元 | 11 | 0 |
| `moltbook-mock-runner.test.ts` | 集成 | 2 | 0 |
| `v7c-heartbeat-unlock-e2e.test.ts` | E2E | 1 | 0 |
| 核心回归（control-plane + body + connectors） | 混合 | 361 | 0 |

**总计**: 381 pass / 0 fail / 3 justified skips

---

## 最高严重度

none

---

## 残留待跟进

- **实机 connector exec DB growth**: 本地 mock 路径已验证，真实 API 环境待 Claw 0.1.38+ 补充
- **evomap/agent-world mock**: 当前仅 moltbook 有 mock 路径，其他 built-in platforms 仍返回 `not_implemented` / `configuration_missing`

---

## 下一步

- Wave 83（如有）：扩展 mock 路径到 evomap/agent-world，或建立真实 credential + base URL 配置
- 或返回 `/change` 处理 07_CHALLENGE_REPORT 新增项
