# INT-S3 / T5.2.2 — Static code review (challenge evidence)

**Mode**: 纯静态审查（子代理），对照 `05_TASKS.md` INT-S3、T5.2.2 与 `observability-system.detail.md` §3.11。  
**Date**: 2026-05-02

## 结论摘要

首轮审查：**Pass with issues**（无 Critical）。已在主会话中修复可收敛项（见下「已修复」）。

## 已修复（实现侧）

| 原严重度 | 问题 | 处理 |
|----------|------|------|
| High | `verifyAuditHashChain` 对「切片首条且带 `previousHash`」误报 broken（父行在 range 外时合法） | 删除仅针对首行的 `previousHash !== undefined` 判定；切片内只校验相邻行链接与 `recordHash` 重算；头注释说明部分 range 行为 |
| Medium | `dropped_by_host_policy` 集成未断言 `DeliveryAttemptRecord` | `int-s3-outreach-delivery-quiet-closure.test.ts` 增加 `listDeliveryAttemptsByDecisionId` → `dropped_by_host_policy` |
| Low | 集成未断言 `reasons` 含 `hash_chain_valid` | 两处 `verifyAuditHashChain` 结果增加 `assert.deepEqual(vr.reasons, ["hash_chain_valid"])` |

## 保留说明（文档/契约 delta，未改代码）

- **空 range**：实现为 `incomplete` + `range_empty`，与 T5.2.2 验证说明一致；L1 §3.11 伪代码对零条循环的 `pass` 语义不同——以任务验收为准。
- **`schemaVersion` 未纳入 hash**：与 `buildAuditEnvelope` 一致；若未来要防篡改需 ADR/设计变更。

## T5.2.2 验收对照（静态）

| 项 | 状态 |
|----|------|
| chain 完整 → pass | 满足 |
| recordHash 篡改 → broken | 满足 |
| previousHash 断链（切片内）→ broken | 满足 |
| 空 / 非法 range → incomplete | 满足 |
