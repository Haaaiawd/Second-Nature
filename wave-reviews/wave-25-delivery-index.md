# Wave 25 Delivery Index

## Tasks Closed

| Task | PRD/Design Ref | Impl Files | Test Files | Evidence |
| --- | --- | --- | --- | --- |
| **T1.2.3** | `04_SYSTEM_DESIGN/cli-system.md` §5.1, §9 | `src/cli/commands/connector-status.ts`, `src/cli/commands/index.ts`, `src/cli/ops/ops-router.ts` | `tests/unit/cli/t1-2-3-connector-status.test.ts` | 8 tests pass |
| **T3.2.1** | `04_SYSTEM_DESIGN/connector-system.md` §11 | `tests/fixtures/connectors/{moltbook,instreet,evomap}/manifest.yaml` | `tests/unit/connectors/t3-2-1-v5-parity.test.ts` | 5 tests pass |

## Changes Summary

### New Files (9)

- `src/cli/commands/connector-status.ts` — `connectorStatus` + `connectorTest` implementations
- `tests/unit/cli/t1-2-3-connector-status.test.ts` — 8 tests
- `tests/fixtures/connectors/moltbook/manifest.yaml` — v6 parity fixture
- `tests/fixtures/connectors/instreet/manifest.yaml` — v6 parity fixture
- `tests/fixtures/connectors/evomap/manifest.yaml` — v6 parity fixture
- `tests/unit/connectors/t3-2-1-v5-parity.test.ts` — 5 tests
- `wave-reviews/wave-25-review.md` — this review
- `wave-reviews/wave-25-delivery-index.md` — this index

### Modified Files (3)

- `src/cli/commands/index.ts` — register `connector_status` and `connector_test`
- `src/cli/ops/ops-router.ts` — add dispatch + `registry` dep
- `.anws/v6/05A_TASKS.md` — check off T1.2.3, T3.2.1

## Verification

- `pnpm run typecheck` — clean
- `pnpm run build` — clean
- Unit tests — 13/13 pass

## Outstanding Items

- INT-S1 集成验证（`reports/int-s1-v6-foundation-connector.md`）待 Sprint 1 收尾时执行
- `connector:status` read model 可进一步接入 `ConnectorInventoryLedger` 进行持久化 audit（T5.1.3 已提供接口，当前 `connectorStatus` 的 `ledger` 参数传 `undefined`）
