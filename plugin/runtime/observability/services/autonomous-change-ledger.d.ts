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
import type { StateDatabase } from "../../storage/db/index.js";
import { parseSourceRefs, type WriteAutonomousChangeLedgerOptions } from "../../storage/v9-state-stores.js";
import type { AutonomousChangeLedgerEntry, AutonomousChangeLedgerWritePort, AutonomousChangeKind, AutonomousChangeStatus, SourceRef } from "../../shared/types/v9-contracts.js";
export interface RedactedLedgerEntry {
    id: string;
    workspaceRoot: string;
    changeKind: AutonomousChangeKind;
    targetId: string;
    previousStableRef?: string;
    status: AutonomousChangeStatus;
    rollbackRef?: string;
    rollbackCommandHint?: string;
    sourceRefs: SourceRef[];
    createdAt: string;
    activatedAt?: string;
    rolledBackAt?: string;
    redactedPayloadJson?: string;
}
export interface CreateLedgerEntryOptions extends Omit<WriteAutonomousChangeLedgerOptions, "id" | "createdAt"> {
    id?: string;
    createdAt?: string;
}
export declare class AutonomousChangeLedgerService implements AutonomousChangeLedgerWritePort {
    private db;
    constructor(db: StateDatabase);
    writeLedgerEntry(entry: AutonomousChangeLedgerEntry): Promise<void>;
    write(entry: Partial<WriteAutonomousChangeLedgerOptions> & {
        workspaceRoot: string;
        changeKind: AutonomousChangeKind;
        targetId: string;
        sourceRefs: SourceRef[];
    }): Promise<AutonomousChangeLedgerEntry>;
    readById(id: string): Promise<AutonomousChangeLedgerEntry | undefined>;
    readByTarget(targetId: string, limit?: number): Promise<{
        entries: AutonomousChangeLedgerEntry[];
        degraded?: {
            reason: string;
        };
    }>;
    readByStatus(status: AutonomousChangeStatus): Promise<{
        entries: AutonomousChangeLedgerEntry[];
        degraded?: {
            reason: string;
        };
    }>;
    readRedactedByTarget(targetId: string, limit?: number): Promise<RedactedLedgerEntry[]>;
    activate(id: string, opts?: {
        rollbackRef?: string;
        rollbackCommandHint?: string;
    }): Promise<void>;
    rollBack(id: string, opts?: {
        rollbackRef?: string;
        rollbackCommandHint?: string;
    }): Promise<void>;
    gate(id: string, gateResultsJson: string): Promise<void>;
    block(id: string, reasonCode: string): Promise<void>;
    private mapRecordToEntry;
    private toRedacted;
}
export { parseSourceRefs };
