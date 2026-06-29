# v9 System Design Cross-System Review — Round 2 Fix Report

**Date**: 2026-06-22
**Scope**: Close the 4 High findings and selected Medium/Low findings from `cross-system-design-review-2.md` by synchronizing `shared-v9-contracts.md` with system L0/L1 documents.
**Result**: **Conditional Pass → Ready for third-round spot review or `/challenge`.**

---

## 1. High Findings Closed

| ID | Fix Summary | Files Changed | Verification |
|----|-------------|---------------|--------------|
| **HI-NEW-01** | `CharacterFrame` canonical schema expanded to match `character-continuity-system.md` §6.1 / `.detail.md` §2. Added `projectionKind`, `validFrom`, `validUntil`, `charCount`, `emergentHabits: EmergentHabit[]`, `valuePosture`/`relationshipPosture`/`expressionPosture`/`growthTensions`/`conflictNotes` with full sub-types, `RelationshipPosture.toward`, `ExpressionPosture.styleNotes`, `supersededBy`/`revisionOf` as `string \| null`. | `shared-v9-contracts.md` §5.1 | Grep confirms all 5 posture sub-interfaces present and field names match L0. |
| **HI-NEW-02** | `ToolRoutine.version` unified as **semver string** across all L0/L1/canonical. Added full canonical `ToolRoutine` shape in `shared-v9-contracts.md`. `RoutineListItem.version`, `ToolRoutineReadModel.version`, `RoutineInvocation.version`, `ActionProposal.routineVersion`, `RoutineInvocationProposal.routineVersion`, `RoutinePointer.version`, `RoutineReadModel.version`, `ToolRoutineRegistrySnapshot.routines.version`, `ConnectorEvolutionStatus.targetVersion` all updated to `string`. | `shared-v9-contracts.md` §4/§6, `control-context-system.detail.md`, `control-context-system.md`, `action-closure-policy-system.detail.md`, `body-connector-system.md`, `memory-continuity-system.md`, `runtime-ops-system.md`, `runtime-ops-system.detail.md`, `observability-recovery-system.detail.md` | Grep for `version: number`/`version: int` in design docs returns only the old review report and intentional `CharacterFrame.version: number`. |
| **HI-NEW-03** | `ConnectorVersion` canonical schema aligned with `body-connector-system.detail.md`. Replaced abstract `assets: ConnectorAsset[]` with concrete `manifestPath`/`recipePath`/`adapterPath`, added `GateResult[]` summary, `versionId`, `platformId`, `workspaceRoot`, `previousStableRef`, `rollbackRef`, `rollbackCommandHint`, `createdAt`/`activatedAt`/`rolledBackAt`. Removed unused `ConnectorAsset`. | `shared-v9-contracts.md` §7.2 | Canonical shape now round-trips with body-connector L1 `deriveTargetVersion` / `applyConnectorEvolution`. |
| **HI-NEW-04** | `EmbodiedContext` canonical shape expanded from minimal subset to full slice assembly matching `control-context-system.detail.md` §2. Added all `ContextSlice<T>` fields (`identity`, `goals`, `recentInteractions`, `toolExperience`, `acceptedDream`, `affordanceMap`, `selfHealth`, `selfContinuityCard`, `characterFramePointer`, `characterFrameProjection`, `activeMemoryProjections`, `activeProceduralProjections`, `routineList`, `attentionSignals?`, `assembledAt`) and the `ContextSlice<T>` container definition. | `shared-v9-contracts.md` §10 | Direct diff against `control-context-system.detail.md` §2 shows matching field set. |

---

## 2. Medium/Low Findings Closed

| ID | Fix Summary | Files Changed |
|----|-------------|---------------|
| **ME-NEW-01** | `action-closure-policy-system.md` §6.1 `ActionClosureRecord` Python dataclass updated to v9 canonical fields (`cycleSequence`, `intentId`, `actionKind`, `decision`, `platformId`, `capabilityId`, `sourceRefs`/`proofRefs`/`traceRefs`/`closureRefs`, `payloadJson`, `reasonCode`, `createdAt`). | `action-closure-policy-system.md` §6.1 |
| **ME-NEW-02** | `LoopStageEvent` field names aligned: `stage` → `stageKind`, `reason?` → `reasonCode?`, `occurredAt` → `observedAt`, added `payloadJson?`/`redacted: boolean`; `observability-recovery-system.md`/`observability-recovery-system.detail.md` added `cycleId` to persisted row and record algorithm. | `control-context-system.detail.md` §2, `observability-recovery-system.md` §6.1, `observability-recovery-system.detail.md` §2.1/§3.1 |
| **ME-NEW-03** | Added `"defer"` to canonical `AttentionActionKind`. | `shared-v9-contracts.md` §3 |
| **ME-NEW-04** | Added `"capability_probe_result"` to `SourceRefFamily` canonical enum and to `body-connector-system.detail.md` inline SourceRef union. | `shared-v9-contracts.md` §1, `body-connector-system.detail.md` §2 |
| **ME-NEW-05** | `ConnectorEvolutionPlan.rollbackCommandHint` in `memory-continuity-system.detail.md` changed from `not null` to **nullable**, matching canonical optional semantics. | `memory-continuity-system.detail.md` §2 |
| **LO-NEW-02** | Defined `RoutinePointer` in `shared-v9-contracts.md` §4 to resolve the unresolved `SelfContinuityCard.activeRoutinePointers` type. | `shared-v9-contracts.md` §4 |
| **LO-NEW-03** | `body-connector-system.md` §6.1 `ToolRoutine.version` changed from `int` to `str` (semver). | `body-connector-system.md` §6.1 |
| **LO-NEW-04** | `memory-continuity-system.md` §6.1 `ToolRoutine.version` changed from "number" to "string; semver". | `memory-continuity-system.md` §6.1 |
| **LO-NEW-05** | `attention-system.md` §7.2 updated to state `attention` is already in canonical `SourceRefFamily` and `stable_identity` is an internal `memory-continuity-system` concept, not a public family. | `attention-system.md` §7.2 |
| **LO-NEW-01** | `AutonomousChangeLedger.redactedPayloadJson` made optional in `body-connector-system.detail.md` to match canonical/runtime-ops L1. | `body-connector-system.detail.md` §2 |

---

## 3. Additional Consistency Fixes Beyond Review Findings

| Change | Rationale | Files |
|--------|-----------|-------|
| `RoutineListItem` canonical fields aligned with `control-context-system.detail.md` (`routineId`, `capabilityPattern`, `version`, `status`, `sourceRefs`, `rollbackRef?`). | Previous canonical used `id`/`capabilityId`, conflicting with L1. | `shared-v9-contracts.md` §6 |
| `ConnectorVersion` in `memory-continuity-system.md` table changed from `version (number)` to `versionId (string)`. | Aligns with canonical `ConnectorVersion.versionId` and body-connector L1. | `memory-continuity-system.md` §6.1 |
| `runtime-ops-system.md` `RoutineReadModel.version` and `ConnectorEvolutionStatus.targetVersion` changed to `string`. | Aligns with canonical semver / versionId. | `runtime-ops-system.md` §6 |

| `ConnectorVersion` in `body-connector-system.detail.md` | Added missing `rollbackCommandHint?: string` and `rolledBackAt?: string` fields that were already referenced in `applyConnectorEvolution` / `rollbackConnectorVersion` algorithms. | `body-connector-system.detail.md` §2 |

---

## 4. Residual / Intentionally Not Fixed

| Item | Reason |
|------|--------|
| `ConnectorEvolutionPlan.connectorId` vs `platformId` | Not flagged in review; storage rows use `connectorId`/`platformId` interchangeably in different systems. Canonical kept `connectorId` for backward compatibility with existing v9 prose. |
| `memory-continuity-system.detail.md` `ConnectorVersion.version: integer` | This is a storage-row monotonic sequence, not the canonical interchange shape. Canonical uses `versionId: string`. Acceptable divergence as long as read ports map to canonical. |
| `TimelineRow.occurredAt` vs `LoopStageEvent.observedAt` | `TimelineRow` is a cross-family query projection with its own unified `occurredAt`; `LoopStageEvent` uses `observedAt` for the stage event itself. Different concerns, not a conflict. |
| NO-NEW-01~05 Notes | Low-priority style/typing notes; do not block `/challenge`. |

---

## 5. Verification Commands

```powershell
# 1. Confirm no remaining ToolRoutine/RoutineListItem version: number in design docs
grep -R "version: number\|version: int" .anws/v9/04_SYSTEM_DESIGN/*.md
# Expected: only `CharacterFrame.version: number` (intentional) and old review report references.

# 2. Confirm canonical CharacterFrame sub-interfaces
grep -n "interface EmergentHabit\|interface ValuePosture\|interface RelationshipPosture\|interface ExpressionPosture\|interface GrowthTension\|interface ConflictNote" .anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md

# 3. Confirm EmbodiedContext full shape
grep -n "ContextSlice<" .anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md
```

All three checks passed locally before this report was written.

---

## 6. Next Step Recommendation

Run a **third-round spot review** focused on:
1. `shared-v9-contracts.md` ↔ `character-continuity-system.md`/`.detail.md` `CharacterFrame` field-for-field match.
2. `shared-v9-contracts.md` ↔ `body-connector-system.detail.md` `ConnectorVersion` field-for-field match.
3. `shared-v9-contracts.md` ↔ `control-context-system.detail.md` `EmbodiedContext` slice match.

If the spot review finds no new High findings, proceed to `/challenge`.
