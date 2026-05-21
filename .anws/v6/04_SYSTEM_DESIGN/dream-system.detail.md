# Dream System — 实现细节 (L1)

> **文件性质**: L1 实现层  
> **对应 L0**: [dream-system.md](./dream-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。日常设计与任务规划优先读取 L0。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v1.0 | 2026-05-15 | 初始实现层补充；R5 行数触发 |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §10 / §12 |
| §2 | [完整数据结构补充](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §11 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

| Key | Default | Owner | Notes |
| --- | --- | --- | --- |
| `dream.operatorTimeoutMs` | `1800000` | dream-system | 完整 LLM Dream 默认 30min operator timeout |
| `dream.rulesStageTargetMs` | `300000` | dream-system | 规则/采样阶段目标，不是 LLM 硬 SLA |
| `dream.maxEvidenceBeforeSampling` | `1000` | dream-system | 超过后采样最近 7 天 + key events |
| `dream.llmMonthlyBudgetUsd` | `20` | state-system config | 不硬编码供应商或密钥 |
| `dream.llmPerRunTargetUsd` | `0.5` | dream-system | 作为 budget gate 目标 |
| `dream.partialRetentionDays` | `14` | state-system | partial output 清理窗口 |

---

## §2 核心数据结构完整定义 (Full Data Structures)

L0 §6 已声明公共字段。实现时可在 `src/dream/types.ts` 中拆分为 `DreamRun`, `DreamInputBundle`, `DreamOutput`, `DreamTrace`，但不得把 `state-system` 的持久化表结构复制进 Dream 模块。

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 `runDream(input)`

**对应契约**: L0 §5.1 — `runDream(input)`  
**准入理由**: 多步骤副作用链，顺序不可颠倒。

```text
acquire DreamRunLock from state port
if lock unavailable:
  record skipped_or_queued trace
  return skipped_or_queued
load inputs from state ports
if inputs empty:
  record skipped trace
  return skipped
run rules consolidation
if input size exceeds threshold:
  sample recent window and key events
run redaction gate
if budget and redaction allow:
  call DreamModelPort
else:
  mark rules_only fallback
merge rules and model output
validate schema, source refs, sensitivity
write candidate or archived output through state port
record DreamTrace
release DreamRunLock
return run result
```

Implementations must release the lock in a `finally`-equivalent path after trace write. If process death prevents release, `state-system` lease TTL owns recovery.

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Output Acceptance

Accepted output requires all conditions:

1. Schema validation passes.
2. Every claim has source refs or is rejected.
3. Sensitivity check passes.
4. Candidate is written by state lifecycle port.
5. No active memory pointer is changed by Dream directly.

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| LLM returns unsupported claim | Narrative pollution | Reject claim or archive candidate |
| Redaction fails | Sensitive data leakage | Skip LLM stage or archive output |
| Timeout after rules output | Lost useful partial | Write `partial` with stage marker |
| Empty evidence | Fictional memory | Return `skipped` or empty candidate with honest reason |
| Candidate exists during heartbeat | Unvalidated memory use | Control-plane reads accepted projections only |
| Concurrent Dream triggers | Duplicate candidate outputs | `DreamRunLock` serializes same workspace/input window |

---

## §6 测试辅助 (Test Helpers)

Recommended fixtures:

- `makeDreamInputBundle({ evidenceCount, chronicleCount })`
- `makeAcceptedMemoryStore()`
- `makeCandidateDreamOutput({ unsupportedClaim })`
- `makeBudgetPort({ remainingUsd })`
- `makeDreamModelPort({ mode: "success" | "timeout" | "unavailable" })`
