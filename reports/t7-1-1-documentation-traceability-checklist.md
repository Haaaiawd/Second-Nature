# T7.1.1 — Documentation traceability checklist

**Task**: `.anws/v5/05_TASKS.md` **T7.1.1**  
**Date**: 2026-05-03  
**Scope**: PRD user stories、ADR-007 质量门禁、`07_CHALLENGE_REPORT.md` blueprint 承接 → **任务或验证点**映射（以 `05_TASKS.md` 为执行真相源）。

## US-001 … US-008 → 任务覆盖

| US | 标题 (PRD) | 关键任务 / INT | 状态 |
|:--:|-------------|-----------------|:----:|
| US-001 | heartbeat_check 进入真实生活决策链 | T1.1.1→T1.1.3, T4.2.1, T2.1.1, T2.2.1, INT-S2 | ✅ |
| US-002 | life evidence 入库与查询 | T3.1.2, T4.1.1, T4.2.1, T5.1.2, T3.3.1, INT-S2 | ✅ |
| US-003 | rhythm windows 与生活节律 | T4.1.2, T2.1.2, T2.1.3, T2.2.1, INT-S2 | ✅ |
| US-004 | 朋友式主动联系闭合 | T4.2.2, T2.3.1, T6.1.1, T6.1.2, T6.2.1, T4.3.1, T2.3.2, T5.2.1, T1.3.1, INT-S3 | ✅ |
| US-005 | 用户兴趣与关系记忆读取 | T4.2.2, T6.1.2, T2.3.1, T6.2.1 | ✅ |
| US-006 | Quiet 对生活证据收纳 | T4.2.1, T4.4.1, T6.1.2, T2.3.3, T5.2.1, INT-S3 | ✅ |
| US-007 | OpenClaw 主动联系能力与兜底 | T1.1.2, T1.3.1, T2.3.2, T1.2.2, INT-S1, **INT-S4** | ⏳ 真实宿主在 INT-S4 |
| US-008 | README 与 v5 能力边界 | **T1.4.1**, T1.4.2, T7.1.1, INT-S4 | ✅ 文档本轮；宿主 ⏳ |

## ADR-007（Heartbeat delivery & life evidence）质量门禁

对照 `03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md` §质量门禁（六条）→ 任务 / 测试证据：

| ADR-007 门禁 | 任务承接 | 自动化验证（示例） | 状态 |
|---------------|----------|---------------------|:----:|
| Host capability probe | T1.1.2 | `tests/unit/cli/host-capability.test.ts`；`tests/integration/cli/host-capability-probe.test.ts`；INT-S1 | ✅ |
| Ack behavior test | T1.1.2；投递审计 T5.2.1 | `checkAckDropBehavior` 出现在 `tests/unit/cli/host-capability.test.ts` / `host-capability-probe.test.ts`；完整宿主 ack 语义 ⏳ INT-S4 | ✅（fixture）/ ⏳ |
| Target-none test | T2.3.1；T5.2.1 | `delivery-failed-fallback` / lived-experience audit 相关用例；INT-S3 | ✅ |
| Evidence-backed outreach test | T3.1.2, T6.1.2, T6.2.1, T2.3.1 | `outreach-draft-contract.test.ts`；INT-S3 | ✅ |
| Delivery fallback test | T2.3.2, T4.3.1, T1.2.2, T5.2.1 | `delivery-failed-fallback.test.ts`；`operator-fallback-view.test.ts`；INT-S3 | ✅ |
| Quiet empty-evidence test | T2.3.3, T4.4.1, T6.1.2 | `heartbeat-quiet-orchestration.test.ts`；`quiet-artifact-writer.test.ts`；INT-S3 | ✅ |
| **生产宿主矩阵**（delivery target / hook / 真 ack） | INT-S4；T1.3.1 仅 fixture | `host-smoke-heartbeat-tool.test.ts` ≠ 真会话 | ⏳ |

## Challenge (`07_CHALLENGE_REPORT.md`) Round 8 → 任务 / 设计承接

| ID | 主题 | 映射（`05_TASKS` / 设计） | Round 8 状态 |
|----|------|---------------------------|:-------------:|
| CH-08-01 | INT-S3 / Quiet writer 排期 | T4.4.1 纳入 INT-S3；见 challenge 表 | ✅ |
| CH-08-02 | P0 追溯 | T4.2.2, T6.1.2, US-004 overlay | ✅ |
| CH-08-03 | 旧控制层文件 | `control-plane-system.old.md` 标 Non-Contract | ✅ |
| CH-08-04 | readiness 元数据 | `00_MANIFEST.md`；`02_ARCHITECTURE_OVERVIEW.md` §9 | ✅ |
| CH-08-05 | source coverage 一致 | T4.4.1, T5.2.1, T6.1.2；detail 文档 | ✅ |
| CH-08-06 | side-effect 幂等 | T3.2.1, T4.1.1；connector detail | ✅ |
| CH-08-07 | SourceRef 统一 | control / guidance / cli detail | ✅ |
| CH-08-08 | delivery fallback 顺序 | T2.3.2；control-plane L0/L1 | ✅ |
| CH-08-09 | sent proof | T4.3.1, T5.2.1 | ✅ |

（全文与证据：`07_CHALLENGE_REPORT.md` Round 8 表。）

| 检查 | 状态 |
|------|:----:|
| README 与 v5 冲突时以 `.anws/v5` 为准 (US-008) | ✅ `README.md` / `README.zh-CN.md` 已声明 |

## 结论

- **文档契约**：`README*.md` 将 current truth 指向 **`.anws/v5`**，并区分 **current / target / validation-needed**。  
- **未完成项**：仅余 **真实宿主** 类验证（US-007 / INT-S4 / ADR-007 宿主矩阵），依赖操作环境，不由此 checklist 冒充完成。
