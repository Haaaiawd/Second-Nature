# INT-S3 — Outreach / Delivery / Quiet Closure

**Milestone**: `.anws/v5/05_TASKS.md` INT-S3  
**Date**: 2026-05-02  
**验证策略**: 集成测试 + 单测；fake delivery、`:memory:` state；无 OpenClaw E2E。

## Hash-chain (T5.2.2)

**状态**: 已实现 `verifyAuditHashChain(range, deps)`（`src/observability/audit/verify-audit-hash-chain.ts`），含 `computeAuditRecordHash`、`createAppendOnlyAuditStoreRangeLoader`；非 `blocked_by:T5.2.2`。

**命令**: `pnpm test`（含 `tests/unit/observability/verify-audit-hash-chain.test.ts`）。

---

## Given / When / Then 与证据

| # | Given | When | Then | 证据（测试名 / 命令） |
|---|--------|------|------|------------------------|
| 1 | Source-backed candidate、`OutreachDraftRequest` 可构建 | 走 `judgeOutreach` → `buildOutreachDraftRequest` → `draftOutreachMessage` | `ready` + `deliveryWording === "sendable"`；文案不冒充已投递用户 | `INT-S3: source-backed draft (T6.2.1) → delivery failed → …` — `tests/integration/control-plane/int-s3-outreach-delivery-quiet-closure.test.ts` |
| 2 | `sendDeliveryRequest` 返回 `failed` | `dispatchUserOutreachIntent` | `delivery_unavailable`；`DeliveryAttemptRecord` 为 `failed`；`operator_fallback_artifacts.status === not_sent`；fallback 文案不冒充 sent | 同上 + `pnpm test` → `tests/integration/control-plane/delivery-failed-fallback.test.ts`（T2.3.2） |
| 3 | `sendDeliveryRequest` 返回 `dropped_by_host_policy` | 同上 | `delivery_unavailable`；attempt 为 `dropped_by_host_policy`；fallback `not_sent` | `INT-S3: dropped_by_host_policy → …`；`delivery-failed-fallback.test.ts` |
| 4 | 决策后写入 `LivedExperienceAuditRecorder`（decision + delivery audit） | `verifyAuditHashChain` 覆盖时间窗 | `status === "pass"` 且 `reasons` 为 `["hash_chain_valid"]` | INT-S3 集成用例内嵌断言；单测 `T5.2.2 verifyAuditHashChain — pass on valid chain` 等 — `verify-audit-hash-chain.test.ts` |
| 5 | delivery audit `failed` / explain index | `explainLinkageForDecision` | `warnings` 含 `no_user_visible_contact_claim_prohibited`；不将未投递呈现为已联系用户 | INT-S3 集成用例；`tests/unit/observability/lived-experience-audit.test.ts`（T5.2.1） |
| 6 | Quiet + `quietEnabledBridge`、空证据路径 | `ingestRhythmSignal` | `intent_selected` + quiet 原因；workspace 下写入 `.json` artifact | `INT-S3 Quiet regression: …`；`tests/integration/control-plane/heartbeat-quiet-orchestration.test.ts`（T2.3.3） |
| 7 | S2 节律心跳（轻量回归） | active + obligations | `intent_selected` | `INT-S3 S2 touch: …`；完整 S2 脊柱见 `tests/integration/control-plane/heartbeat-spine-integration.test.ts` |
| 8 | `OutreachDraftRequest` 契约（allow/deny/target_none） | 单测 | 与 T6.2.1 一致 | `tests/integration/guidance/outreach-draft-contract.test.ts` |

---

## 命令汇总

```bash
pnpm exec tsc --noEmit
pnpm test
```

（发布面变更时）`pnpm build:plugin` 已包含在 `pnpm test` 中，并同步 `plugin/runtime/`。

---

## 已知边界

- `verifyAuditHashChain` 依赖调用方提供 `loadRange`；`AppendOnlyAuditStore` 适配器按 `createdAt` 与可选 `families` 过滤，不替代持久化 DB 的 range 查询（T5.3.1 范围）。
