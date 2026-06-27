# Wave 128 Code Review — 2026-06-27 (Re-review)

## 1. 总结结论

**Pass**。

所有上一轮 Partial Pass 中标记的 High / Medium 发现均已修复；owner_attention 分支也已调整到通用 breaker check 之前，与 L1 §1.1 完全一致。单元测试已与 `action-closure-policy-system.detail.md` §1.1 / §4.2 对齐。

> 注：本轮为 review-fix 后的最终 re-review；未运行 `pnpm test` / `pnpm typecheck` / `pnpm build`，仅做静态契约映射验证。

## 2. 审查范围与静态边界

- **已读**：
  - 实现：`src/shared/types/v9-contracts.ts`、`src/core/second-nature/action/v9-action-proposal-builder.ts`、`src/core/second-nature/action/v9-autonomy-policy-evaluator.ts`
  - 测试：`tests/unit/action/v9-action-proposal-builder.test.ts`、`tests/unit/action/v9-autonomy-policy-evaluator.test.ts`
  - 设计/契约：`.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.md`、`.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md` §1.1/§3.1/§3.2/§4.1/§4.2、`.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md` §6、`.anws/v9/05A_TASKS.md` T4.2.1、`.anws/v9/05B_VERIFICATION_PLAN.md` T4.2.1、ADR-002、ADR-005
- **未执行**：未运行 `pnpm test` / `pnpm typecheck` / `pnpm build`。
- **需运行时验证**：高并发下 `generateId` 碰撞概率、`ToolRoutineGuardSchema` 在 T4.2.2 的落地。

## 3. 上一轮发现修复确认

| 原严重度 | 标题 | 修复位置 | 状态 |
|---|---|---|---|
| High | high-risk `external_write`/`capability_declared` 被 defer 而非 deny | `v9-autonomy-policy-evaluator.ts:144-147` | ✅ 已改为 `deny` |
| High | 无 permission/owner preference 的 `external_write`/`capability_declared` 被 downgrade 而非 deny | `v9-autonomy-policy-evaluator.ts:150-158` | ✅ 已改为 `deny` |
| Medium | medium-risk `external_write` 降级 autonomy 为 `draft_only` | `v9-autonomy-policy-evaluator.ts:160-174` | ✅ 已改为 `owner_confirm` |
| Medium | evaluator 对 `local_state` 豁免 source-ref gate | `v9-autonomy-policy-evaluator.ts:112-117` | ✅ 现统一拦截 `sideEffectClass !== "none"` 且无 source refs |
| Medium | `proofRefs` 缺少 `affordancePosture.sourceRefs` | `v9-autonomy-policy-evaluator.ts:68-77` | ✅ 已并入 affordance source refs |
| Low | Batch builder 未执行 `MAX_PROPOSALS_PER_CYCLE` | `v9-action-proposal-builder.ts:326-349` | ✅ 已截断并标记剩余为 no_action |
| Low | `ActivityStepIntent.authoredBy` 无运行时校验 | `v9-action-proposal-builder.ts:229-237` | ✅ 已增加运行时校验 |
| Low | 死代码 `isWriteSideEffect` | `v9-autonomy-policy-evaluator.ts` | ✅ 已移除 |
| Low | `connector_read ignore` 测试名不副实 | `tests/unit/action/v9-action-proposal-builder.test.ts:234-246` | ✅ 已改为 `watch attention suggestion returns no_action` |

## 4. 契约 → 代码映射摘要

| 设计承诺 | 实现位置 | 状态 |
|---|---|---|
| `AgentActionIntent` 直接指定 action kind / target | `v9-action-proposal-builder.ts:210-227` | ✅ |
| `ActivityStepIntent`（`propose_action`/`policy_closure`）生成提案 | `v9-action-proposal-builder.ts:228-244` | ✅ |
| `RoutineInvocation` 映射为 routine 提案 | `v9-action-proposal-builder.ts:216-226` | ✅ |
| AttentionSignal refs 仅用于 grounding / risk / source | `v9-action-proposal-builder.ts:263-267` | ✅ |
| `ignore`/`watch`/`remember` 返回 no_action | `v9-action-proposal-builder.ts:255-260` | ✅ |
| 无 source refs 的 side-effect 提案返回 no_action | `v9-action-proposal-builder.ts:282-287` | ✅ |
| routine 提案 `actionKind="routine"` / `sideEffectClass="routine"` | `v9-action-proposal-builder.ts:217`、`v9-contracts.ts:646-650` | ✅ |
| `V9_ACTION_KIND_REGISTRY` 覆盖全部 `PlatformNeutralActionKind` | `v9-contracts.ts:598-651` | ✅ |
| Owner-attention 降级为 draft（含 breaker open 路径） | `v9-autonomy-policy-evaluator.ts:179-190` | ✅ |
| Policy 决策表与 L1 §4.2 / §1.1 对齐 | `v9-autonomy-policy-evaluator.ts:112-199` | ✅ |

## 5. Lens 结果摘要

- **L1 契约忠实度**：`V9_ACTION_KIND_REGISTRY`、输入/输出契约与 `shared-v9-contracts.md` 一致；决策表修复后已对齐 L1。
- **L2 任务兑现**：T4.2.1 四类输入（Agent/activity/routine/attention-only）均实现并覆盖单元测试；高风险/无权限 deny 路径已补测试。
- **L3 架构适配**：builder/evaluator 边界清晰；`MAX_PROPOSALS_PER_CYCLE` 已在 batch builder 落地；死代码已移除。
- **L4 静态运行风险/安全**：source-ref gate 已统一；高风险/无权限外部写均直接 deny；proofRefs 已含 affordance 来源。
- **L5 验证证据**：单元测试已覆盖关键安全边界（permission false / ownerPreference false / high-risk / source-ref gate / batch cap）。
- **L6 回流一致性**：本次变更未涉及 CLI/plugin/ops surface，属可接受范围。

## 6. 剩余发现

无。

## 7. 安全 / 测试覆盖补充

- 上一轮 High/Medium 边界漂移已闭合，相关测试断言已改为期望 deny / `owner_confirm` / source-ref gate。
- `proofRefs` 现包含 affordance source refs，因果回放归因完整。
- Batch builder 的 cap 测试已补，防止单轮提案超限。
- owner_attention 分支已提前到 breaker check 之前，L1 §1.1 完全一致。
- 未发现密钥/凭证/PII 泄露；builder/evaluator 不处理原始 payload。

## 8. 结论与下一步

修复后的 Wave 128 T4.2.1 实现与 v9 action-closure-policy 契约一致，所有 High/Medium/Low 发现已关闭。

**建议下一步**：
1. 运行时验证：`pnpm typecheck`、`pnpm build`、相关单元测试。
2. 继续下游 T4.2.2（routine guard policy evaluation）。
