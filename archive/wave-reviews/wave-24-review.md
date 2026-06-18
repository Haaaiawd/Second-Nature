# Wave 24 Review — Connector Ecosystem Closure

## Scope

T3.1.2 CapabilityContractRegistry namespace routing, T1.3.1 connector init CLI, T5.1.3 ConnectorInventoryAudit.

## Code Review Findings

### ✅ Passed

- **T3.1.2**: `resolveCapability` supports `platformId:capability` namespaced routing and v5 explicit platform routing. Error semantics clear (ambiguous, unknown platform, unknown capability). 8 unit tests pass.
- **T5.1.3**: Schema wired into observability DB bootstrap SQL and schema index. `ConnectorInventoryLedger` provides `recordAudit`, `getLatestAudit`, `listAudits` with proper JSON deserialization. 6 unit tests pass.
- **T1.3.1**: Manifest stub generation with path safety, no-overwrite default, force overwrite, platformId sanitize, family/runnerKind customization. Registered in CLI commands and ops-router dispatch. 7 unit tests pass.
- Typecheck: clean. Build: clean.

### ⚠️ Issue Found & Fixed During Review

- **Path escape guard**: Initial sanitize regex `[^a-zA-Z0-9_-]` did not reject `.` or `..`, which would allow `path.join(connectorsDir, "..")` to escape the connector root. Added explicit rejection for `"."` and `".."` before regex sanitize, with unit test coverage.

### 🔍 Security Checklist

| Risk | Status | Note |
| --- | --- | --- |
| Arbitrary code execution via custom adapter | Mitigated | Manifest generates `custom_adapter_pending_trust` status; registry already blocks execution for pending trust (T3.1.1) |
| User file overwrite | Mitigated | No overwrite unless `force:true`; explicit opt-in |
| Path escape | Mitigated | Sanitize + explicit `.`/`..` rejection; always resolved under `.second-nature/connectors/` |
| Connector inventory vs execution telemetry confusion | Mitigated | InventoryAudit separate table from execution_attempts; distinct schema and Ledger |

## Test Summary

| Task | Tests | Pass | File |
| --- | --- | --- | --- |
| T3.1.2 | 8 | 8 | `tests/unit/connectors/t3-1-2-capability-registry.test.ts` |
| T1.3.1 | 7 | 7 | `tests/unit/cli/t1-3-1-connector-init.test.ts` |
| T5.1.3 | 6 | 6 | `tests/unit/observability/connector-inventory-ledger.test.ts` |
| **Total** | **21** | **21** | |

## Deliverables

- `src/connectors/base/manifest.ts` — `resolveCapability`, `findPlatformsForIntent`
- `src/cli/commands/connector-init.ts` — manifest generator with safety
- `src/cli/commands/index.ts` — `connector_init` command registration
- `src/cli/ops/ops-router.ts` — `connector_init` dispatch
- `src/observability/db/schema/connector-inventory.ts` — audit schema
- `src/observability/db/schema/index.ts` — export wiring
- `src/observability/db/index.ts` — bootstrap SQL wiring
- `src/observability/connector-inventory-ledger.ts` — Ledger service

## Verdict

Wave 24 **approved** after path escape fix. All 21 tests pass. Ready for settlement.
