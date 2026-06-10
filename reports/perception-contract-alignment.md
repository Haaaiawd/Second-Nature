# PerceptionCard Contract Alignment Report

> **Date**: 2026-06-10
> **Task**: T-PJ.R.1
> **Status**: ✅ PASS

---

## 1. Problem

`PerceptionCard` contract drifted between design and code:

| Dimension | Design (canonical) | Code (drifted) |
|-----------|-------------------|----------------|
| `novelty` | `new \| changed \| duplicate \| stale` | `new \| recurring \| update` |
| `relevance` | `low \| medium \| high` (enum) | `0.0–1.0` (numeric REAL) |

Impact: Downstream judgment, tests, and docs reasoned over different semantic domains. The same field had two meanings.

---

## 2. Resolution

Adopted canonical contract with backward-compatible storage:

| Canonical Field | Storage Field | Type | Values |
|----------------|---------------|------|--------|
| `noveltyClass` | `novelty` | TEXT | `new \| changed \| duplicate \| stale` |
| `relevanceScore` | `relevance` | REAL | `[0, 1]` |
| `relevanceClass` | `relevance_class` | TEXT | `low \| medium \| high` |

- `noveltyClass` replaces the ambiguous `novelty` field name in the TypeScript interface.
- `relevanceScore` preserves the numeric relevance for judgment-engine consumption.
- `relevanceClass` is derived from `relevanceScore` and persisted as a new column.

---

## 3. Changes

### Schema
- `src/storage/db/schema/v8-entities.ts`: Added `relevanceClass: text("relevance_class")` to `perception_card`.
- `src/storage/db/index.ts`: Updated `STATE_SCHEMA_SQL` bootstrap SQL.
- `src/storage/db/migrations/v8-002-perception-contract-alignment.ts`: New migration to add `relevance_class` column via `ALTER TABLE`.
- `src/storage/db/migrations/index.ts`: Registered v8-002 migration.

### Builder
- `src/core/second-nature/perception/perception-builder.ts`:
  - `PerceptionCardResult.noveltyClass`: canonical enum
  - `PerceptionCardResult.relevanceScore`: numeric score
  - `PerceptionCardResult.relevanceClass`: derived class
  - `inferNoveltyClass()`: returns `new` or `changed` (replacing `recurring`/`update`)
  - `inferRelevanceScore()`: returns numeric score
  - `inferRelevanceClass()`: maps score → `low \| medium \| high`

### State Stores
- `src/storage/v8-state-stores.ts`: `writePerceptionCard` and `readPerceptionCardById` automatically support `relevanceClass` via schema inference. No explicit store changes required.

### Judgment Engine
- `src/core/second-nature/perception/judgment-engine.ts`: Unchanged. It continues to consume `card.relevance` (the numeric score), which is the same semantic as before.

---

## 4. Test Results

| Test | Result |
|------|--------|
| `perception-contract-alignment` | 4/4 PASS |
| `perception-builder` | 4/4 PASS |
| `judgment-engine` | 3/3 PASS |
| `sensitivity-classifier` | 13/13 PASS |
| `v8-state-stores` | 13/13 PASS |
| `pnpm typecheck` | ✅ PASS |
| `pnpm build` | ✅ PASS |

### Contract Alignment Tests

1. **Canonical novelty class**: Asserts `noveltyClass` is one of `new \| changed \| duplicate \| stale`, never `recurring` or `update`.
2. **Canonical relevance score and class**: Asserts `relevanceScore` is numeric in `[0, 1]` and `relevanceClass` is one of `low \| medium \| high`.
3. **Round-trip persistence**: Writes card, reads back from DB, verifies all canonical fields persisted correctly.
4. **Score-to-class mapping consistency**: High (0.7) → `high`, Medium (0.5) → `medium`, Low (0.3) → `low`.

---

## 5. Legacy Compatibility

- Old `perception_card` rows without `relevance_class` will have `null` for that column.
- `readPerceptionCardById` returns `relevanceClass` as `null` for legacy rows.
- Judgment engine is unaffected because it only reads `relevance` (numeric score).
- New writes always populate `relevanceClass`.

---

## 6. Remaining Gaps

| Gap | Task | Status |
|-----|------|--------|
| Projection supersession / feedback | T-DQ.R.3 | Pending |
| Quiet closureRefs first-class | T-DQ.R.4 | Pending |
| INT-R2 integration gate | INT-R2 | Pending |
