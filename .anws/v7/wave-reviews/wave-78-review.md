# Wave 78 Code Review — T-V7C.C.7 Guidance Semantics Refinement

**审查日期**: 2026-05-27
**审查范围**: T-V7C.C.7 全部产出（12 文件修改 + 1 新测试文件 + 1 测试修复）
**签入**: AUTO

---

## 1. 严重度总览

| 严重度 | 数量 | 状态 |
|--------|------|------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | 已记录，设计 accepted |
| Low | 1 | 已记录，设计 accepted |

---

## 2. 审查详情

### Medium-01: guidance_payload 固定 atmosphere mode/risk

**位置**: `src/cli/ops/ops-router.ts:1650`

`guidance_payload` 命令调用 `getShortAtmosphereTemplate("active", "low")`，对 preview-only 命令固定了 mode/risk。这会导致 preview 的 atmosphere 不一定匹配真实 heartbeat 场景。

**评估**: Accepted。guidance_payload 是预览命令，设计意图是展示 impulse + atmosphere 结构，不承诺完全匹配真实场景。如后续需要精确 preview，可在 input 中扩展 mode/risk 参数。

### Low-01: getBaselineAtmosphereTemplate 仍标记为 approved

**位置**: `src/guidance/template-registry.ts:104`

兼容层 `getBaselineAtmosphereTemplate` 返回 reviewStatus="approved"，但 frontmatter 中未标记 deprecated。

**评估**: Accepted。`_semanticNote` 和 JSDoc `@deprecated` 已在函数层面标注；frontmatter 属于模板文件元数据，非运行时 API。

---

## 3. 向后兼容性

- `outputGuard` 字段仍存在于 `GuidancePayload` / `GuidanceFallback`，未移除
- `buildOutputGuard` 保留原有签名，新增 `_semanticNote`
- `getBaselineAtmosphereTemplate` 保留原有签名，新增 JSDoc `@deprecated`
- `AppliedGuidanceContext.outputConstraints` 保留，新增 `expressionConstraints`
- 现有测试 `heartbeat-executor.test.ts` 通过补充 `expressionConstraints` 通过
- 回归测试：170/170 PASS（guidance + heartbeat + control-plane）

---

## 4. 测试覆盖

- `v7c-guidance-semantics.test.ts`: 12 项测试，覆盖 expressionBoundary 类型、atmosphere 短文本、agent.* 排除、兼容层、ownership 语义
- `guidance-draft-service.test.ts`: 修复中文期望，8/8 PASS
- 全部 guidance 集成 + unit: 170/170 PASS

---

## 5. 结论

**最高严重度**: none（Medium-01 / Low-01 均设计 accepted）
**残留待跟进**: 无
**可进 Step 4**: 是
