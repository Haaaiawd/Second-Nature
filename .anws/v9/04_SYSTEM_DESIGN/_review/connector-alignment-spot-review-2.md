# ConnectorEvolutionPlan / ConnectorVersion Field Alignment Spot Review v2

**Scope**: `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md` §7, `memory-continuity-system.md` §6.1, `memory-continuity-system.detail.md` §2, `body-connector-system.md` §6.1, `body-connector-system.detail.md` §2.

---

## Checkpoints

### 1. `platformId` is the canonical connector identifier

| Document | Evidence |
|----------|----------|
| `shared-v9-contracts.md` §7 | `ConnectorEvolutionPlan.platformId` and `ConnectorVersion.platformId` are typed as `string`; Rules state `connectorId` in storage rows is only an alias that must map 1:1 to `platformId` (lines 314, 334, 360–361). |
| `memory-continuity-system.md` §6.1 | `ConnectorEvolutionPlan` and `ConnectorVersion` both list `platformId` as the key field (lines 263–264). |
| `memory-continuity-system.detail.md` §2 | `platformId` is `not null; canonical connector/platform id` for both entities; storage-row → canonical mapping is 1:1 (lines 241, 258, 276). |
| `body-connector-system.md` §6.1 | `ConnectorVersion.version_id` / `ConnectorEvolutionPlan.platform_id` both use `platform_id` (lines 292–293, 320). |
| `body-connector-system.detail.md` §2 | TypeScript `ConnectorVersion.platformId` and `ConnectorEvolutionPlan.platformId` are `string` (lines 181–182, 206–207). |

**Result: PASS**

---

### 2. `versionId` is a string and the canonical runtime id

| Document | Evidence |
|----------|----------|
| `shared-v9-contracts.md` §7 | `ConnectorVersion.versionId: string`; Rules state storage may keep an integer `sequence` only for ordering, but read ports must expose `versionId` (lines 333, 362). |
| `memory-continuity-system.detail.md` §2 | `versionId` is `text not null; canonical string version id`; `sequence` is nullable and explicitly "非 canonical runtime id" (lines 259–260, 277). |
| `body-connector-system.md` §6.1 | `ConnectorVersion.version_id: str` (line 292). |
| `body-connector-system.detail.md` §2 | `ConnectorVersion.versionId: string` (line 181). |

**Result: PASS**

---

### 3. `gateResults` is `GateResult[]` canonical shape; memory serializes to `gateResultsJson`; body-connector may expand internally but interchange uses `GateResult[]`

| Document | Evidence |
|----------|----------|
| `shared-v9-contracts.md` §7 | `ConnectorEvolutionPlan.gateResults?: GateResult[]` and `ConnectorVersion.gateResults: GateResult[]`; Rules state storage serializes to `gateResultsJson` and `body-connector-system` may expand per-gate internally, but cross-system interchange uses `GateResult[]` (lines 318, 341, 362–363). |
| `memory-continuity-system.detail.md` §2 | `ConnectorEvolutionPlan.gateResultsJson` is declared as "`GateResult[]` 序列化" (line 244); `ConnectorVersion` keeps the same JSON field (line 262). The apply-result contract returns `gateResults: GateResult[]` (line 545). |
| `body-connector-system.md` §6.1 | Internal Python dataclass expands gates into `schema_gate` … `canary_gate` (lines 300–305). This is explicitly permitted by the shared contract. |
| `body-connector-system.detail.md` §2 / §3.8 | Internal TypeScript struct expands gates (`schemaGate` … `canaryGate`, lines 189–194), but `applyConnectorEvolution` returns a `gateResults` array to the caller (lines 516–549). |

**Result: PASS**

> Minor documentation gap: `memory-continuity-system.detail.md` §2 "Storage-row → canonical contract mapping" table (lines 272–284) omits the `gateResultsJson → gateResults` mapping, even though the field declaration above already defines it.

---

### 4. `previousStableRef` is nullable

| Document | Evidence |
|----------|----------|
| `shared-v9-contracts.md` §7 | `ConnectorEvolutionPlan.previousStableRef?: string` and `ConnectorVersion.previousStableRef?: string` (lines 319, 343). |
| `memory-continuity-system.detail.md` §2 | `previousStableRef` is `nullable` for both `ConnectorEvolutionPlan` and `ConnectorVersion` (lines 245, 264). |
| `body-connector-system.md` §6.1 | `ConnectorVersion.previous_stable_ref: str | None` (line 307); `ConnectorEvolutionPlan.previous_stable_ref: str | None` (line 324). |
| `body-connector-system.detail.md` §2 | `previousStableRef?: string` on both entities (lines 196–197, 211). |

**Result: PASS**

---

### 5. `ConnectorVersion` contains `manifestPath`/`recipePath`/`adapterPath`, `declaredCapabilities`, `previousStableRef`, `rollbackRef`, `rollbackCommandHint`, `activatedAt`, `rolledBackAt`

| Document | Evidence |
|----------|----------|
| `shared-v9-contracts.md` §7 | `ConnectorVersion` includes `manifestPath`, optional `recipePath`, optional `adapterPath`, `declaredCapabilities`, `previousStableRef`, `rollbackRef`, `rollbackCommandHint`, `activatedAt`, `rolledBackAt` (lines 337–349). |
| `memory-continuity-system.detail.md` §2 | Stored as `assetPathsJson` (manifest/recipe/adapter paths), `declaredCapabilitiesJson`, `previousStableRef`, `rollbackRef`, `rollbackCommandHint`, `activatedAt`, `rolledBackAt`; the mapping table explicitly maps the JSON aggregates to the canonical fields (lines 261–284). |
| `body-connector-system.detail.md` §2 | TypeScript `ConnectorVersion` includes all fields including `activatedAt?` and `rolledBackAt?` (lines 185–202). |
| `body-connector-system.md` §6.1 | Python dataclass includes `manifest_path`, `recipe_path`, `adapter_path`, `declared_capabilities`, `previous_stable_ref`, `rollback_ref`, `rollback_command_hint`, `activated_at`, but **omits `rolled_back_at`** (lines 296–311). |

**Result: PASS with minor drift**

The shared contract, memory storage mapping, and body L1 all include `rolledBackAt`. The L0 `body-connector-system.md` core-entities dataclass is missing `rolledBackAt`. This is a documentation inconsistency, not a schema contradiction, because L0 defers complete data structures to L1.

---

## Final Verdict

**Aligned with minor drift.**

All five requested field-consistency checkpoints are satisfied. The only residual issue is the L0 `body-connector-system.md` `ConnectorVersion` dataclass missing `rolledBackAt`; it should be aligned with `body-connector-system.detail.md` §2 and `shared-v9-contracts.md` §7 to avoid implementation misreading.
