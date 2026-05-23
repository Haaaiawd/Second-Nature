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

import { buildAuditEnvelope } from "../audit/audit-envelope.js";
import type { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Safe audit payload (no credential values) ───────────────────────────────

interface RestoreAuditPayload {
  restoreTarget: RestoreTarget;
  fromVersion: string;
  toVersion: string;
  triggeredBy: RestoreTrigger;
  reason: string;
  completedEntities: string[];
  failedEntities: string[];
  /** Credential/key field names excluded — no values */
  excludedFields: string[];
  restoredFieldCount: number;
  isPartialRestore: boolean;
  createdAt: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

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
export async function writeRestoreAudit(
  event: RestoreAuditEvent,
  store: AppendOnlyAuditStore
): Promise<WriteRestoreAuditResult> {
  // Build safe payload — NO credential values, only metadata
  const safePayload: RestoreAuditPayload = {
    restoreTarget: event.restoreTarget,
    fromVersion: event.fromVersion,
    toVersion: event.toVersion,
    triggeredBy: event.triggeredBy,
    reason: event.reason,
    completedEntities: event.completedEntities,
    failedEntities: event.failedEntities,
    excludedFields: event.excludedFields,
    restoredFieldCount: event.restoredFieldCount,
    isPartialRestore: event.failedEntities.length > 0,
    createdAt: event.createdAt,
  };

  try {
    const previousHash = store.lastRecordHash("restore.audit");
    const envelope = buildAuditEnvelope({
      family: "restore.audit",
      plane: "governance",
      traceId: event.traceId,
      sequence: store.list().length,
      payload: safePayload,
      previousHash,
      eventId: event.id,
      createdAt: event.createdAt,
    });

    store.append(envelope);
    return { ok: true, warnings: [] };
  } catch (err) {
    // Fire-and-forget: state restore already happened — do not re-throw
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: true,
      warnings: [`audit_write_failed: restore_audit_missing (${message})`],
    };
  }
}
