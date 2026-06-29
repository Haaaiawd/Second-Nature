/**
 * AutonomousChangeLedger — Append-only audit ledger for routine/connector
 * autonomous changes.
 *
 * Core logic: Record proposed/activated/rolled-back autonomous changes with
 * rollback hints, source refs, and redacted payload. Provide query by target,
 * status, and change kind.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/observability-recovery-system.detail.md §2.1 §3.2`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §8`
 *
 * Dependencies:
 * - `src/storage/v9-state-stores.js`
 * - `src/shared/types/v9-contracts.js`
 *
 * Boundary:
 * - Rejects entries with empty sourceRefs.
 * - Records canonical `AutonomousChangeLedgerEntry` shape.
 * - Read model exposes redacted payload only; full payload stays in state store.
 * - Append-only: writes never mutate existing rows.
 *
 * Test coverage:
 * - `tests/unit/observability/v9-ledger-store.test.ts`
 * - `tests/integration/v9/autonomous-change-ledger.test.ts`
 */
import { randomUUID } from "node:crypto";
import { writeAutonomousChangeLedger, readAutonomousChangeLedgerById, readAutonomousChangeLedgerByTarget, readAutonomousChangeLedgerByStatus, updateAutonomousChangeLedgerStatus, parseSourceRefs, } from "../../storage/v9-state-stores.js";
export class AutonomousChangeLedgerService {
    db;
    constructor(db) {
        this.db = db;
    }
    async writeLedgerEntry(entry) {
        await this.write(entry);
    }
    async write(entry) {
        if (entry.sourceRefs.length === 0) {
            throw new Error("autonomous_change_ledger sourceRefs required");
        }
        const now = entry.createdAt ?? new Date().toISOString();
        const record = await writeAutonomousChangeLedger(this.db, {
            id: entry.id ?? randomUUID(),
            createdAt: now,
            workspaceRoot: entry.workspaceRoot,
            changeKind: entry.changeKind,
            targetId: entry.targetId,
            previousStableRef: entry.previousStableRef,
            status: entry.status ?? "proposed",
            gateResultsJson: entry.gateResultsJson,
            rollbackRef: entry.rollbackRef,
            rollbackCommandHint: entry.rollbackCommandHint,
            sourceRefs: entry.sourceRefs,
            redactedPayloadJson: entry.redactedPayloadJson,
            activatedAt: entry.activatedAt,
            rolledBackAt: entry.rolledBackAt,
        });
        return this.mapRecordToEntry(record);
    }
    async readById(id) {
        const record = await readAutonomousChangeLedgerById(this.db, id);
        return record ? this.mapRecordToEntry(record) : undefined;
    }
    async readByTarget(targetId, limit) {
        const { rows, degraded } = await readAutonomousChangeLedgerByTarget(this.db, targetId, limit);
        return {
            entries: rows.map((r) => this.mapRecordToEntry(r)),
            degraded: degraded ? { reason: degraded.reason } : undefined,
        };
    }
    async readByStatus(status) {
        const { rows, degraded } = await readAutonomousChangeLedgerByStatus(this.db, status);
        return {
            entries: rows.map((r) => this.mapRecordToEntry(r)),
            degraded: degraded ? { reason: degraded.reason } : undefined,
        };
    }
    async readRedactedByTarget(targetId, limit = 50) {
        const { entries } = await this.readByTarget(targetId, limit);
        return entries.map((e) => this.toRedacted(e));
    }
    async activate(id, opts) {
        const now = new Date().toISOString();
        await updateAutonomousChangeLedgerStatus(this.db, id, "activated", {
            rollbackRef: opts?.rollbackRef,
            rollbackCommandHint: opts?.rollbackCommandHint,
            activatedAt: now,
        });
    }
    async rollBack(id, opts) {
        const now = new Date().toISOString();
        await updateAutonomousChangeLedgerStatus(this.db, id, "rolled_back", {
            rollbackRef: opts?.rollbackRef,
            rollbackCommandHint: opts?.rollbackCommandHint,
            rolledBackAt: now,
        });
    }
    async gate(id, gateResultsJson) {
        await updateAutonomousChangeLedgerStatus(this.db, id, "gated", { gateResultsJson });
    }
    async block(id, reasonCode) {
        await updateAutonomousChangeLedgerStatus(this.db, id, "blocked", {
            gateResultsJson: JSON.stringify([{ gate: "manual_block", passed: false, reason: reasonCode, evidenceRefs: [] }]),
        });
    }
    mapRecordToEntry(record) {
        return {
            id: record.id,
            workspaceRoot: record.workspaceRoot,
            changeKind: record.changeKind,
            targetId: record.targetId,
            previousStableRef: record.previousStableRef ?? undefined,
            status: record.status,
            gateResultsJson: record.gateResultsJson ?? undefined,
            rollbackRef: record.rollbackRef ?? undefined,
            rollbackCommandHint: record.rollbackCommandHint ?? undefined,
            sourceRefs: parseSourceRefs(record.sourceRefsJson),
            redactedPayloadJson: record.redactedPayloadJson ?? undefined,
            createdAt: record.createdAt,
            activatedAt: record.activatedAt ?? undefined,
            rolledBackAt: record.rolledBackAt ?? undefined,
        };
    }
    toRedacted(entry) {
        const { gateResultsJson: _, ...rest } = entry;
        return {
            ...rest,
            redactedPayloadJson: entry.redactedPayloadJson,
        };
    }
}
export { parseSourceRefs };
