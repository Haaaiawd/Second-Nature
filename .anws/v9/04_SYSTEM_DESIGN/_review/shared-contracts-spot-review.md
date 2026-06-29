# v9 Shared Contracts Spot Review

> **Scope**: Field-level consistency between `shared-v9-contracts.md` and the L0/L1 designs of `character-continuity-system`, `body-connector-system`, and `control-context-system`.
> **Reviewer**: spot-reviewer
> **Date**: 2026-06-22

---

## Check 1 — `CharacterFrame` in shared contracts vs character-continuity-system

**Verdict: PASS (with Low drift notes)**

| Field | Shared Contract (`shared-v9-contracts.md` §5.1) | `character-continuity-system.md` §6.1 / `.detail.md` §2 | Status |
|-------|------------------------------------------------|--------------------------------------------------------|--------|
| `emergentHabits` | `EmergentHabit[]` (optional) | `EmergentHabit[]` (optional) | ✅ |
| `growthTensions` | `GrowthTension[]` (optional) | `GrowthTension[]` (optional) | ✅ |
| `charCount` | `number` | `number` | ✅ |
| `validFrom` | `string` | `ISO timestamp` | ✅ |
| `validUntil` | `string \| null` | `ISO timestamp \| null` | ✅ |
| `projectionKind` | `"character_frame"` | `"character_frame"` | ✅ |
| `conflictNotes` | `ConflictNote[]` (optional) | `ConflictNote[]` (optional) | ✅ |
| `createdAt` | `string` | **missing from L0 table** | ⚠️ Low |
| `acceptedAt` | `string` (optional) | **missing from L0 table** | ⚠️ Low |
| `projectionKind`, `supersededBy`, `revisionOf` | present | present | ✅ |

**Low-drift findings**:
- `character-continuity-system.md` §6.1 table omits `createdAt` and `acceptedAt`.
- `character-continuity-system.detail.md` §3.1 pseudocode candidate literal also omits `projectionKind`, `validFrom`, `validUntil`, `charCount`, `conflictNotes`, `supersededBy`, `revisionOf`, and `acceptedAt`. These omissions do not contradict the canonical contract, but they make the L1 pseudocode incomplete as an implementation reference.

**Suggested fix**: Add `createdAt` / `acceptedAt` to the L0 table and make the L1 candidate literal exhaustive.

---

## Check 2 — `ConnectorVersion` / `ConnectorEvolutionPlan` in shared contracts vs body-connector-system / memory-continuity-system

**Verdict: FAIL — Block-level drift**

### `ConnectorEvolutionPlan`

| Field | Shared (`shared-v9-contracts.md` §7.1) | `body-connector-system.md` §6.1 / `.detail.md` §2 | `memory-continuity-system.md` §6.1 / `.detail.md` §2 | Issue |
|-------|----------------------------------------|---------------------------------------------------|-----------------------------------------------------|-------|
| `id` | `string` | `id: string` | `id: text` | ✅ |
| `connectorId` | `string` | **absent** (uses `platform_id` / `plan_id`) | `connectorId: text` | ⚠️ Medium |
| `planType` | `string` | `plan_type: string` | `planType: text` | ✅ (casing only) |
| `payloadJson` | `string` | **absent** (uses `proposed_changes_json`) | `payloadJson: text` | ⚠️ Medium |
| `status` | enum | enum | enum | ✅ |
| `gateResults` | `GateResult[]` | `gate_results_json: string \| null` | `gateResultsJson: text` | ❌ **Medium+** |
| `previousStableRef` | `string?` | `previous_stable_ref: string \| None` | `previousStableRef: text **not null**` | ❌ **Medium+** |
| `rollbackCommandHint` | `string?` | **absent in L0**, present in L1 | `rollbackCommandHint: text?` | ⚠️ Medium |
| `sourceRefs` | `SourceRef[]` | `source_refs: SourceRef[]` | `sourceRefsJson: text` | ✅ (storage form) |
| `createdAt` | `string` | `created_at: datetime` | `createdAt: text` | ✅ |
| `planId` / `targetVersionId` | **absent** | `plan_id`, `target_version_id` present | **absent** | ⚠️ Medium |

### `ConnectorVersion`

| Field | Shared (`shared-v9-contracts.md` §7.2) | `body-connector-system.md` §6.1 / `.detail.md` §2 | `memory-continuity-system.md` §6.1 / `.detail.md` §2 | Issue |
|-------|----------------------------------------|---------------------------------------------------|-----------------------------------------------------|-------|
| `id` | `string` | `id: string` | `id: text` | ✅ |
| `versionId` | `string` | `version_id: string` | **absent** (uses `version: integer`) | ❌ **Medium+** |
| `platformId` / `connectorId` | `platformId: string` | `platform_id: string` | `connectorId: text` | ⚠️ Medium |
| `workspaceRoot` | `string` | `workspace_root: string` | **absent** | ⚠️ Medium |
| `planType` | `string` | `plan_type: string` | **absent** | ⚠️ Medium |
| `manifestPath` | `string` | `manifest_path: string` | **absent** (uses `assetPath`) | ⚠️ Medium |
| `recipePath?` | `string?` | `recipe_path?: string` | **absent** | ⚠️ Medium |
| `adapterPath?` | `string?` | `adapter_path?: string` | **absent** | ⚠️ Medium |
| `declaredCapabilities` | `string[]` | `declared_capabilities: string[]` | **absent** | ⚠️ Medium |
| `gateResults` | `GateResult[]` | per-gate fields `schema_gate`..`canary_gate` | **absent** | ❌ **Medium+** |
| `previousStableRef?` | `string?` | `previous_stable_ref?: string` | **absent** | ⚠️ Medium |
| `rollbackRef?` | `string?` | `rollback_ref?: string` | **absent** | ⚠️ Medium |
| `rollbackCommandHint?` | `string?` | L0 absent / L1 present | **absent** | ⚠️ Medium |
| `sourceRefs` | `SourceRef[]` | `sourceRefs: SourceRef[]` (L1) | `sourceRefsJson: text` | ✅ (storage form) |
| `createdAt` / `activatedAt` / `rolledBackAt` | present | present (L1) | only `createdAt` | ⚠️ Medium |

**Why this is Block-level**:
1. **Semantic identity mismatch**: shared contract uses `connectorId`; body-connector uses `platform_id` + `plan_id`; memory uses `connectorId`. Implementers will map `connectorId` to `platformId` implicitly, which is not documented.
2. **Gate result shape mismatch**: shared contract says `gateResults: GateResult[]`; body-connector splits gates into individual typed fields (`schemaGate`, `permissionGate`, ...); memory stores a JSON string. These three shapes cannot be consumed by a single port without a custom adapter that is not specified.
3. **Version identity mismatch**: shared contract `versionId: string` vs memory `version: integer`. This breaks cross-system references to a specific connector version.
4. **Missing canonical fields**: memory-continuity-system drops `workspaceRoot`, `planType`, `manifestPath`, `recipePath`, `adapterPath`, `declaredCapabilities`, `previousStableRef`, `rollbackRef`, `rollbackCommandHint`, `activatedAt`, `rolledBackAt`. If these live inside `payloadJson`, the mapping is not explicit.
5. **Cardinality / nullability mismatch**: shared contract marks `previousStableRef` optional; memory-continuity-system L1 marks it `not null`.

**Suggested fix**:
- Treat `shared-v9-contracts.md` §7 as canonical runtime contract.
- Update `body-connector-system.detail.md` §2 to use `gateResults: GateResult[]` (or explicitly document the per-gate expansion and the transformation to/from the canonical array).
- Update `memory-continuity-system.detail.md` §2 to either (a) adopt the canonical `ConnectorVersion` / `ConnectorEvolutionPlan` shape for read models, or (b) publish a clear storage-row → canonical-contract mapping table.
- Decide and document whether `connectorId` and `platformId` are synonyms in this context.
- Decide whether `versionId` is a string (shared) or integer (memory); align storage and runtime.

---

## Check 3 — `EmbodiedContext` in shared contracts vs control-context-system

**Verdict: PASS**

| Field | Shared (`shared-v9-contracts.md` §10) | `control-context-system.md` §6.1 / `.detail.md` §2 | Status |
|-------|--------------------------------------|---------------------------------------------------|--------|
| `characterFramePointer` | `ContextSlice<CharacterFramePointer>` | present | ✅ |
| `characterFrameProjection` | `ContextSlice<EmbodiedContextCharacterProjection>` | present | ✅ |
| Both present simultaneously | yes | yes | ✅ |
| All other slices (identity, goals, recentInteractions, toolExperience, acceptedDream, affordanceMap, selfHealth, selfContinuityCard, activeMemoryProjections, activeProceduralProjections, routineList, attentionSignals?, assembledAt) | present | present | ✅ |

No drift detected.

---

## Check 4 — `ToolRoutine` / `RoutineListItem` version type

**Verdict: PASS**

| Type | Field | Shared | body-connector-system | control-context-system | memory-continuity-system |
|------|-------|--------|----------------------|------------------------|--------------------------|
| `ToolRoutine` | `version` | `string` (semver) | `string` (L0/L1) | — | `text` (L1) |
| `RoutineListItem` | `version` | `string` | — | `string` (L0/L1) | — |

All locations use `string` / `text` for the version field.

---

## Check 5 — `SourceRef` canonical shape usage

**Verdict: PASS (with Low drift note)**

| System | Definition / Usage | Status |
|--------|-------------------|--------|
| `shared-v9-contracts.md` §1 | `{ family, id, label? }` + full `SourceRefFamily` union | canonical |
| `body-connector-system.detail.md` §2 | identical interface + full family union | ✅ |
| `control-context-system.detail.md` §2 | consumes `SourceRef[]` without redefinition | ✅ |
| `memory-continuity-system.detail.md` §2 | stores `sourceRefsJson` without redefining shape | ✅ |
| `character-continuity-system.detail.md` §2.4 | lists subset `evidence \| action \| routine \| character \| dream \| quiet \| connector` | ⚠️ Low |

**Low-drift finding**: `character-continuity-system.detail.md` §2.4 narrows the `family` union to a subset. This is acceptable if character system never emits `attention`, `capability_probe_result`, or `ledger` refs, but it should either reference the canonical union or explicitly state it is a domain-specific narrowing.

---

## Final Verdict

**BLOCK**

The `CharacterFrame`, `EmbodiedContext`, `ToolRoutine`/`RoutineListItem`, and `SourceRef` shapes are largely aligned, but **`ConnectorVersion` / `ConnectorEvolutionPlan` have Block-level drift between the shared contract, `body-connector-system`, and `memory-continuity-system`**. The mismatches involve field identity (`connectorId` vs `platformId`), version identity (`versionId: string` vs `version: integer`), gate-result shape (structured array vs per-gate fields vs JSON string), and missing canonical fields in the memory storage row.

**Recommendation**: Fix Check 2 drift before entering `/challenge`; the other checkpoints can be carried as Low notes into `/challenge` without blocking.
