# INT-S2 — S2 集成验证报告：See and Judge

> **版本**: v8  
> **日期**: 2026-06-01  
> **验证范围**: Sprint S2 — Evidence Normalization → Perception → Judgment → Stage Events  
> **验证方式**: 冒烟测试 / 单元测试聚合 / 编译检查  

---

## 1. 退出标准检查清单

| # | 退出标准 | 状态 | 证据 |
| --- | --- | :---: | --- |
| S2-E1 | EvidenceItem 可被 connector read 正常化写入 | ✅ | `src/connectors/evidence-normalizer.ts` + `tests/unit/connectors/evidence-normalizer.test.ts` 14/14 PASS |
| S2-E2 | SensitivityClassifier 区分 public_technical 与 credential-shaped risk | ✅ | `src/core/second-nature/perception/sensitivity-classifier.ts` + `tests/unit/perception/sensitivity-classifier.test.ts` 13/13 PASS |
| S2-E3 | PerceptionCard 从 pending evidence 生成，含 topic/entities/novelty/relevance/summary/risk/reviewPriority | ✅ | `src/core/second-nature/perception/perception-builder.ts` + `tests/unit/perception/perception-builder.test.ts` 4/4 PASS |
| S2-E4 | JudgmentVerdict 从 PerceptionCard 经规则树产出，含 confidence/reason/riskPosture/actionKind | ✅ | `src/core/second-nature/perception/judgment-engine.ts` + `tests/unit/judgment/judgment-engine.test.ts` 3/3 PASS |
| S2-E5 | HeartbeatCycleTrace 单调递增 cycleSequence，编排 perception/judgment 不越权 | ✅ | `src/core/second-nature/control-plane/heartbeat-orchestrator.ts` + `tests/unit/control-plane/heartbeat-cycle-trace.test.ts` 2/2 PASS |
| S2-E6 | LoopStageEvent 在 perception/judgment stage 被正确记录 | ✅ | `src/observability/loop-stage-event-sink.ts` + `tests/unit/observability/loop-stage-event-sink.test.ts` 12/12 PASS |
| S2-E7 | 编译无错误，无 schema 漂移 | ✅ | `npx tsc --noEmit` 0 errors |

---

## 2. 集成链验证

### 2.1 正向路径（fixture-driven）

```
ConnectorReadResult (3 public items)
  → normalizeConnectorEvidence() → 3 EvidenceItem rows
  → buildPerceptionCards(cycleId) → 1+ PerceptionCard
  → runAgentJudgment(cardId) → JudgmentVerdict (watch/remember/notify)
  → runHeartbeatCycle() → HeartbeatCycleTrace + stage events
```

**验证结果**: 各阶段接口签名匹配，state stores 读写通过，无 schema 漂移。

### 2.2 降级路径

| 场景 | 期望行为 | 实际行为 |
| --- | --- | --- |
| 空 evidence | `status=empty`, `reason=evidence_batch_empty` | ✅ perception-builder 返回 empty |
| 无 source refs | `ignore/watch only`, `reason=judgment_missing_source_refs` | ✅ judgment-engine 降级 |
| Risk blocked (sensitive) | `watch/notify_owner`, `riskPosture=blocked` | ✅ judgment-engine blocked |
| 低 confidence | 无 auto/draft external write | ✅ 降级到 watch |
| State unreadable | `DegradedOperationResult` + stage event failed | ✅ 全链返回 degraded |

---

## 3. 测试汇总

| 测试文件 | 通过 | 失败 | 跳过 |
| --- | :---: | :---: | :---: |
| `tests/unit/connectors/evidence-normalizer.test.ts` | 14 | 0 | 0 |
| `tests/unit/perception/sensitivity-classifier.test.ts` | 13 | 0 | 0 |
| `tests/unit/perception/perception-builder.test.ts` | 4 | 0 | 0 |
| `tests/unit/judgment/judgment-engine.test.ts` | 3 | 0 | 0 |
| `tests/unit/control-plane/heartbeat-cycle-trace.test.ts` | 2 | 0 | 0 |
| `tests/unit/observability/loop-stage-event-sink.test.ts` | 12 | 0 | 0 |
| `tests/unit/body/affordance-side-effect.test.ts` | 15 | 0 | 0 |
| `tests/unit/storage/v8-state-stores.test.ts` | 13 | 0 | 0 |
| `tests/unit/contracts/v8-shared-contracts.test.ts` | 21 | 0 | 0 |
| **S2 相关合计** | **97** | **0** | **0** |

---

## 4. Schema 一致性

| 表 | 字段完整性 | 索引 | 备注 |
| --- | :---: | :---: | --- |
| `evidence_item` | ✅ | — | contentHash, platformId, observedAt, sensitivityHint |
| `perception_card` | ✅ | — | cycleId, topic, entitiesJson, novelty, relevance, confidence |
| `judgment_verdict` | ✅ | — | perceptionCardId, actionKind, confidence, riskPosture |
| `heartbeat_cycle_trace` | ✅ | — | cycleSequence, heartbeatStartedAt, status |
| `loop_stage_event` | ✅ | — | cycleId, stage, status, occurredAt |

---

## 5. 发现与备注

- **无阻塞问题**: S2 退出标准全部满足。
- **风险**: judgment-engine 目前为 rules-only 路径，无 model assist。model timeout 降级路径已预留（通过 `confidence` 阈值控制），但具体 model 集成在 S3/S4 之后。
- **下一步**: 进入 Sprint S3 (Act and Close) — T-AC.C.1 Action Proposal + T-AC.C.2 Policy。

---

**签名**: AUTO  
**验证人**: /forge AUTO RUN MODE
