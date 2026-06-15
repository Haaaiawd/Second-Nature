# Wave 109 Code Review — 2026-06-15

## 1. 总结结论

**Pass**

Wave 109 修复后的实现静态上满足内容承载证据、可读感知、非模板 Quiet、Dream 立即执行与 UUID/identifier 误杀修复等契约；未发现 Critical/High 阻断级问题。前一轮审查中的两项 Medium 与两项 Low 修复均可在代码中定位。

---

## 2. 审查范围与静态边界

### 已读（必读输入）
- `.anws/v8/01_PRD.md`
- `.anws/v8/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v8/03_ADR/ADR_001_TECH_STACK.md` ~ `ADR_005_CAUSAL_LOOP_HEALTH.md`
- `.anws/v8/04_SYSTEM_DESIGN/connector-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/state-memory-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md`
- `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md`
- `.anws/v8/05A_TASKS.md`（Wave 109 段落）
- `.anws/v8/05B_VERIFICATION_PLAN.md`（Wave 109 Addendum / INT-R4）
- Wave 109 全部实现文件与测试文件（见输入清单）

### 未读 / 未执行
- 未运行 `pnpm build` / `pnpm lint` / 任何测试；仅做静态文件审查。
- 未检查 `plugin/` runtime artifact 是否已重建。
- 未审计 v7 connector executor 真实运行时行为。

### 需人工 / 运行时验证
- `pnpm build`、`pnpm exec tsc --noEmit`、`pnpm lint` 实际结果。
- `tests/integration/v8/content-bearing-living-loop.test.ts` 真实 Node 执行结果。
- 真实 MoltBook/Instreet connector payload 在 `extractNormalizedEvidenceItems` 上的提取效果。

---

## 3. 契约 → 代码映射摘要

| Wave 109 任务 / 契约 | 关键实现区域 | 静态验证结果 |
|---|---|---|
| **T-CS.R.4** `NormalizedEvidenceContent` envelope + 平台无关提取器 | `src/connectors/base/normalized-evidence-content.ts:45-315` | 字段与 `connector-system.md §2` 一致；提取器不判断、不持久化。 |
| **T-CS.R.5** 真实 heartbeat 写入 content-bearing v8 EvidenceItem + 去重 | `src/connectors/evidence-normalizer.ts:149-255`、`src/core/second-nature/heartbeat/heartbeat-loop.ts:222-234` | 双写保留；按 externalId / contentHash 去重；upsert 刷新 observedAt/seenCount。 |
| **T-PJ.R.2** 从 content-bearing EvidenceItem 构建可读 PerceptionCard | `src/core/second-nature/perception/perception-builder.ts:128-259, 362` | 读取 payloadJson.summary/title/entities；标记 contentMissing；生命周期推进到 `perceived`。 |
| **T-DQ.R.6** 非模板 QuietDailyReview | `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:219-387` | 加载当天 EvidenceItem/PerceptionCard；生成 headline/sections/notable signals；无模板占位符。 |
| **T-DQ.R.7** Dream 调度后立即执行 + 7 天间隔 + stale 修复 | `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts:116-192, 310-351` | scheduled→started→completed/blocked；7 天间隔；5 分钟 stale 修复。 |
| **T-OBS.R.5** UUID/sourceRef ID 误杀修复 + 字段级归因 | `src/storage/services/write-validation-gate.ts:139-141, 175-221` | UUID 豁免；identifier/URI 字段豁免；失败返回 `field` + `pattern`。 |
| **INT-R4** 内容承载全链集成门 | `tests/integration/v8/content-bearing-living-loop.test.ts`、`reports/int-r4-v8-content-bearing-loop.md` | 4 cases 覆盖 evidence→perception→closure→Quiet→Dream→projection。 |

---

## 4. Lens 结果摘要

### L1 Contract Fidelity
**结论**: 契约忠实度良好。`NormalizedEvidenceContent` 字段与 `connector-system.md §2` 一致；`PerceptionCard` 使用 canonical `noveltyClass`/`relevanceScore`/`relevanceClass`；`QuietDailyReview` 写出 first-class `closureRefs`；新增 reason code（`dream_scheduled_stalled` 等）已在 `src/shared/types/v8-contracts.ts:188-247` 注册。

### L2 Task Fulfillment
**结论**: 全部 Wave 109 任务在代码、测试、报告中均有承接。`05A_TASKS.md` 中 T-CS.R.4/5、T-PJ.R.2、T-DQ.R.6/7、T-OBS.R.5、INT-R4 均已标记完成；`05B_VERIFICATION_PLAN.md` 含 Wave 109 Addendum 与 INT-R4 验收标准。

### L3 Architecture Fit
**结论**: 模块边界清晰。`normalized-evidence-content.ts` 是纯提取边界；`evidence-normalizer.ts` 负责 connector→EvidenceItem 映射；`perception-builder.ts` 负责 evidence→perception；`quiet-daily-review-builder.ts` 消费 closure/evidence/perception；`daily-rhythm-scheduler.ts` 编排 Quiet/Dream 节律。

### L4 Static Runtime Risk / Safety
**结论**: 静态安全风险可控。去重键与 upsert conflict target 一致；write-validation 对 UUID/identifier/URI 豁免并返回字段级归因；Dream redaction 保留 public technical、阻断 value-like secret shape；stale scheduled Dream 有修复路径。存在少量低严重度边界（见 Issues）。

### L5 Verification Evidence
**结论**: 验证覆盖充分。每个任务都有对应单元测试；INT-R4 集成测试覆盖全链；INT-R3/Wave 108 回归测试已更新。注意 INT-R4 中“UUID 不阻塞 write validation”的测试实际调用的是未接入 `write-validation-gate` 的 `writeEvidenceItem`（见 Low 项）。

### L6 Backflow & Handoff
**结论**: 回流基本一致。设计文档、`05A_TASKS.md`、`05B_VERIFICATION_PLAN.md`、INT-R4 报告均同步更新；任务状态、测试证据、报告产出相互对应。存在一条 Low 级文档漂移（见 Issues）。

---

## 5. Issues

### 5.1 Critical

无。

### 5.2 High

无。

### 5.3 Medium

无。前一轮 Medium 项已修复：
- `inferSensitivityHint` 不再使用宽泛关键词正则，仅在 secret 关键词伴随 value-like 赋值形状时标记 `sensitive`（`src/connectors/evidence-normalizer.ts:96-104`）。
- 敏感度分类的真实 DB 验证已落在 `tests/unit/connectors/evidence-dedupe.test.ts:90-117`。
- `findDeepValue` 已改为遍历全部数组元素（`src/connectors/base/normalized-evidence-content.ts:116-131`）。
- `deepScanSensitiveFields` 已返回字段级归因，`validateWritePayload` 报告 `field`（`src/storage/services/write-validation-gate.ts:109-125, 261-267`）。

### 5.4 Low

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| Low | L1+L6 | `05A_TASKS.md` INT-R4 验收文字仍要求 Dream “leaves scheduled”，与实现/设计不一致 | `.anws/v8/05A_TASKS.md:1458` 写 `dream_consolidation_run status leaves scheduled`；而 `daily-rhythm-scheduler.ts:310-351` 已改为立即执行到 `completed`/`blocked`，`dream-quiet-memory-system.detail.md §3.2/§4.1` 也要求状态推进。 | 任务文档与实际契约漂移，可能造成后续回归测试期望混淆。 | 将 INT-R4 验收文字更新为 `status reaches completed/blocked/failed` 或明确“不得长期停留在 scheduled”。 | `05B_VERIFICATION_PLAN.md` Wave 109 T-DQ.R.7 detail；`04_SYSTEM_DESIGN/dream-quiet-memory-system.detail.md` §3.2 |
| Low | L5 | INT-R4 UUID 测试未真正经过 write-validation gate | `tests/integration/v8/content-bearing-living-loop.test.ts:169-193` 调用 `writeEvidenceItem`；`src/storage/v8-state-stores.ts:143-174` 的 `writeEvidenceItem` 不调用 `validateWritePayload`。 | 测试标题暗示验证了 gate 放行 UUID，实际只验证了 EvidenceItem 插入；可能产生虚假信心。 | 重命名测试为“UUID-bearing evidence persists”，或在测试中显式调用 `validateWritePayload` 并断言通过。 | `05B_VERIFICATION_PLAN.md#t-obs-r-5`；`T-OBS.R.5` 验收标准 |
| Low | L4 | 字段键扫描的 `token` 模式仍为子串匹配，可能误杀 benign 键名 | `src/storage/services/write-validation-gate.ts:75-80` 使用 `/token/i`，会匹配 “tokens”、“tokenize” 等。 | 与 T-OBS.R.5 主要目标不冲突，但未来可能误拒非 secret 字段。 | 缩窄为完整词 `\btoken\b` 或增加赋值上下文；并返回字段路径。 | `04_SYSTEM_DESIGN/state-memory-system.md` §6 “field-level attribution is required when a scan fails” |

---

## 6. 安全 / 测试覆盖补充

### 6.1 已验证的阻塞修复声明

| 声称修复 | 静态证据定位 | 结论 |
|---|---|---|
| 新增 reason codes | `src/shared/types/v8-contracts.ts:196,202,194,188-247` | ✅ 已注册 |
| Schema `closure_refs_json` + 索引顺序 | `src/storage/db/index.ts:243-254,195` | ✅ 表与索引顺序正确；`v8-003` 迁移已 no-op |
| Evidence lifecycle 推进到 `perceived` | `src/core/second-nature/perception/perception-builder.ts:362` | ✅ 每条 card 写入后更新 |
| Quiet 加载真实 EvidenceItem/PerceptionCard | `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:219-232` | ✅ 按天读取 |
| Dream 立即执行 + 7 天间隔 + stale 修复 | `src/core/second-nature/quiet-dream/daily-rhythm-scheduler.ts:310-351,116-192` | ✅ scheduled→started→completed；stale 阈值 5 分钟；interval 7 天 |
| Write-validation UUID/identifier 豁免 + 字段归因 | `src/storage/services/write-validation-gate.ts:139-141,175-221` | ✅ UUID 通过；sourceRef URI 通过；失败返回字段与 pattern |
| 新增单元测试 + INT-R4 报告 | 见 §3 映射表 | ✅ 文件存在 |
| `connector_status` CLI 注册 | `src/cli/commands/index.ts:548-558` | ✅ 已注册 |

### 6.2 高风险缺口

- **无运行时验证**: 本审查未执行测试；INT-R4 报告声称 4/4 PASS 但需实际运行确认。
- **真实 connector payload 适配**: `extractNormalizedEvidenceItems` 基于常见键名启发式提取，真实 MoltBook/Instreet payload 中未覆盖的字段可能退化为 `unknown` 或 `[no readable content]`。
- **v8/v7 双写一致性**: `heartbeat-loop.ts` 中 v7 `appendLifeEvidence` 与 v8 `normalizeConnectorEvidence` 任一失败均被吞掉；运营面需同时监控两条路径的失败日志。

### 6.3 无法静态确认项

- `pnpm build` / `pnpm lint` / 全量测试的实际结果。
- `plugin/` runtime 是否随 Wave 109 重建。
- 真实宿主（OpenClaw）对 INT-R4 的端到端验证。
