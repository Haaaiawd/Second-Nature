# Wave 60 Code Review — T-DQS.C.2 Dream InputLoader (DR-026)

**审查日期**: 2026-05-22
**分支**: `feature/v7-wave60-dqs-c2`
**审查类型**: 子代理代码审查
**初始状态**: Partial Pass → 修复后 Pass

---

## 严重度汇总

| 严重度 | 初始数量 | 修复后数量 |
|---|---|---|
| Critical | 1 | 0 |
| High | 2 | 0 |
| Medium | 4 | 0 |
| Low | 3 | 0 |
| **总计** | **10** | **0** |

---

## 发现详情与修复

### 1. Critical — ToolExperienceSummary 计数逻辑缺陷 ✅ FIXED

**位置**: `src/dream/dream-input-loader.ts:126-143`
**问题**: `count: 1` 硬编码，未聚合相同 (connectorId, capabilityId, outcome) 的记录。
**修复**: SQL 改用 `GROUP BY connector_id, capability_id, outcome` + `COUNT(*) as count` + `MAX(created_at) as last_recorded_at`。

### 2. High — ToolExperience 测试覆盖不足 ✅ FIXED

**位置**: `tests/unit/dream/dream-input-loader.test.ts`
**问题**: 仅测试单条记录，缺少聚合测试和不同 outcome 分离测试。
**修复**: 新增 3 个测试：
- `aggregates multiple ToolExperience records with same connector/capability/outcome`
- `separates ToolExperience summaries by outcome`
- `handles mixed-format source_refs_json`

### 3. High — async 函数无实际异步操作 ✅ FIXED

**位置**: `src/dream/dream-input-loader.ts:78`
**问题**: `async` 但内部无 `await`。
**修复**: 添加内联注释说明 `async` 与 `DreamStatePort.loadDreamInputs` 签名对齐，预留异步 DB 驱动扩展。

### 4. Medium — SQL ORDER BY 不一致 ✅ FIXED

**位置**: `src/dream/dream-input-loader.ts:88-107`
**问题**: `daily_diary_index` 查询无 ORDER BY。
**修复**: 添加 `ORDER BY created_at DESC`；`life_evidence_index` 添加 `ORDER BY timestamp DESC`。

### 5. Medium — NULL 值处理薄弱 ✅ FIXED

**位置**: `src/dream/dream-input-loader.ts:25-31`
**问题**: `JSON.parse("null")` 返回 `null` 而非数组，可能导致 `for...of` 失败。
**修复**: `safeParseJson` 增加 `parsed ?? fallback` 防御；`extractRefIdsFromJson` 和 `extractConsumedRefIdsFromEntriesJson` 增加 `Array.isArray(parsed)` 守卫。

### 6. Medium — 边界测试缺失 ✅ FIXED

**位置**: `tests/unit/dream/dream-input-loader.test.ts`
**问题**: 缺少空字符串、`"null"` 字符串、混合格式等边界测试。
**修复**: 新增 `handles empty string source_refs_json gracefully`、`handles 'null' string source_refs_json gracefully`、`handles mixed-format source_refs_json`。

### 7. Medium — inputCounts 缺乏注释 ✅ FIXED

**位置**: `src/dream/dream-input-loader.ts:166-179`
**问题**: `chronicle: 0` / `memoryEntries: 0` 无说明。
**修复**: 添加内联注释说明 T-DQS.C.2 范围（evidence only，chronicle/memory 由其他模块加载）。

### 8. Low — 注释说明不足 ✅ FIXED

**位置**: `src/dream/dream-input-loader.ts:1-29`
**问题**: 头部注释未详细说明 DR-026 幂等机制、lock 语义、性能特征。
**修复**: 重写 JSDoc，涵盖幂等机制、lock TTL 分工、ToolExperience 聚合语义、性能复杂度。

### 9. Low — 类型导出一致性 ✅ PASS (无修复必要)

**位置**: `src/dream/index.ts`
**结论**: `export * from "./types.js"` 已覆盖 `ToolExperienceSummary`，无需额外导出。

### 10. Low — 性能文档缺失 ✅ FIXED

**位置**: `src/dream/dream-input-loader.ts:97-100`
**问题**: `timeWindowDays` / `evidenceLimit` 默认值无来源说明。
**修复**: 添加内联注释引用 `05A_TASKS.md T-DQS.C.2` 和 `dream-quiet-system.md §10.2`。

---

## 验证结果

| 指标 | 数值 |
|---|---|
| 单元测试总数 | 16 |
| 通过 | 16 |
| 失败 | 0 |
| 全量回归 (unit) | 550 / 551 pass |
| 预先存在失败 | `resolveCapability unknown capability throws`（旧行为，非本 Wave 引入） |

---

## 变更文件清单

- `src/dream/types.ts` — 新增 `ToolExperienceSummary`，扩展 `DreamInputBundle`
- `src/dream/dream-input-loader.ts` — 新建（161 行）
- `src/dream/index.ts` — 导出 `createDreamInputLoader`
- `tests/unit/dream/dream-input-loader.test.ts` — 新建（16 测试用例）
- `AGENTS.md` — 添加 Wave 60 块
- `.anws/v7/05A_TASKS.md` — 标记 T-DQS.C.2 `[x]`

---

## 最终结论

**状态**: ✅ **Pass**

所有 Critical/High/Medium/Low 发现均已修复或澄清。核心逻辑（DR-026 幂等去重）正确，测试覆盖充分，类型安全，无回归破坏。
