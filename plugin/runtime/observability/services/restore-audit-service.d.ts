/**
 * RestoreAuditService — T-OBS.C.6
 *
 * Core logic:
 *   writeRestoreAudit() writes an audit log entry to AppendOnlyAuditStore
 *   every time a restore operation is attempted (success OR failure).
 *
 *   Audit payload includes:
 *     - restoreTarget, fromVersion, toVersion, triggeredBy, reason
 *     - completedEntities: entity kinds that were successfully restored
 *     - failedEntities: entity kinds that failed (for partial_restore_error)
 *     - excludedFields: fields NOT restored (credential / key material)
 *     - restoredFieldCount
 *   It NEVER includes actual field values or credential plaintext.
 *
 *   Atomicity strategy (DR-041):
 *     - audit write failure is fire-and-forget: state restore already happened,
 *       so we cannot roll it back. Return { ok: true, warnings: [...] }.
 *     - partial_restore_error: state-memory partially wrote; audit records
 *       completedEntities + failedEntities so operator can see what succeeded.
 *
 *   Credential exclusion:
 *     - RestoreAuditEvent.excludedFields lists credential / key fields.
 *     - Actual values of these fields are NEVER written to audit.
 *
 * Test coverage: tests/unit/observability/restore-audit-service.test.ts
 */
import type { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";
export type RestoreTarget = "goal" | "narrative" | "evidence" | "relationship";
export type RestoreTrigger = "operator" | "agent";
export interface RestoreAuditEvent {
    id: string;
    restoreTarget: RestoreTarget;
    fromVersion: string;
    toVersion: string;
    triggeredBy: RestoreTrigger;
    reason: string;
    /**
     * Entity kinds that were successfully written back to state.
     * Used for partial_restore_error traceability.
     */
    completedEntities: string[];
    /**
     * Entity kinds that failed to write back (partial restore).
     * Non-empty → partial_restore_error scenario.
     */
    failedEntities: string[];
    /**
     * Field names explicitly excluded from restore (credential / key fields).
     * These are listed here for audit trail but their VALUES are never stored.
     */
    excludedFields: string[];
    /** Number of non-excluded fields that were restored */
    restoredFieldCount: number;
    createdAt: string;
    traceId: string;
}
export interface WriteRestoreAuditResult {
    ok: boolean;
    /** Populated if audit write itself failed (fire-and-forget, state already changed) */
    warnings: string[];
}
/**
 * Write a restore audit entry to the AppendOnlyAuditStore.
 *
 * Must be called during (or immediately after) a restore operation.
 * Audit write failure is fire-and-forget (DR-041): the function never throws.
 *
 * Returns:
 *   { ok: true, warnings: [] }                    — audit written successfully
 *   { ok: true, warnings: ["audit_write_failed: restore_audit_missing"] }
 *                                                  — audit failed, state already changed
 */
export declare function writeRestoreAudit(event: RestoreAuditEvent, store: AppendOnlyAuditStore): Promise<WriteRestoreAuditResult>;
