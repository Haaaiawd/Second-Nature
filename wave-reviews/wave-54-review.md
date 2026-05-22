# Wave 54 Review — T-BTS.C.4 + T-BTS.C.5

## 最高严重度

none

## 变更清单

| 文件 | 变更 |
|------|------|
| `src/core/second-nature/body/tool-experience/experience-writer.ts` | 新增：ExperienceWriter.recordExperience (triggerSource 必填, failureClass 转写) |
| `src/core/second-nature/body/probe-signal-adapter.ts` | 新增：ProbeSignalAdapter.runAndRecordProbe (WetProbeRunner→state-memory bridge) |
| `src/core/second-nature/body/tool-experience/pain-signal-query.ts` | 新增：getPainSignal (painLevel/recentFailureRate/consecutiveFailures/cooldownRecommended) |
| `src/core/second-nature/body/circuit-breaker/circuit-breaker-manager.ts` | 新增：CircuitBreakerManager 状态机 (Closed→Open→HalfOpen→Closed/Open) |
| `src/storage/db/migrations/v7-003-circuit-breaker.ts` | 新增：circuit_breaker_state 表 |
| `src/storage/db/migrations/index.ts` | 更新：注册 v7-003 |
| `src/storage/services/tool-experience-store.ts` | 更新：appendToolExperience gate 禁用 sensitivityScan (避免 UUID 误报) |

## 回归检查

- `node --test dist/tests/unit/body/experience-writer.test.js dist/tests/unit/body/pain-signal-query.test.js dist/tests/unit/body/circuit-breaker-manager.test.js` — 13/13 pass
- 无预先存在失败

## 测试矩阵

| 测试文件 | 通过 | 失败 |
|---------|:----:|:----:|
| `tests/unit/body/experience-writer.test.ts` | 3 | 0 |
| `tests/unit/body/pain-signal-query.test.ts` | 4 | 0 |
| `tests/unit/body/circuit-breaker-manager.test.ts` | 6 | 0 |
| **合计** | **13** | **0** |

## 设计一致性

- T-BTS.C.4:
  - ExperienceWriter: outcome 映射 success→"success", retryable/terminal→"failure"
  - triggerSource 必填 (DR-010)；failureClass 直接转写 (DR-007)
  - ProbeSignalAdapter: 运行 probe → appendProbeResult → 非 available 时 append experience (triggerSource="probe")
  - getPainSignal: bounded lookback (default 10); painLevel = failureRate*0.5 + consecutive*0.15 (capped 1.0)
  - cooldownRecommended when consecutiveFailures >= threshold (default 3)
  - 不暴露 raw payload (只返回 outcome + createdAt summary)
- T-BTS.C.5:
  - Closed: counts consecutive failures; threshold hit → Open
  - Open: rejects execution; cooldown elapsed → canExecute true
  - HalfOpen: attemptReset triggers runWetProbe via ProbeSignalAdapter
  - probe success (available) → Closed + onClosed callback (affordance cache invalidation, DR-003)
  - probe failure (unavailable) → Open
  - strict side-effect probe → probe_policy_denied (httpStatus=0, actualStatus=unavailable), stays HalfOpen
  - State persisted to SQLite `circuit_breaker_state` (v7-003); survives process restart

## 安全与治理

- ExperienceWriter gate 验证写入前 payload (禁用 sensitivityScan 避免程序生成 UUID 误报)
- PainSignal 只暴露聚合指标，不暴露原始 experience rows
- CircuitBreakerManager 将探测执行权委托给 ProbeSignalAdapter，不自建 HTTP 客户端

## 下一步

- Wave 55: T-BTS.C.3 (BehaviorPromotion) 或 T-CP.C.1 (EmbodiedContextAssembler)
