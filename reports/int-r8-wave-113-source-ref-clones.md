# INT-R8 — Wave 113 SourceRef Clone Removal Gate

**Date**: 2026-06-16
**Scope**: T-SH.R.3, T-SH.R.4, T-SH.R.5
**Verdict**: PASS

## Summary

- Removed `ControlPlaneSourceRef` from source and plugin runtime artifacts.
- Replaced host-capability local `SourceRef` with canonical v8 `SourceRef`.
- Renamed life-evidence local `SourceRef` to `LifeEvidenceSourceRef` to preserve v7 storage semantics without colliding with canonical v8 `SourceRef`.
- Added `src/shared/source-ref-compat.ts` for explicit legacy `kind` ↔ canonical `family` boundary mapping.

## Contract Search

- `ControlPlaneSourceRef` in `src/**/*.ts`: 0 matches.
- `ControlPlaneSourceRef` in `plugin/runtime/**/*.d.ts`: 0 matches.
- local `SourceRef` declaration in `src/cli/host-capability/**/*.ts`: 0 matches.
- local `SourceRef` declaration in `src/storage/life-evidence/**/*.ts`: 0 matches.

## Verification

- `pnpm typecheck` PASS.
- `pnpm build` PASS.
- `pnpm build:plugin` PASS.
- Wave 113 targeted unit/storage/host tests: 57/57 PASS.
- Wave 113 targeted integration tests: 33/33 PASS + 2 historical INT-S3 skips.
- Wave 108-112 regression sample: 51/51 PASS.
- Review-fix targeted tests: 44/44 PASS.
- Wave-end code review: PASS; initial Medium adapter issue fixed and re-reviewed.

## Targeted Test Commands

```text
node --test dist/tests/unit/control-plane/t2-4-1-platform-intent.test.js dist/tests/unit/control-plane/intent-planner-source-ref-fallback.test.js dist/tests/unit/control-plane/t2-4-1-credential-route.test.js dist/tests/unit/control-plane/t2-1-5-narrative-update.test.js dist/tests/unit/core/outreach-judgment.test.js dist/tests/unit/cli/host-capability.test.js dist/tests/integration/storage/quiet-artifact-writer.test.js

node --test dist/tests/integration/control-plane/delivery-failed-fallback.test.js dist/tests/integration/control-plane/int-s3-outreach-delivery-quiet-closure.test.js dist/tests/integration/control-plane/t2-3-1-outreach-v6.test.js dist/tests/integration/control-plane/t2-4-2-source-backed-outreach-loop.test.js dist/tests/integration/control-plane/heartbeat-loop.test.js dist/tests/integration/control-plane/heartbeat-quiet-orchestration.test.js dist/tests/integration/cli/host-capability-probe.test.js dist/tests/integration/connectors/t3-3-1-real-connector-evidence.test.js dist/tests/integration/guidance/outreach-draft-contract.test.js

node --test dist/tests/unit/shared/source-ref-serialization.test.js dist/tests/unit/shared/v7-entities.test.js dist/tests/unit/storage/v8-state-stores.test.js dist/tests/integration/v8/runtime-recovery-closure.test.js dist/tests/integration/v8/content-bearing-living-loop.test.js

node --test dist/tests/unit/shared/source-ref-compat.test.js dist/tests/unit/shared/source-ref-serialization.test.js dist/tests/unit/control-plane/t2-1-5-narrative-update.test.js dist/tests/unit/core/outreach-judgment.test.js dist/tests/integration/control-plane/t2-3-1-outreach-v6.test.js dist/tests/integration/guidance/outreach-draft-contract.test.js
```

## Residual Scope

- Wave 114 still owns v8 dual-status schema cleanup.
- Wave 115 still owns remaining v8 `sourceRefsJson` serializer migration.
