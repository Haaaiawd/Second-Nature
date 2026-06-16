# Wave 113 Code Review — 2026-06-16

## Summary Conclusion

Pass.

Wave 113 closes its stated CH-12 slice: `ControlPlaneSourceRef` is removed from source and plugin runtime declarations, host-capability now imports/re-exports canonical v8 `SourceRef`, and life-evidence no longer declares a local type named `SourceRef`. The initial review found one Medium issue in the legacy `kind` ↔ canonical `family` reverse adapter; that issue was fixed and re-reviewed as Pass.

## Scope And Static Boundary

Reviewed inputs:

- `.anws/v8/05A_TASKS.md` Wave 113 T-SH.R.3, T-SH.R.4, T-SH.R.5, INT-R8.
- `.anws/v8/05B_VERIFICATION_PLAN.md` T-SH.R.3, T-SH.R.4, T-SH.R.5, INT-R8.
- `.anws/v8/07_CHALLENGE_REPORT.md` CH-12.
- `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md` SourceRef contract.
- Relevant `src/`, `plugin/runtime/`, tests, and `reports/int-r8-wave-113-source-ref-clones.md`.

Static boundary:

- Code-reviewer did not run tests.
- Runtime behavior and real package installation were not independently confirmed by static review.
- Separate verification evidence records `pnpm typecheck`, `pnpm build`, `pnpm build:plugin`, targeted tests, and regression samples in `reports/int-r8-wave-113-source-ref-clones.md`.

## Contract To Code Mapping

- Canonical SourceRef contract: `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md:40-63` defines `uri`, canonical `family`, `id`, required `redactionClass`, and optional sensitivity/resolve fields; implementation matches in `src/shared/types/v8-contracts.ts:65-100`.
- T-SH.R.3 control-plane clone removal: `src/core/second-nature/types.ts:1` imports canonical `SourceRef`; `CandidateIntent.sourceRefs` now uses `SourceRef[]` at `src/core/second-nature/types.ts:32-43`; plugin declaration mirrors this at `plugin/runtime/core/second-nature/types.d.ts:1-36`.
- T-SH.R.4 host-capability clone removal: `src/cli/host-capability/types.ts:6-7` imports/re-exports canonical `SourceRef`; host evidence refs use that imported type at `src/cli/host-capability/types.ts:34-76`; plugin declaration mirrors this at `plugin/runtime/cli/host-capability/types.d.ts:6-66`.
- T-SH.R.5 life-evidence rename: `src/storage/life-evidence/types.ts:18-31` declares `LifeEvidenceSourceRef`, not `SourceRef`; exported life-evidence shapes use `LifeEvidenceSourceRef[]` at `src/storage/life-evidence/types.ts:33-65`; plugin declaration mirrors this at `plugin/runtime/storage/life-evidence/types.d.ts:8-45`.
- Boundary adapter: `src/shared/source-ref-compat.ts:1-10` scopes compatibility to old/new system seams; mapping helpers are implemented at `src/shared/source-ref-compat.ts:28-90`; plugin runtime includes matching artifacts at `plugin/runtime/shared/source-ref-compat.d.ts` and `plugin/runtime/shared/source-ref-compat.js`.

## Lens Summary

- Lens 1, Contract Fidelity: Pass. Local clone removals match Wave 113 scope; canonical SourceRef is the control-plane and host-capability shape, while life-evidence preserves v7 semantics under `LifeEvidenceSourceRef`.
- Lens 2, Task Fulfillment: Pass. T-SH.R.3/T-SH.R.4/T-SH.R.5 outputs are present in code and plugin declarations; INT-R8 report exists at `reports/int-r8-wave-113-source-ref-clones.md:1-28`.
- Lens 3, Architecture Fit: Pass. Compatibility logic is centralized under `src/shared/source-ref-compat.ts:1-11` rather than recreated in each control-plane, host-capability, or life-evidence module.
- Lens 4, Static Runtime Risk: Pass. The prior lossy reverse mapping was fixed by preserving user-anchor identity before family fallback in `src/shared/source-ref-compat.ts:45-54`.
- Lens 5, Verification Evidence: Basically covered. INT-R8 report records typecheck/build/plugin build and targeted regressions at `reports/int-r8-wave-113-source-ref-clones.md:21-38`; adapter-specific tests cover the reviewed Medium fix in `tests/unit/shared/source-ref-compat.test.ts:21-40`.
- Lens 6, Backflow And Handoff: Pass. Tasks and verification tables are checked and point to INT-R8 evidence at `.anws/v8/05A_TASKS.md:1754-1822` and `.anws/v8/05B_VERIFICATION_PLAN.md:887-951`; changelog records Wave 113 completion in `.anws/v8/06_CHANGELOG.md`.

## Issues

No open Critical, High, Medium, or Low issues found.

## Resolved During Review

Severity: Medium | Lens: L1+L4+L5 | Title: Lossy SourceRef reverse adapter could relabel `user_anchor` as `platform_item` | Evidence before fix: `src/storage/user-interest/load-user-interest-snapshot.ts:19-25`, `src/shared/source-ref-compat.ts:34-36`, `src/shared/source-ref-compat.ts:51-53`, `src/core/second-nature/outreach/build-outreach-draft-request.ts:107-112`, `src/guidance/outreach-draft-schema.ts:9-17` | Fix: `src/shared/source-ref-compat.ts:45-54` now preserves `anchor:`/`curated:`/`USER.md`/`MEMORY.md` user anchors before family fallback, and `tests/unit/shared/source-ref-compat.test.ts:21-40` covers user-anchor and platform-evidence distinction | Status: Fixed and re-reviewed Pass.

## Safety And Testing Notes

- Static search found no remaining `ControlPlaneSourceRef` in `src` or `plugin/runtime` declarations.
- Static search found no local `SourceRef` declaration in `src/cli/host-capability` or `src/storage/life-evidence`; storage life-evidence now uses `LifeEvidenceSourceRef`.
- No raw credential exposure or external write enablement was found in the reviewed diff.
- E2E was not triggered; this wave changes type contracts and internal compatibility adapters, not user-facing UI or external host behavior.
