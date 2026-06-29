/**
 * Setup Ack Truth Contract (T-ROS.R.8)
 *
 * Core logic: define the canonical SetupAck schema and a validator that rejects
 * `placedIn: "unspecified"`, missing fields, unknown writers, and hand-written
 * files that do not satisfy the schema.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md §3.2`
 *
 * Dependencies: none (plain validation to keep plugin load lightweight)
 * Boundary: Pure validation; no I/O.
 * Test coverage: tests/unit/shared/setup-ack-validator.test.ts
 */
export const SETUP_ACK_SCHEMA_VERSION = 1;
const VALID_PLACEMENTS = new Set([
    "workspace_guide",
    "host_skill_registry",
    "agent_profile",
    "manual_operator_instruction",
]);
const VALID_WRITERS = new Set([
    "setup_ack_command",
    "host_setup_bridge",
]);
export function validateSetupAck(raw) {
    const errors = [];
    if (raw.schemaVersion !== SETUP_ACK_SCHEMA_VERSION) {
        errors.push({
            ok: false,
            field: "schemaVersion",
            reason: `schemaVersion must be ${SETUP_ACK_SCHEMA_VERSION}`,
            repairAction: "Re-run setup_ack with a current client that writes schemaVersion=1.",
        });
    }
    const placedIn = typeof raw.placedIn === "string" ? raw.placedIn : undefined;
    if (!placedIn || placedIn === "unspecified") {
        errors.push({
            ok: false,
            field: "placedIn",
            reason: "placedIn is missing or 'unspecified'",
            repairAction: "Provide a concrete placement target such as 'workspace_guide' or 'host_skill_registry'.",
        });
    }
    else if (!VALID_PLACEMENTS.has(placedIn)) {
        errors.push({
            ok: false,
            field: "placedIn",
            reason: `placedIn '${placedIn}' is not a recognized placement target`,
            repairAction: `Use one of: ${Array.from(VALID_PLACEMENTS).join(", ")}.`,
        });
    }
    const placementProofRef = typeof raw.placementProofRef === "string" ? raw.placementProofRef : undefined;
    if (!placementProofRef || placementProofRef.trim().length === 0) {
        errors.push({
            ok: false,
            field: "placementProofRef",
            reason: "placementProofRef is missing or empty",
            repairAction: "Provide a proof reference such as a host skill registry id, file path, or anchor URI.",
        });
    }
    const writer = typeof raw.writer === "string" ? raw.writer : undefined;
    if (!writer || !VALID_WRITERS.has(writer)) {
        errors.push({
            ok: false,
            field: "writer",
            reason: `writer '${writer ?? "missing"}' is not authorized`,
            repairAction: `Writer must be one of: ${Array.from(VALID_WRITERS).join(", ")}.`,
        });
    }
    const acknowledgedAt = typeof raw.acknowledgedAt === "string" ? raw.acknowledgedAt : undefined;
    if (!acknowledgedAt || Number.isNaN(Date.parse(acknowledgedAt))) {
        errors.push({
            ok: false,
            field: "acknowledgedAt",
            reason: "acknowledgedAt is missing or not a valid ISO timestamp",
            repairAction: "Re-run setup_ack so the client can write a fresh timestamp.",
        });
    }
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    return {
        ok: true,
        ack: {
            schemaVersion: SETUP_ACK_SCHEMA_VERSION,
            acknowledgedAt: acknowledgedAt,
            placedIn: placedIn,
            placementProofRef: placementProofRef,
            writer: writer,
            hostName: typeof raw.hostName === "string" ? raw.hostName : undefined,
            hostVersion: typeof raw.hostVersion === "string" ? raw.hostVersion : undefined,
            acceptedBy: typeof raw.acceptedBy === "string" ? raw.acceptedBy : undefined,
            note: typeof raw.note === "string" ? raw.note : undefined,
        },
    };
}
/**
 * Check whether a raw marker object can be considered a complete ack.
 * Hand-written files are treated as incomplete until verified.
 */
export function isSetupAckComplete(raw) {
    const result = validateSetupAck(raw);
    if (result.ok) {
        return { complete: true, ack: result.ack };
    }
    return { complete: false, errors: result.errors };
}
