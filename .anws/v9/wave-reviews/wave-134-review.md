# Wave 134 Code Review — 2026-06-28

## 1. 总结结论

**Partial Pass** — 核心交付完整：v9 redaction projector（credential value detection + structure-preserving redaction + ledger_redaction_blocked + character safety validation）+ v9 loop health aggregator（13-stage attribution + activity/continuity/routine/evolution/character health + composite overall）。测试覆盖充分（39+5+32+11=87 新测试）。存在 1 个 Medium 契约漂移（§3.3 pseudocode 使用 `"healthy"` 而 `StageEventStatus` 类型只有 `"ok"`）与若干 Low 残留。无 Critical/High 阻塞。

## 2. 审查范围与静态边界

**已读**：
- `src/observability/v9-redaction-projector.ts`（全文）
- `src/observability/v9-loop-health-aggregator.ts`（全文）
- `src/observability/redaction/policy.ts`（v8 redaction policy 依赖）
- `src/shared/types/v9-contracts.ts`（LoopHealth/ContinuityHealth/RoutineHealth/ConnectorEvolutionHealth/StageEventStatus/LoopStageKind/CharacterFrameEventKind/SourceRefFamily）
- `tests/unit/observability/v9-redaction-projector.test.ts`（全文）
- `tests/integration/v9/ledger-redaction-block.test.ts`（全文）
- `tests/unit/observability/v9-loop-health.test.ts`（全文）
- `tests/api/runtime-ops/v9-loop-status.test.ts`（全文）
- `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §1.8 §3.2-§3.6 §4.1 §4.2 §5.3 §5.6`
- `.anws/v9/05A_TASKS.md` T8.1.2 + T8.2.2 任务定义

**未读**（故意收缩）：
- 未读 §3.7-§3.9（rollback watchdog / digest / timeline — 属于 T8.2.2/T8.2.3 范围）
- 未读 ADR-006 全文（仅读 character-continuity-system.detail.md 中的 ADR-006 实现引用）

**需人工验证**：无。本波全部为静态可验证的纯函数逻辑，无运行时/网络/浏览器依赖。

## 3. 契约 → 代码映射摘要

| 承诺 | 实现区域 |
|---|---|
| ledger redaction projector extensions | `v9-redaction-projector.ts` redactLedgerEntry |
| `ledger_redaction_blocked` handling | `v9-redaction-projector.ts` redactLedgerEntry → blocked + reasonCode |
| timeline payload redaction | `v9-redaction-projector.ts` redactTimelinePayload |
| character events redaction | `v9-redaction-projector.ts` redactCharacterFrameEvent |
| LoopHealthAggregator | `v9-loop-health-aggregator.ts` aggregateLoopHealth |
| ActivityThreadHealthMonitor | `v9-loop-health-aggregator.ts` aggregateActivityThreadHealth |
| ContinuityHealthMonitor | `v9-loop-health-aggregator.ts` aggregateContinuityHealth |
| RoutineHealthMonitor | `v9-loop-health-aggregator.ts` aggregateRoutineHealth |
| ConnectorEvolutionHealthMonitor | `v9-loop-health-aggregator.ts` aggregateConnectorEvolutionHealth |
| CharacterFrame observability events | `v9-loop-health-aggregator.ts` aggregateCharacterFrameHealth |
| character/health output no emotion/personality/identity-lock/hard-control | `v9-redaction-projector.ts` validateCharacterSafety + `v9-loop-health-aggregator.ts` aggregateCharacterFrameHealth safe summary |

## 4. Lens 结果摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 契约忠实度 | Partial Pass — §3.3 pseudocode 使用 `"healthy"` 而 `StageEventStatus` 类型只有 `"ok"`，实现适配为 `"ok"` | `observability-recovery-system.detail.md:474` vs `v9-contracts.ts:985` vs `v9-loop-health-aggregator.ts:188` |
| L2 任务兑现 | Pass — 输出/验收/边界全承接 | `05A_TASKS.md:547-564` T8.1.2 输出 2 项全交付；`05A_TASKS.md:568-585` T8.2.1 输出 6 项全交付 |
| L3 架构适配 | Pass — 纯函数模块、依赖方向正确 | aggregator → v9-contracts 单向；redaction → v8 policy 单向 |
| L4 静态运行风险 | Pass — credential detection pattern-based（非 cryptographic），depth limit 10 防栈溢出 | `v9-redaction-projector.ts:105` depth limit |
| L5 验证证据 | Pass — 覆盖充分 | 39 redaction unit + 5 ledger integration + 32 loop health unit + 11 loop status API |
| L6 回流一致性 | Partial Pass — task checkbox 已勾选，1 个文档矛盾未回流 | `05A_TASKS.md:547,568` ✅；§3.3 pseudocode `"healthy"` vs `StageEventStatus` 类型不一致 |

## 5. Issues

### Medium

**M-1 | L1+L6 | §3.3 pseudocode 使用 `"healthy"` 而 `StageEventStatus` 类型只有 `"ok"`（Contract Drift）**
- **Evidence**: `observability-recovery-system.detail.md:474`（`attribution[event.stageKind] = 'healthy'`）vs `v9-contracts.ts:985`（`StageEventStatus = "ok" | "degraded" | "blocked" | "skipped" | "empty"`）vs `v9-loop-health-aggregator.ts:188`（实现使用 `"ok"` 适配类型）
- **Impact**: 文档 pseudocode 与权威契约不一致。实现层已按 `StageEventStatus` 契约适配，不阻塞功能。
- **Minimum fix**: 走 `/change` 修正 §3.3 pseudocode，将 `attribution[event.stageKind] = 'healthy'` 替换为 `attribution[event.stageKind] = 'ok'`。
- **Anchor**: `observability-recovery-system.detail.md §3.3:474`、`shared-v9-contracts.md §7a`

### Low

**L-1 | L4 | `containsCredentialValue` 为 pattern-based 检测，非 cryptographic（Complexity Risk — 已声明）**
- **Evidence**: `v9-redaction-projector.ts:62-73`（CREDENTIAL_VALUE_PATTERNS：JWT/AWS key/长 hex/长 base64 正则匹配）
- **Impact**: 高熵但非 credential 的字符串（如长 hash 值）可能被误判为 credential。这是可接受风险——ledger payload 不应包含长 hex/base64 字符串，除非是 credential。
- **Minimum fix**: 无需本波修复。如果未来出现误判，可引入 entropy-based 检测替换 pattern-based。
- **Anchor**: `v9-redaction-projector.ts:62`

**L-2 | L3 | `aggregateLoopHealth` 使用 `Record<string, StageEventStatus>` 而非 `Record<LoopStageKind, StageEventStatus>`（Type Safety — 已适配）**
- **Evidence**: `v9-loop-health-aggregator.ts:155`（`const attribution: Record<string, StageEventStatus> = {}`）vs `v9-contracts.ts:1162`（`stageAttribution: Record<LoopStageKind, StageEventStatus>`）
- **Impact**: 内部使用 `Record<string, ...>` 是因为 `event.stageKind` 是 `string` 而非 `LoopStageKind`（输入类型为 `StageEventInput`）。返回时通过 `as Record<LoopStageKind, StageEventStatus>` 强制转换。这是可接受的——所有 13 个 stage kind 都在初始化时填充。
- **Minimum fix**: 无需本波修复。如果未来 `StageEventInput.stageKind` 收紧为 `LoopStageKind`，可移除类型断言。
- **Anchor**: `v9-loop-health-aggregator.ts:155,236`

**L-3 | L1 | `aggregateCharacterFrameHealth` summary 为英文，未提供中文版本（i18n — 已声明）**
- **Evidence**: `v9-loop-health-aggregator.ts:432-436`（`"Character frame events: ${events.length} total, ..."`）
- **Impact**: ADR-006 要求中英双语安全，但 summary 是 observational text（非 character assertion），英文是可接受的。如果未来需要中文 summary，可添加 i18n 层。
- **Minimum fix**: 无需本波修复。summary 通过 `validateCharacterSafety` 验证，不含 forbidden patterns。
- **Anchor**: `v9-loop-health-aggregator.ts:432`

## 6. 安全 / 测试覆盖补充

**安全**：
- 无密钥/PII 泄露风险：redaction projector 是纯函数，不接触 DB/文件系统。
- `containsCredentialValue` 检测 credential-shaped values（JWT/AWS key/长 hex/长 base64），命中时 block 写入。
- `validateCharacterSafety` 检测 ADR-006 forbidden patterns（中英双语 emotion/personality/identity-lock/hard-control），确保 character summary 安全。
- `aggregateCharacterFrameHealth` summary 通过 `validateCharacterSafety` 验证（API 测试验证）。

**测试覆盖**：
- redaction projector: sufficient（credential detection + redaction + block + character safety）
- loop health aggregator: sufficient（13-stage attribution + activity/continuity/routine/evolution/character health + composite overall）
- API loop status: sufficient（JSON-serializable shape + 13 stage kinds + blocked classification + unique reasons）

**无法静态确认**：无。本波全部为静态可验证的纯函数逻辑。

## 7. review-fix 决定

- **M-1**: 不在本波修复（需走 `/change` 修正 §3.3 pseudocode `"healthy"` → `"ok"`）。实现层已按 `StageEventStatus` 契约适配，不阻塞功能。
- **L-1**: 无需修复（pattern-based credential detection 在当前 payload 结构下可接受）。
- **L-2**: 无需修复（`Record<string, ...>` 内部使用 + 类型断言返回是可接受的）。
- **L-3**: 无需修复（英文 observational summary 通过 safety validation）。

**Final verdict**: **Partial Pass** — 核心交付完整、测试充分、无 Critical/High 阻塞。M-1 文档矛盾已由实现层适配，建议下一波前走 `/change` 修正 §3.3 pseudocode。
