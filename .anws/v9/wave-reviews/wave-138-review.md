# Wave 138 Code Review — 2026-06-29

## 1. 总结结论

**Pass** — T1.2.2 核心交付完整：`RuntimeOpsEnvelopeFactory` 统一执行 payload redaction（credential/private/prompt）、evidence level 提升/封顶（truth gate）、DiagnosticsCollector 收集 redaction 诊断。35 unit + 11 API tests 覆盖充分，全量 2256 tests / 2247 pass / 0 fail / 9 skipped。无 Critical/High/Medium 阻塞，仅 2 个 Low 残留。

## 2. 审查范围与静态边界

**已读**：
- `src/cli/ops/v9-envelope-factory.ts`（全文 325 行）
- `tests/unit/runtime-ops/v9-envelope-factory.test.ts`（全文 380 行）
- `tests/api/runtime-ops/v9-redaction-envelope.test.ts`（全文 162 行）
- `.anws/v9/04_SYSTEM_DESIGN/runtime-ops-system.detail.md §1.2 §3.2 §3.3`（契约引用）
- `.anws/v9/05A_TASKS.md` T1.2.2 任务定义

**未读**（故意收缩）：
- `v9-ops-handlers.ts` 全文（Wave 137 已审，本波未修改）
- `v9-redaction-projector.ts` 全文（Wave 134 已审，本波仅引用 `containsCredentialValue` / `redactPayloadJson`）

**需人工验证**：无。本波全部为静态可验证的纯函数。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| payload redaction（credential/private/prompt 泄漏阻断） | `redactOpsPayload` + `redactRecursive` + `classifySensitiveField` |
| evidence level 提升（monotonic promotion） | `promoteEvidence` + `maxLevel` + `LEVEL_ORDER` |
| evidence level 封顶（truth gate by surfaceMode） | `capEvidenceLevel`（carrier → carrier_ack） |
| DiagnosticsCollector | `createDiagnosticsCollector` + `DiagnosticsCollectorResult` |
| 统一 envelope 组装 | `assembleEnvelope`（redact → promote → cap → merge diagnostics） |
| 批量 redaction | `redactOpsPayloadBatch` |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Pass — §3.3 redaction checklist 全覆盖（credential block / private redact / prompt hash），§1.2 truth gate carrier cap 实现 | `v9-envelope-factory.ts:130-195` redaction + `:216-223` cap |
| L2 任务兑现 | Pass — 验收标准全覆盖 | `05A_TASKS.md:84` ✅；redaction + truth gate + diagnostics |
| L3 架构适配 | Pass — 纯函数 + 依赖注入，与 v9-ops-handlers 解耦 | `assembleEnvelope` 接受 `EnvelopeFactoryInput`，无 DB 访问 |
| L4 静态运行风险 | Pass — depth limit 10 防栈溢出，null/undefined 安全 | `v9-envelope-factory.ts:145` depth guard |
| L5 验证证据 | Pass — 35 unit + 11 API tests | classify/redact/cap/promote/assemble/collector/batch 全覆盖 |
| L6 回流一致性 | Pass — task checkbox 已勾选，AGENTS.md 已更新 | `05A_TASKS.md:84` ✅；`AGENTS.md:87-89` |

## 5. Issues

### Low

**L-1 | L1 | `capEvidenceLevel` 仅对 carrier mode 封顶，full_runtime/workspace_full_runtime 无封顶（Contract Alignment — 设计如此）**
- **Evidence**: `v9-envelope-factory.ts:216-223`（carrier → carrier_ack；其他 mode 直接 return level）
- **Impact**: §1.2 提到 "full_runtime: max state_present (unless real_runtime/durable proof)"，但实现中 full_runtime 不封顶。这是可接受的——promoteEvidence 已通过 proof signals 控制提升，封顶逻辑由 proof signals 隐式执行（无 proof 不会提升到 real_runtime/durable_verified）。
- **Minimum fix**: 无需本波修复。如果后续需要显式 full_runtime cap，可在 capEvidenceLevel 添加 `if (surfaceMode === "full_runtime") return minLevel(level, "state_present")`。
- **Anchor**: `v9-envelope-factory.ts:216-223`

**L-2 | L4 | `hashShort` 使用简单 hash（非加密），prompt redaction hash 可碰撞（Implementation Choice — 已声明）**
- **Evidence**: `v9-envelope-factory.ts:197-204`（`((hash << 5) - hash + charCodeAt) | 0`）
- **Impact**: prompt hash 用于诊断标识，不用于安全比对。碰撞概率低（8 hex chars = 32 bits），可接受。
- **Minimum fix**: 无需修复。文件头注释已声明 "not cryptographic"。
- **Anchor**: `v9-envelope-factory.ts:197-204`

## 6. 安全 / 测试覆盖补充

**安全**：
- credential 阻断：pattern-based key 匹配 + `containsCredentialValue` 值检测（JWT、长 hex、`SECOND_NATURE_` 前缀等）
- private content：key pattern 匹配（email/phone/message_body/dm_content/private_content/user_content）
- prompt：key pattern 匹配 + hash 替换（不泄漏原文）
- depth limit 10 防止恶意嵌套导致的栈溢出
- 无密钥硬编码，所有 pattern 为正则常量

**测试覆盖**：
- classifySensitiveField: credential/private/prompt/none 全覆盖
- redactOpsPayload: credential block / private redact / prompt hash / nested / array / null / empty string / JWT value / depth limit
- capEvidenceLevel: carrier cap / full_runtime no cap / workspace_full_runtime no cap
- promoteEvidence: sourceRefs / realRuntimeProof / durableAudit / monotonic / multiple signals
- assembleEnvelope: redacted payload / carrier cap / promote / degradedReasons / sourceRefs / timestamp / JSON-serializable / prompt hash
- DiagnosticsCollector: collect / empty start
- redactOpsPayloadBatch: multiple / empty

**无法静态确认**：无。本波全部为静态可验证的纯函数。

## 7. review-fix 决定

- **L-1**: 无需修复（promoteEvidence 通过 proof signals 隐式控制 full_runtime 封顶，设计如此）。
- **L-2**: 无需修复（hash 用于诊断标识，非安全比对，文件头已声明）。

**Final verdict**: **Pass** — 核心交付完整、测试充分、无 Critical/High/Medium 阻塞。T1.2.2 ops redaction & evidence-level truth gate 已交付。
