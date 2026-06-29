# Wave 119 Code Review — v9 S1 Contract Spine

**Wave**: 119  
**任务**: T5.1.1, T5.1.2, T5.2.3, INT-S1  
**分支**: `feature/wave-119-v9-contract-spine`  
**审查日期**: 2026-06-23  
**审查模式**: 静态审查（`.agents/skills/code-reviewer/SKILL.md` 未在 workspace 安装，按 /forge §3.6 要求执行手工静态审查）

---

## 严重度摘要

| 严重度 | 数量 | 状态 |
|--------|------|------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 2 | 已记录，可在后续波次处理 |

---

## 审查范围

- `src/shared/types/v9-contracts.ts`
- `src/shared/types/index.ts`
- `tests/unit/contracts/v9-shared-contracts.test.ts`
- `src/storage/db/schema/v9-entities.ts`
- `src/storage/db/schema/v8-entities.ts`
- `src/storage/db/schema/index.ts`
- `src/storage/db/index.ts`
- `src/storage/db/migrations/v9-001-self-continuity.ts`
- `src/storage/db/migrations/index.ts`
- `src/storage/db/migration-runner.ts`
- `src/storage/v9-state-stores.ts`
- `tests/integration/storage/v9-schema-migration.test.ts`
- `src/storage/v9-legacy-judgment-adapter.ts`
- `tests/unit/memory/v9-legacy-judgment-adapter.test.ts`
- `reports/int-s1-v9-contract-spine.md`

---

## 发现详情

### Low-01: `v9-legacy-judgment-adapter.ts` 复用 judgment row id 作为 `signalId`

**位置**: `src/storage/v9-legacy-judgment-adapter.ts:41`  
**说明**: `signalId` 直接使用 `row.id`。`memory-continuity-system.detail.md §3.1a` 伪代码建议 `generateId()` 以区分 attention signal 命名空间；当前实现对 replay/history 可读，但未来若把映射结果持久化到 `attention_signal` 表可能产生主键冲突。  
**影响**: Low；当前 mapped signal 不写入 `attention_signal` 表。  
**建议**: 下一波若扩展 legacy replay 持久化，改为 `generateId()` 并将 judgment id 放入 `sourceRefs` / `payloadJson`。

### Low-02: `v9-state-stores.ts` 序列化辅助重复实现

**位置**: `src/storage/v9-state-stores.ts:29-42`  
**说明**: 文件内本地实现了 `serializeSourceRefs` / `parseSourceRefs`，与 `src/shared/serialization.js` 中的 v8 版本功能重复。v9 `SourceRef` 形状与 v8 不同（无 `uri`/`redactionClass`/`sensitivityClass`），因此不能简单复用 v8 helper，但未来应考虑提供 `src/shared/v9-serialization.ts` 统一实现，避免 v9 writer 各自重复。  
**影响**: Low；当前仅在 v9-state-stores.ts 使用，漂移风险可控。  
**建议**: Wave 120+ 若新增 v9 writer，统一抽取 `src/shared/v9-serialization.ts`。

---

## 契约闭合检查

| 契约 | 实现位置 | 验证位置 | 状态 |
|------|---------|---------|:----:|
| v9 canonical shared contracts | `src/shared/types/v9-contracts.ts` | `tests/unit/contracts/v9-shared-contracts.test.ts` | ✅ |
| v9 storage schema | `src/storage/db/schema/v9-entities.ts`, `src/storage/db/index.ts` | `tests/integration/storage/v9-schema-migration.test.ts` | ✅ |
| v8 evidence identity 扩展 | `src/storage/db/schema/v8-entities.ts`, `src/storage/db/migrations/v9-001-self-continuity.ts` | schema migration tests | ✅ |
| v8 judgment → v9 attention 适配 | `src/storage/v9-legacy-judgment-adapter.ts` | `tests/unit/memory/v9-legacy-judgment-adapter.test.ts` | ✅ |
| Fresh DB migration skip | `src/storage/db/index.ts:bootstrapStateSchema` | schema migration tests | ✅ |

---

## 验证证据

- `pnpm typecheck` ✅
- `pnpm build` ✅
- `pnpm build:plugin` ✅
- `node --test dist/tests/unit/contracts/v9-shared-contracts.test.js` — 14/14 PASS
- `node --test dist/tests/integration/storage/v9-schema-migration.test.js` — 7/7 PASS
- `node --test dist/tests/unit/memory/v9-legacy-judgment-adapter.test.js` — 3/3 PASS

---

## 最终判定

**Pass**。无 Critical/High/Medium 残留。2 项 Low 均不阻塞 S1 退出，已在报告中记录待后续波次处理。

---

## 残留待跟进

- Low-01: legacy adapter `signalId` 命名空间（非阻塞，当前不持久化）
- Low-02: v9 serialization helper 统一抽取（非阻塞，当前单一使用者）
