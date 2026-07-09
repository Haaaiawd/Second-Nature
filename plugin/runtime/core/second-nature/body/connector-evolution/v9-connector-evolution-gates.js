/**
 * v9 Connector Evolution 7-Gate implementations (T6.3.1).
 *
 * Gate order per §4.2 decision tree (authoritative):
 *   Pre-activation:  schema → permission → sandbox → fixture → wet_probe → rollback_setup
 *   Post-activation: canary
 *
 * Each gate is a pure async function that receives the derived ConnectorVersion
 * + the original ConnectorEvolutionPlan + gate deps, and returns a GateResult.
 * Gates are intentionally lightweight structural validators in T6.3.1;
 * real adapter execution (fixture run, wet probe network call) is owned by
 * T6.3.2 connector rollback & v8 manifest migration.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §3.8 §4.2 §5`
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.md §5.1`
 * - ADR-004: Workspace-only autonomous connector evolution
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (gate + version + plan types)
 *
 * Boundary:
 * - Pure functions; no DB access, no filesystem, no network.
 * - Gate deps are injected for testability.
 *
 * Test coverage: `tests/unit/connectors/v9-connector-evolution-gates.test.ts`
 */
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function pass(gate, evidenceRefs = [], reason) {
    return { gate, passed: true, reason, evidenceRefs };
}
function fail(gate, reason, evidenceRefs = []) {
    return { gate, passed: false, reason, evidenceRefs };
}
export function parseProposedChanges(plan) {
    if (!plan.payloadJson)
        return {};
    try {
        const parsed = JSON.parse(plan.payloadJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
    }
    catch {
        // malformed payload
    }
    return {};
}
// ───────────────────────────────────────────────────────────────
// Gate 1: schema
// ───────────────────────────────────────────────────────────────
/**
 * Validate that the plan payload has a valid structure:
 * - manifestPath is a non-empty string
 * - declaredCapabilities is an array (possibly empty)
 */
export async function runSchemaGate(version, plan, _deps) {
    const changes = parseProposedChanges(plan);
    if (!changes.manifestPath || typeof changes.manifestPath !== "string") {
        return fail("schema", "manifestPath_missing_or_invalid", plan.sourceRefs);
    }
    if (changes.declaredCapabilities !== undefined && !Array.isArray(changes.declaredCapabilities)) {
        return fail("schema", "declaredCapabilities_not_array", plan.sourceRefs);
    }
    return pass("schema", plan.sourceRefs, "payload_structure_valid");
}
// ───────────────────────────────────────────────────────────────
// Gate 2: permission
// ───────────────────────────────────────────────────────────────
/**
 * Validate that declared capabilities don't expand beyond the platform's
 * allowed scope. If no allowed-capabilities provider is injected, falls back
 * to structural check (capabilities must match platformId prefix).
 */
export async function runPermissionGate(version, plan, deps) {
    const declared = version.declaredCapabilities;
    if (declared.length === 0) {
        return pass("permission", plan.sourceRefs, "no_declared_capabilities");
    }
    if (deps.getAllowedPlatformCapabilities) {
        const allowed = new Set(deps.getAllowedPlatformCapabilities(plan.platformId));
        const expanding = declared.filter((cap) => !allowed.has(cap));
        if (expanding.length > 0) {
            return fail("permission", `capabilities_exceed_platform_scope: ${expanding.join(", ")}`, plan.sourceRefs);
        }
    }
    else {
        // Structural fallback: each capability must start with platformId + ":"
        const prefix = `${plan.platformId}:`;
        const misaligned = declared.filter((cap) => !cap.startsWith(prefix));
        if (misaligned.length > 0) {
            return fail("permission", `capabilities_not_platform_scoped: ${misaligned.join(", ")}`, plan.sourceRefs);
        }
    }
    return pass("permission", plan.sourceRefs, "capabilities_within_scope");
}
// ───────────────────────────────────────────────────────────────
// Gate 3: sandbox
// ───────────────────────────────────────────────────────────────
/** Forbidden module patterns per §1.1 Sandbox Policy. */
const FORBIDDEN_MODULE_PATTERNS = [
    "child_process",
    "require(",
    "eval(",
    "Function(",
    "vm2",
    "import * as fs",
    "from 'fs'",
    'from "fs"',
    "from 'node:fs'",
    'from "node:fs"',
];
/**
 * Validate that the adapter code doesn't reference forbidden modules.
 * If an adapter sandbox safety checker is injected, uses it;
 * otherwise falls back to static pattern scan of adapterPath content.
 */
export async function runSandboxGate(version, plan, deps) {
    // If no adapter path, sandbox gate is trivially pass (manifest-only delta).
    if (!version.adapterPath) {
        return pass("sandbox", plan.sourceRefs, "no_adapter_path_manifest_only");
    }
    if (deps.checkAdapterSandboxSafety) {
        const result = deps.checkAdapterSandboxSafety(version.adapterPath);
        if (!result.safe) {
            return fail("sandbox", result.reason ?? "adapter_sandbox_violation", plan.sourceRefs);
        }
        return pass("sandbox", plan.sourceRefs, "adapter_sandbox_safe");
    }
    // Structural fallback: check adapterPath string for forbidden patterns.
    // In T6.3.1 this is a string-level check; T6.3.2 will read the actual file.
    const pathLower = version.adapterPath.toLowerCase();
    for (const pattern of FORBIDDEN_MODULE_PATTERNS) {
        if (pathLower.includes(pattern.toLowerCase())) {
            return fail("sandbox", `forbidden_module_reference: ${pattern}`, plan.sourceRefs);
        }
    }
    return pass("sandbox", plan.sourceRefs, "adapter_path_no_forbidden_references");
}
// ───────────────────────────────────────────────────────────────
// Gate 4: fixture
// ───────────────────────────────────────────────────────────────
/**
 * Validate that fixture data exists for the platform.
 * In T6.3.1 this is a structural check; T6.3.2 will run the adapter
 * against the fixture in a sandboxed worker.
 */
export async function runFixtureGate(version, plan, deps) {
    if (!deps.getFixtureData) {
        // No fixture provider injected — structural pass.
        return pass("fixture", plan.sourceRefs, "fixture_provider_not_configured_structural_pass");
    }
    const fixture = deps.getFixtureData(plan.platformId);
    if (fixture === undefined || fixture === null) {
        return fail("fixture", "no_fixture_data_for_platform", plan.sourceRefs);
    }
    return pass("fixture", plan.sourceRefs, "fixture_data_available");
}
// ───────────────────────────────────────────────────────────────
// Gate 5: wet_probe
// ───────────────────────────────────────────────────────────────
/**
 * Validate that wet-probe configuration exists for the platform.
 * In T6.3.1 this is a structural check; T6.3.2 will execute the real
 * read-only probe against the endpoint.
 */
export async function runWetProbeGate(version, plan, deps) {
    if (!deps.getWetProbeConfig) {
        return pass("wet_probe", plan.sourceRefs, "wet_probe_provider_not_configured_structural_pass");
    }
    const config = deps.getWetProbeConfig(plan.platformId);
    if (!config) {
        return fail("wet_probe", "no_wet_probe_config_for_platform", plan.sourceRefs);
    }
    if (!config.endpoint || typeof config.endpoint !== "string") {
        return fail("wet_probe", "wet_probe_endpoint_invalid", plan.sourceRefs);
    }
    return pass("wet_probe", plan.sourceRefs, "wet_probe_configured");
}
// ───────────────────────────────────────────────────────────────
// Gate 6: rollback_setup
// ───────────────────────────────────────────────────────────────
/**
 * Validate that a rollback path exists:
 * - If previousStableRef is set, it must resolve to a real version.
 * - If no previous stable, the rollbackCommandHint must indicate "no previous stable".
 */
export async function runRollbackSetupGate(version, plan, deps) {
    if (!version.previousStableRef) {
        // No previous stable — rollback_setup passes but hint must be generated.
        return pass("rollback_setup", plan.sourceRefs, "no_previous_stable_rollback_hint_required");
    }
    if (deps.getPreviousStableVersionId) {
        const previousId = deps.getPreviousStableVersionId(plan.platformId);
        if (!previousId || previousId !== version.previousStableRef) {
            return fail("rollback_setup", "previous_stable_ref_not_resolvable", plan.sourceRefs);
        }
    }
    return pass("rollback_setup", plan.sourceRefs, "rollback_path_verified");
}
// ───────────────────────────────────────────────────────────────
// Gate 7: canary (post-activation)
// ───────────────────────────────────────────────────────────────
/**
 * Post-activation canary health check.
 * Runs after the version is activated; failure triggers rollback.
 * In T6.3.1 this is a structural check; T6.3.2 will run real health probes.
 */
export async function runCanaryGate(version, plan, deps) {
    if (!deps.checkCanaryHealth) {
        return pass("canary", plan.sourceRefs, "canary_health_checker_not_configured_structural_pass");
    }
    const result = deps.checkCanaryHealth(plan.platformId, version.versionId);
    if (!result.healthy) {
        return fail("canary", result.reason ?? "canary_health_check_failed", plan.sourceRefs);
    }
    return pass("canary", plan.sourceRefs, "canary_healthy");
}
export const GATE_RUNNERS = {
    schema: runSchemaGate,
    permission: runPermissionGate,
    sandbox: runSandboxGate,
    fixture: runFixtureGate,
    wet_probe: runWetProbeGate,
    rollback_setup: runRollbackSetupGate,
    canary: runCanaryGate,
};
