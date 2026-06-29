# Wave 125 Code Review — 2026-06-27

## 1. Summary conclusion

**Pass** (static sense), with one residual Low item accepted.

All previously-flagged Medium/Low issues (M-1, M-2, M-3, L-1, L-2, L-4) are verified fixed in the reviewed files. The only remaining finding is L-3: `ContinuityReadPort.loadActiveMemoryProjections` / `loadActiveProceduralProjections` accept filter arguments but do not apply `workspaceRoot` / `now` constraints. This is acceptable as a residual because the `StateDatabase` is already scoped to a single workspace and the active/installed status filters are correctly applied; no cross-workspace leakage or wrong lifecycle rows can occur. The contract signature should still be tightened in a follow-up wave.

---

## 2. Review scope and static boundaries

**Read files:**
- `src/core/second-nature/memory/self-continuity-card-assembler.ts`
- `src/storage/v9-state-stores.ts`
- `src/shared/types/v9-contracts.ts`
- `src/storage/db/schema/v9-entities.ts`
- `tests/unit/memory/v9-self-continuity-card.test.ts`
- `tests/integration/v9/self-continuity-card-read.test.ts`

**Referenced for anchoring:**
- `.anws/v9/01_PRD.md`
- `.anws/v9/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md`
- `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md`
- `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`
- `.anws/v9/05A_TASKS.md`
- `.anws/v9/05B_VERIFICATION_PLAN.md`

**Not executed:** build, typecheck, tests, runtime, external services. Findings rely on static code/contract comparison only.

---

## 3. Contract → code mapping summary

| Canonical promise | Anchor | Implementation location | Verdict |
| ----------------- | ------ | ----------------------- | ------- |
| `SelfContinuityCard` runtime shape with 8 canonical sections | `shared-v9-contracts.md` §4 | `v9-contracts.ts:176-190`, `self-continuity-card-assembler.ts:108-116`, `buildCardSections:268-283` | Satisfied |
| Canonical section ordering | `shared-v9-contracts.md` §4 | `self-continuity-card-assembler.ts:108-116`, `serializeCardSections:285-308` | Satisfied |
| `cardText` bounded to ≤1200 chars with 4000-byte hard ceiling | PRD US-001, `memory-continuity-system.detail.md` §1 | `self-continuity-card-assembler.ts:75-80`, `countChars:126-129`, `applyCardBudget:310-344`; `v9-state-stores.ts:705-706` | Satisfied |
| Preserve `summary` and `characterFramePointer` under truncation | `shared-v9-contracts.md` §4 | `self-continuity-card-assembler.ts:330-344` | Satisfied |
| Return `continuity_unavailable` when no active data | `memory-continuity-system.detail.md` §3.7 | `self-continuity-card-assembler.ts:448-455` | Satisfied |
| Persist card and expose via `ContinuityReadPort.loadSelfContinuityCard` | `memory-continuity-system.md` §5.2 | `self-continuity-card-assembler.ts:477-489`, `:512-527`, `v9-state-stores.ts:698-770` | Satisfied |
| Source refs aggregated and deduplicated | `shared-v9-contracts.md` §4 | `self-continuity-card-assembler.ts:140-148`, `:346-358` | Satisfied |
| `SelfContinuityCard` contains only `CharacterFramePointer` | `shared-v9-contracts.md` §4, PRD US-008 | `self-continuity-card-assembler.ts:457-465` | Satisfied |
| `SelfContinuityCardRow` storage shape without `acceptedAt` | `shared-v9-contracts.md` §4 | `v9-contracts.ts:202-210`, `v9-entities.ts:179-196` | Fixed |
| Store boundary validates sourceRefs and byte budget | `memory-continuity-system.detail.md` §3.7 | `v9-state-stores.ts:701-706` | Fixed |
| No raw credential/private content in card | PRD §6.2, NG4 | `self-continuity-card-assembler.ts:82-106`, `:472-474`; test at `v9-self-continuity-card.test.ts:204-229` | Fixed |
| Integration test coverage for read port | `05A_TASKS.md` T5.2.2, `05B_VERIFICATION_PLAN.md#t5-2-2` | `tests/integration/v9/self-continuity-card-read.test.ts` | Fixed |

---

## 4. Lens summary

| Lens | Conclusion | Evidence |
| ---- | ---------- | -------- |
| **L1 Contract Fidelity** | Faithful. `acceptedAt` storage mismatch fixed. Integration test now exists. `ContinuityReadPort` signatures match shared contracts; only `loadActiveMemoryProjections` / `loadActiveProceduralProjections` ignore the `filters` argument (L-3 residual). | `v9-contracts.ts:202-210`, `v9-entities.ts:179-196`, `self-continuity-card-assembler.ts:559-568`, `tests/integration/v9/self-continuity-card-read.test.ts` |
| **L2 Task Fulfillment** | T5.2.2 outputs complete: `assembleSelfContinuityCard`, `ContinuityReadPort`, card store, unit tests, integration tests. | `self-continuity-card-assembler.ts:417-510`, `v9-state-stores.ts:682-770`, `tests/unit/memory/v9-self-continuity-card.test.ts`, `tests/integration/v9/self-continuity-card-read.test.ts` |
| **L3 Architecture Fit** | Clean separation: assembler is rules-only, delegates frame pointer to `character-frame-lifecycle`, persists via narrow ports. No abnormal coupling. | `self-continuity-card-assembler.ts:364-394`, `:444-445` |
| **L4 Static Runtime Risk & Safety** | Store boundary throws on empty sourceRefs and cardText > 4000 bytes. Custom sensitive-value scanner + `redactPayload` invoked before persistence. No raw credential leak path visible in scope. | `v9-state-stores.ts:701-706`, `self-continuity-card-assembler.ts:82-106`, `:472-474` |
| **L5 Verification Evidence** | Unit tests cover unavailable, full canonical ordering, frame pointer, source-ref aggregation, read-port round-trip, 1200-char budget, and credential-redaction. Integration tests cover cache hit/miss, routine/projection read ports, and budget. | `tests/unit/memory/v9-self-continuity-card.test.ts:91-243`, `tests/integration/v9/self-continuity-card-read.test.ts:92-173` |
| **L6 Backflow & Handoff** | No new public CLI/plugin surface introduced in this wave; handoff to T2.2.1 (`control-context-system`) is structurally ready via `ContinuityReadPort`. Integration test closes verification-plan backflow. | `self-continuity-card-assembler.ts:516-577` |

---

## 5. Issues

### Low

**L-3 (residual) | L1 | `ContinuityReadPort` filter arguments ignored**
- **Evidence:** `self-continuity-card-assembler.ts:559-568` defines `loadActiveMemoryProjections(filters)` and `loadActiveProceduralProjections(filters)`, but both call `readMemoryProjectionsByStatus(db, "active")` / `readProceduralProjectionsByStatus(db, "installed")` without passing `filters.workspaceRoot`, `filters.now`, or any additional status constraint.
- **Impact:** Minor contract incompleteness; the port signature promises filtering but the implementation does not apply it. Risk is benign because `StateDatabase` is already workspace-scoped and status filters are correct, so no cross-workspace leakage or lifecycle drift can occur.
- **Minimum fix:** Either thread `filters` into the underlying read calls (e.g., add `workspaceRoot` / temporal bounds to the query) or narrow the port signature if filtering is intentionally unsupported; update `shared-v9-contracts.md` if the signature changes.
- **Anchor:** `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md` §4 `ContinuityReadPort`.

---

## 6. Security / test coverage addendum

**Previous issue resolution status:**

| Issue | Previous severity | Status in this review | Evidence |
|-------|-------------------|----------------------|----------|
| M-1 UTF-8 bytes vs chars budget drift | Medium | **Fixed** | `self-continuity-card-assembler.ts:75-80`, `:126-129`, `:310-344`; tests assert `countChars(row!.cardText) <= 1200` at `tests/unit/memory/v9-self-continuity-card.test.ts:198` and `tests/integration/v9/self-continuity-card-read.test.ts:172` |
| M-2 `SelfContinuityCardRow.acceptedAt` schema mismatch | Medium | **Resolved** | `v9-contracts.ts:202-210`, `v9-entities.ts:179-196`; runtime maps `createdAt` → `acceptedAt` at `self-continuity-card-assembler.ts:592` |
| M-3 Missing explicit redaction gate and test | Medium | **Resolved** | Gate at `self-continuity-card-assembler.ts:82-106`, `:472-474`; test exercises credential pattern at `tests/unit/memory/v9-self-continuity-card.test.ts:204-229` |
| L-1 Store boundary does not re-validate sourceRefs or byte budget | Low | **Resolved** | `v9-state-stores.ts:701-706` throws on empty sourceRefs and cardText > 4000 bytes |
| L-2 Integration test file absent | Low | **Resolved** | `tests/integration/v9/self-continuity-card-read.test.ts` exists and covers assembly, cache hit/miss, unavailable, routine/projection ports, and budget |
| L-3 `loadActiveMemoryProjections` / `loadActiveProceduralProjections` ignore `filters` | Low | **Accepted residual** | `self-continuity-card-assembler.ts:559-568`; SQLite workspace scoping makes this benign |
| L-4 Unit tests do not assert explicit canonical section order in `cardText` | Low | **Resolved** | `tests/unit/memory/v9-self-continuity-card.test.ts:125-132` asserts full order: Summary → Body intuition → Relationship → Values → Habits → Active routines → Prohibitions → [character frame pointer] |

**Security:**
- No raw credential or private content is deliberately concatenated into the card; section builders consume only counts, status labels, capability patterns, and the bounded CharacterFrame pointer summary.
- `cardText` is stored as plain text; no encryption requirement exists for continuity projections in the current ADRs.
- The 4000-byte hard ceiling in `writeSelfContinuityCard` is fail-closed: if the assembler ever produced an oversized payload, the store would reject it. The assembler's char budget should prevent this path from being reached under normal English/ASCII-dominant content.

**Static-only caveats:**
- Runtime behavior of `redactPayload` and `redactSensitiveInline` on actual credential patterns was not dynamically verified.
- Actual `pnpm typecheck` / `pnpm test` results were not observed; findings assume the code compiles as written.
