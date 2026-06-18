# Wave 24 Delivery Index

## Tasks Closed

| Task | PRD/Design Ref | Impl Files | Test Files | Evidence |
| --- | --- | --- | --- | --- |
| **T3.1.2** | `04_SYSTEM_DESIGN/connector-system.md` §CapabilityContractRegistry | `src/connectors/base/manifest.ts` | `tests/unit/connectors/t3-1-2-capability-registry.test.ts` | 8 tests pass |
| **T1.3.1** | `04_SYSTEM_DESIGN/cli-system.md` §5.1, §9 | `src/cli/commands/connector-init.ts`, `src/cli/commands/index.ts`, `src/cli/ops/ops-router.ts` | `tests/unit/cli/t1-3-1-connector-init.test.ts` | 7 tests pass |
| **T5.1.3** | `04_SYSTEM_DESIGN/observability-system.md` §ConnectorInventoryAudit | `src/observability/db/schema/connector-inventory.ts`, `src/observability/db/schema/index.ts`, `src/observability/db/index.ts`, `src/observability/connector-inventory-ledger.ts` | `tests/unit/observability/connector-inventory-ledger.test.ts` | 6 tests pass |

## Changes Summary

### New Files (8)

- `src/connectors/base/manifest.ts` — `resolveCapability`, `findPlatformsForIntent`, `ResolvedConnectorCapability`
- `src/cli/commands/connector-init.ts` — manifest generator with path safety
- `src/observability/db/schema/connector-inventory.ts` — Drizzle schema for `connector_inventory_audit`
- `src/observability/connector-inventory-ledger.ts` — `ConnectorInventoryLedger` service
- `tests/unit/connectors/t3-1-2-capability-registry.test.ts` — 8 tests
- `tests/unit/cli/t1-3-1-connector-init.test.ts` — 7 tests
- `tests/unit/observability/connector-inventory-ledger.test.ts` — 6 tests
- `archive/wave-reviews/wave-24-review.md` — this review
- `archive/wave-reviews/wave-24-delivery-index.md` — this index

### Modified Files (5)

- `src/observability/db/schema/index.ts` — export `connectorInventoryAudit`
- `src/observability/db/index.ts` — bootstrap SQL for `connector_inventory_audit`
- `src/cli/commands/index.ts` — register `connector_init` command
- `src/cli/ops/ops-router.ts` — add `connector_init` dispatch
- `.anws/v6/05A_TASKS.md` — check off T3.1.2, T1.3.1, T5.1.3

## Verification

- `pnpm run typecheck` — clean
- `pnpm run build` — clean
- Unit tests — 21/21 pass

## Outstanding Items

- INT-S1 集成测试（`reports/int-s1-v6-foundation-connector.md`）待 T3.2.1 v5 parity 完成后进行
- `connector:status` / `connector:test` CLI 命令（T1.2.3 后续）待 ConnectorInventoryLedger 接入 ops surface
