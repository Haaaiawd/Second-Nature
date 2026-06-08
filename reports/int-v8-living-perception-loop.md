# INT-V8 — v8 Living Perception Loop 全链集成验证报告

> **版本**: v8
> **日期**: 2026-06-01
> **验证范围**: 完整链路 — Connector Read → Evidence → Perception → Judgment → Action Proposal → Policy → Closure → Quiet Review → Dream Consolidation → Memory Projection → Next EmbodiedContext
> **验证方式**: 集成测试 / 单元测试聚合 / 编译检查 / 冒烟测试

---

## 1. 退出标准检查清单

| # | 退出标准 | 状态 | 证据 |
| --- | --- | :---: | --- |
| V8-E1 | Evidence 能被收集并持久化 | ✅ | T-CS.C.1 + T-SMS.C.1 + INT-S2 |
| V8-E2 | Evidence 进入 PerceptionCard | ✅ | T-PJ.C.2 + INT-S2 |
| V8-E3 | Perception 进入 JudgmentVerdict | ✅ | T-PJ.C.3 + INT-S2 |
| V8-E4 | Judgment 进入 ActionProposal + Policy Decision | ✅ | T-AC.C.1 + T-AC.C.2 + INT-S3 |
| V8-E5 | Policy 进入 Closure Record | ✅ | T-AC.C.3 + T-AC.C.4 + INT-S3 |
| V8-E6 | Closure 进入 Quiet Daily Review | ✅ | T-DQ.C.1 + INT-S4 |
| V8-E7 | Quiet 触发 Dream Consolidation | ✅ | T-DQ.C.2 + T-DQ.C.3 + INT-S4 |
| V8-E8 | Dream 产生 Accepted Projection | ✅ | T-DQ.C.4 + T-CP.C.2 + INT-S4 |
| V8-E9 | Projection 加载到 EmbodiedContext | ✅ | T-CP.C.2 + INT-S4 |
| V8-E10 | `loop_status` 解释 stalled stage | ✅ | T-ROS.C.1 + INT-S5 |
| V8-E11 | 编译无错误 | ✅ | `pnpm typecheck` 0 errors |
| V8-E12 | 每阶段有输出或明确的 blocked reason | ✅ | 全链各阶段均有 closure 或 reason code |

---

## 2. 全链数据流验证

```
Connector Read (T-CS.C.1)
  → EvidenceItem (T-SMS.C.1)
  → PerceptionCard (T-PJ.C.2)
  → JudgmentVerdict (T-PJ.C.3)
  → ActionProposal (T-AC.C.1)
  → ActionPolicyDecision (T-AC.C.2)
  → ActionClosureRecord (T-AC.C.4)
  → QuietDailyReview (T-DQ.C.1)
  → DreamConsolidationRun (T-DQ.C.2)
  → MemoryProjection candidate (T-DQ.C.3)
  → Accepted Projection (T-DQ.C.4)
  → EmbodiedContext loader (T-CP.C.2)
  → Next Heartbeat Cycle
```

---

## 3. 降级与阻断路径验证

| 场景 | 期望行为 | 状态 |
| --- | --- | :---: |
| Evidence empty | `evidence_batch_empty` reason, no perception | ✅ |
| Perception redaction blocked | `perception_blocked_redaction`, stalledAt=perception | ✅ |
| Judgment low confidence | `judgment_low_confidence`, action=ignore/watch | ✅ |
| Policy denied high risk | `policy_denied_high_risk`, closure_denied | ✅ |
| Guidance unavailable | `closure_downgraded_without_draft` | ✅ |
| Quiet empty input | `quiet_empty_input` | ✅ |
| Dream scheduler unavailable | `dream_scheduler_unavailable` | ✅ |
| State unreadable | `overallStatus=degraded`, ownerStage attribution | ✅ |

---

## 4. 测试汇总

| Sprint | 测试文件 | 通过 | 失败 |
| --- | --- | :---: | :---: |
| S1 | `tests/unit/contracts/v8-shared-contracts.test.ts` | ✅ | 0 |
| S1 | `tests/unit/storage/v8-state-stores.test.ts` | ✅ | 0 |
| S2 | `tests/unit/connectors/evidence-normalizer.test.ts` | ✅ | 0 |
| S2 | `tests/unit/perception/sensitivity-classifier.test.ts` | ✅ | 0 |
| S2 | `tests/unit/perception/perception-builder.test.ts` | ✅ | 0 |
| S2 | `tests/unit/judgment/judgment-engine.test.ts` | ✅ | 0 |
| S3 | `tests/unit/action/action-proposal-builder.test.ts` | ✅ | 0 |
| S3 | `tests/unit/action/autonomy-policy-evaluator.test.ts` | ✅ | 0 |
| S3 | `tests/unit/action/policy-bound-dispatch.test.ts` | ✅ | 0 |
| S3 | `tests/unit/action/action-closure-recorder.test.ts` | ✅ | 0 |
| S4 | `tests/unit/quiet/quiet-daily-review-builder.test.ts` | ✅ | 0 |
| S4 | `tests/unit/dream/dream-scheduler-lifecycle.test.ts` | ✅ | 0 |
| S4 | `tests/unit/dream/dream-consolidation-runner.test.ts` | ✅ | 0 |
| S4 | `tests/unit/dream/memory-projection-lifecycle.test.ts` | ✅ | 0 |
| S5 | `tests/unit/observability/loop-status.test.ts` | 2 | 0 |
| S5 | `tests/unit/observability/diagnostic-redaction.test.ts` | 8 | 0 |
| S5 | `tests/unit/guidance/guidance-proposal-consumer.test.ts` | 8 | 0 |
| S5 | `tests/integration/v8/loop-status-integration.test.ts` | 2 | 0 |
| **V8 全链** | `tests/integration/v8/living-perception-loop.test.ts` | **8** | **0** |
| **全链合计** | | **全绿** | **0** |

---

## 5. 发现与备注

- **无阻塞问题**: v8 全链退出标准全部满足。
- **全链闭环**: 从 connector read 到 accepted memory projection 的数据流已贯通，每阶段均有明确的 closure 或 blocked reason。
- **可观测性**: `loop_status` 可定位 stalled stage，diagnostic redaction 可正确归因到 storage/dream/perception/policy。
- **降级路径**: guidance unavailable、model timeout、state unreadable 等降级路径均已实现，不阻塞 heartbeat closure。
- **下一步**: Wave 106 — T-REG.C.1 (v8 回归门)。

---

**签名**: AUTO
**验证人**: /forge AUTO RUN MODE
