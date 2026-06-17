# Wave 115 Code Review — 2026-06-16

## 1. 总结结论

**Verdict: Pass (static).**

Wave 115 re-review confirms the prior Medium and Low findings are closed. All v8-relevant `sourceRefsJson` parse/stringify now route through `src/shared/serialization.ts`; v7/non-canonical `SourceRef` modules remain untouched as allowed. No new public contracts or runtime dependencies were introduced. No Critical, High, Medium, or Low issues remain.

## 2. 审查范围与静态边界

Read anchors:

- `.anws/v8/05A_TASKS.md` Wave 115 T-SMS.R.5 and INT-R10: migrate all v8-relevant `sourceRefsJson` parse/stringify to `src/shared/serialization.ts`; v7 tables may keep their own handling if they do not use canonical `SourceRef` (**.anws/v8/05A_TASKS.md:1866-1901**).
- `.anws/v8/05B_VERIFICATION_PLAN.md` T-SMS.R.5 and INT-R10: risk is residual ad-hoc JSON handling drift; evidence is a search log plus updated tests (**.anws/v8/05B_VERIFICATION_PLAN.md:931-973**).
- INT-R10 report: lists migrated modules and claims 0 ad-hoc `JSON.parse`/`JSON.stringify` of `sourceRefsJson` remain in v8 modules (**reports/int-r10-wave-115-serialization-completion.md:7-17**).
- Search log: documents the regex used and the remaining v7/non-canonical ad-hoc sites (**logs/wave-115-source-refs-search.log:4-27**).
- Implementation files listed in the user scope.

Static boundary:

- No tests, build, typecheck, or SQLite runtime execution were run in this review.
- Re-review focuses on whether the prior Medium (M-1) and Low (L-1) findings from the first Wave 115 review are closed and whether any new static issues were introduced.

## 3. 契约 → 代码映射摘要

| Contract / task promise | Static implementation evidence |
| --- | --- |
| v8 state-store writes serialize canonical `SourceRef[]` through shared helper | `src/storage/v8-state-stores.ts` imports and calls `serializeSourceRefs` on every v8 `sourceRefsJson` write path (**src/storage/v8-state-stores.ts:71-72**, **src/storage/v8-state-stores.ts:134-1159**). |
| v8 state-store reads parse canonical `SourceRef[]` through shared helper | `src/storage/v8-state-stores.ts` uses `parseSourceRefs` when reading `sourceRefsJson` back (**src/storage/v8-state-stores.ts:1179-1181**). |
| `policy-bound-dispatch.ts` serializes source refs through shared helper | `serializeSourceRefs(decision.proofRefs)` and `serializeSourceRefs(proposal.sourceRefs)` replace prior `JSON.stringify` calls (**src/core/second-nature/action/policy-bound-dispatch.ts:29**, **src/core/second-nature/action/policy-bound-dispatch.ts:126**, **src/core/second-nature/action/policy-bound-dispatch.ts:142**, **src/core/second-nature/action/policy-bound-dispatch.ts:161**). |
| `action-proposal-builder.ts` parses verdict source refs through shared helper | `parseSourceRefs(verdict.sourceRefsJson)` replaces the prior local `parseVerdictSourceRefs` clone (**src/core/second-nature/action/action-proposal-builder.ts:30**, **src/core/second-nature/action/action-proposal-builder.ts:159**). |
| `judgment-engine.ts` parses card source refs through shared helper | `parseSourceRefs(card.sourceRefsJson)` replaces the prior local `parseCardSourceRefs` clone (**src/core/second-nature/perception/judgment-engine.ts:36**, **src/core/second-nature/perception/judgment-engine.ts:189**). |
| `living-loop-health-gate.ts` parses closure source refs through shared helper | `parseSourceRefs(closure.sourceRefsJson)` replaces prior `JSON.parse` (**src/observability/living-loop-health-gate.ts:30**, **src/observability/living-loop-health-gate.ts:106**). |
| `accepted-projection-loader.ts`, `perception-builder.ts`, `quiet-daily-review-builder.ts` parse through shared helper | Each module imports `parseSourceRefs` from `src/shared/serialization.js` and uses it at the read boundary (**src/core/second-nature/control-plane/accepted-projection-loader.ts:27**, **src/core/second-nature/control-plane/accepted-projection-loader.ts:106**; **src/core/second-nature/perception/perception-builder.ts:31**, **src/core/second-nature/perception/perception-builder.ts:229**; **src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:33**, **src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:121**, **src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:134**). |
| `memory-projection-lifecycle.ts` no longer carries unused import | The file no longer imports `parseSourceRefs` and keeps only its own `parsePayloadJson` helper for projection payload JSON (**src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts:24-35**, **src/core/second-nature/quiet-dream/memory-projection-lifecycle.ts:197-204**). |
| v7/non-canonical `SourceRef` modules left untouched | `src/storage/life-evidence/append-life-evidence.ts`, `src/storage/bootstrap/repair-gate.ts`, `src/storage/chronicle/session-chronicle-store.ts`, `src/storage/goal/agent-goal-store.ts`, `src/storage/services/goal-lifecycle-store.ts`, `src/storage/relationship/relationship-memory-store.ts`, `src/storage/narrative/narrative-state-store.ts`, `src/storage/fallback/write-operator-fallback.ts` still use `JSON.stringify` on non-canonical shapes; `src/storage/fallback/load-operator-fallback.ts` keeps a local helper for `LifeEvidenceSourceRef[]` (**logs/wave-115-source-refs-search.log:13-27**). |

## 4. Issues

No Critical issues.

No High issues.

No Medium issues.

No Low issues.

## 5. Lens 结果摘要

- **Lens 1 — Contract Fidelity: Pass.** All v8-relevant `sourceRefsJson` round-trips route through `src/shared/serialization.ts`. The prior local `parseVerdictSourceRefs` and `parseCardSourceRefs` clones are removed. v7/non-canonical modules remain excluded as allowed by the task contract.
- **Lens 2 — Task Fulfillment: Pass.** T-SMS.R.5 migration list is complete, and INT-R10 evidence now matches the code state. The previously missed v8 consumers (`action-proposal-builder.ts`, `judgment-engine.ts`) are now migrated.
- **Lens 3 — Architecture Fit: Pass.** No new abstraction layers or cross-boundary leaks are introduced; the shared serializer remains a pure dependency-free helper. The unused-import residue in `memory-projection-lifecycle.ts` is cleaned up.
- **Lens 4 — Runtime Risk From Static Evidence: Pass.** The shared serializer's silent-fail, array-only behavior is now the single implementation path for canonical v8 `SourceRef[]` JSON, eliminating future drift risk from duplicated local helpers.
- **Lens 5 — Verification Evidence: Pass.** INT-R10 report and search log are present; with the local clones removed, the reported "0 ad-hoc handling" is now consistent with the code. A semantic search confirms only `src/shared/serialization.ts` defines `parseSourceRefs` for canonical v8 `SourceRef[]`; the only remaining local helper is in `src/storage/fallback/load-operator-fallback.ts` for v7 `LifeEvidenceSourceRef[]`.
- **Lens 6 — Backflow & Handoff: Pass.** `05A_TASKS.md`, `05B_VERIFICATION_PLAN.md`, INT-R10 report, and the search log reflect Wave 115 completion. No new public contracts or runtime dependencies are introduced.

## 6. 安全 / 测试覆盖补充

- **No new public contracts or runtime dependencies**: All Wave 115 changes are internal refactorings to use an existing shared helper. No new exports, CLI commands, plugin surface, or external dependencies are introduced.
- **Search-pattern completeness**: With the local helper clones removed, the regex in `logs/wave-115-source-refs-search.log` now accurately reports 0 ad-hoc `JSON.parse`/`JSON.stringify` of `sourceRefsJson` in v8 modules.
- **Previous findings closed**: M-1 (residual v8 sourceRefsJson ad-hoc parsing) and L-1 (unused `parseSourceRefs` import in `memory-projection-lifecycle.ts`) from the first Wave 115 review are resolved.
