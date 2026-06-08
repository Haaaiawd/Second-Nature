# INT-S5 — S5 集成验证报告：Explain the Loop

> **版本**: v8
> **日期**: 2026-06-01
> **验证范围**: Sprint S5 — Causal Loop Health + loop_status Ops Surface + Diagnostic Attribution + Guidance Proposal Consumption
> **验证方式**: 冒烟测试 / 单元测试聚合 / 集成测试 / 编译检查

---

## 1. 退出标准检查清单

| # | 退出标准 | 状态 | 证据 |
| --- | --- | :---: | --- |
| S5-E1 | `loop_status` 暴露为 CLI/OpenClaw ops 命令 | ✅ | `src/cli/ops/ops-router.ts` loop_status dispatch + `src/cli/commands/index.ts` 注册 |
| S5-E2 | `loop_status` 返回 `overallStatus=stalled` 并定位到正确 stage | ✅ | `src/observability/loop-status.ts` computeNextAction + `tests/unit/observability/loop-status.test.ts` 2/2 PASS |
| S5-E3 | Diagnostic redaction 归因到正确来源（storage/dream/perception/policy） | ✅ | `src/observability/diagnostic-redaction.ts` classifyDiagnosticAttribution + `tests/unit/observability/diagnostic-redaction.test.ts` 8/8 PASS |
| S5-E4 | Guidance proposal consumption 生成 source-backed GuidanceOutput | ✅ | `src/core/second-nature/guidance/guidance-proposal-consumer.ts` + `tests/unit/guidance/guidance-proposal-consumer.test.ts` 8/8 PASS |
| S5-E5 | 编译无错误 | ✅ | `pnpm typecheck` 0 errors |

---

## 2. S5 组件集成链

```
HeartbeatCycleTrace + LoopStageEvent (T-OBS.C.1, T-OBS.C.2)
  → assembleLoopStatus() → CausalLoopHealthSnapshot (stalledAt, overallStatus)
  → readLoopStatus() → LoopStatusReadModel (nextAction, stageSummaries)
  → ops-router dispatch "loop_status" → RuntimeOpsEnvelope

DiagnosticPayload (T-OBS.C.3)
  → classifyDiagnosticAttribution() → storage|dream|perception|policy
  → projectDiagnosticRedaction() → RedactedDiagnostic (redactionClass, attribution)

ActionProposal + ActionPolicyDecision (T-AC.C.1, T-AC.C.2)
  → consumeGuidanceProposal() → GuidanceOutput | DegradedOperationResult
  → source validation → unresolved source refs blocked
```

---

## 3. 测试汇总

| 测试文件 | 通过 | 失败 |
| --- | :---: | :---: |
| `tests/unit/observability/loop-status.test.ts` | 2 | 0 |
| `tests/unit/observability/diagnostic-redaction.test.ts` | 8 | 0 |
| `tests/unit/guidance/guidance-proposal-consumer.test.ts` | 8 | 0 |
| `tests/integration/v8/loop-status-integration.test.ts` | 2 | 0 |
| **S5 相关合计** | **20** | **0** |

---

## 4. 发现与备注

- **无阻塞问题**: S5 退出标准全部满足。
- **loop_status**: 当 state DB 不可用时返回 degraded envelope，operator next action 指向 "check state database connectivity"。
- **diagnostic redaction**: credential-shaped 值（Bearer token、secret=xxx）被 redacted 并标记 blocked；public technical 保留；private context 被 redacted。
- **guidance consumption**: deny/defer 决策返回 degraded 而非阻塞 heartbeat closure；source refs unresolved 返回可重试的 degraded。
- **下一步**: Wave 105 — INT-V8 (v8 全链 Living Perception Loop 集成验证) + T-REG.C.1 (回归门)。

---

**签名**: AUTO
**验证人**: /forge AUTO RUN MODE
