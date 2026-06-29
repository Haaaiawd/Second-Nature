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
export declare const SETUP_ACK_SCHEMA_VERSION = 1;
export type SetupAckPlacement = "workspace_guide" | "host_skill_registry" | "agent_profile" | "manual_operator_instruction";
export type SetupAckWriter = "setup_ack_command" | "host_setup_bridge";
export interface SetupAck {
    schemaVersion: typeof SETUP_ACK_SCHEMA_VERSION;
    acknowledgedAt: string;
    placedIn: SetupAckPlacement;
    placementProofRef: string;
    writer: SetupAckWriter;
    hostName?: string;
    hostVersion?: string;
    acceptedBy?: string;
    note?: string;
}
export interface SetupAckValidationResult {
    ok: true;
    ack: SetupAck;
}
export interface SetupAckValidationError {
    ok: false;
    field: string;
    reason: string;
    repairAction: string;
}
export type ValidateSetupAckResult = SetupAckValidationResult | {
    ok: false;
    errors: SetupAckValidationError[];
};
export declare function validateSetupAck(raw: Record<string, unknown>): ValidateSetupAckResult;
/**
 * Check whether a raw marker object can be considered a complete ack.
 * Hand-written files are treated as incomplete until verified.
 */
export declare function isSetupAckComplete(raw: Record<string, unknown>): {
    complete: true;
    ack: SetupAck;
} | {
    complete: false;
    errors: SetupAckValidationError[];
};
