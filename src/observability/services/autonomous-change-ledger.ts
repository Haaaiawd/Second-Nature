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
import type { StateDatabase } from "../../storage/db/index.js";
import {
  writeAutonomousChangeLedger,
  readAutonomousChangeLedgerById,
  readAutonomousChangeLedgerByTarget,
  readAutonomousChangeLedgerByStatus,
  updateAutonomousChangeLedgerStatus,
  parseSourceRefs,
  type WriteAutonomousChangeLedgerOptions,
} from "../../storage/v9-state-stores.js";
import type {
  AutonomousChangeLedgerEntry,
  AutonomousChangeLedgerWritePort,
  AutonomousChangeKind,
  AutonomousChangeStatus,
  SourceRef,
} from "../../shared/types/v9-contracts.js";

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
export interface CreateLedgerEntryOptions
  extends Omit<WriteAutonomousChangeLedgerOptions, "id" | "createdAt"> {
  id?: string;
  createdAt?: string;
}

export class AutonomousChangeLedgerService implements AutonomousChangeLedgerWritePort {
  constructor(private db: StateDatabase) {}

  async writeLedgerEntry(entry: AutonomousChangeLedgerEntry): Promise<void> {
    await this.write(entry);
  }

  async write(entry: Partial<WriteAutonomousChangeLedgerOptions> & { workspaceRoot: string; changeKind: AutonomousChangeKind; targetId: string; sourceRefs: SourceRef[] }): Promise<AutonomousChangeLedgerEntry> {
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

  async readById(id: string): Promise<AutonomousChangeLedgerEntry | undefined> {
    const record = await readAutonomousChangeLedgerById(this.db, id);
    return record ? this.mapRecordToEntry(record) : undefined;
  }

  async readByTarget(
    targetId: string,
    limit?: number,
  ): Promise<{ entries: AutonomousChangeLedgerEntry[]; degraded?: { reason: string } }> {
    const { rows, degraded } = await readAutonomousChangeLedgerByTarget(this.db, targetId, limit);
    return {
      entries: rows.map((r) => this.mapRecordToEntry(r)),
      degraded: degraded ? { reason: degraded.reason } : undefined,
    };
  }

  async readByStatus(
    status: AutonomousChangeStatus,
  ): Promise<{ entries: AutonomousChangeLedgerEntry[]; degraded?: { reason: string } }> {
    const { rows, degraded } = await readAutonomousChangeLedgerByStatus(this.db, status);
    return {
      entries: rows.map((r) => this.mapRecordToEntry(r)),
      degraded: degraded ? { reason: degraded.reason } : undefined,
    };
  }

  async readRedactedByTarget(targetId: string, limit = 50): Promise<RedactedLedgerEntry[]> {
    const { entries } = await this.readByTarget(targetId, limit);
    return entries.map((e) => this.toRedacted(e));
  }

  async activate(id: string, opts?: { rollbackRef?: string; rollbackCommandHint?: string }): Promise<void> {
    const now = new Date().toISOString();
    await updateAutonomousChangeLedgerStatus(this.db, id, "activated", {
      rollbackRef: opts?.rollbackRef,
      rollbackCommandHint: opts?.rollbackCommandHint,
      activatedAt: now,
    });
  }

  async rollBack(id: string, opts?: { rollbackRef?: string; rollbackCommandHint?: string }): Promise<void> {
    const now = new Date().toISOString();
    await updateAutonomousChangeLedgerStatus(this.db, id, "rolled_back", {
      rollbackRef: opts?.rollbackRef,
      rollbackCommandHint: opts?.rollbackCommandHint,
      rolledBackAt: now,
    });
  }

  async gate(id: string, gateResultsJson: string): Promise<void> {
    await updateAutonomousChangeLedgerStatus(this.db, id, "gated", { gateResultsJson });
  }

  async block(id: string, reasonCode: string): Promise<void> {
    await updateAutonomousChangeLedgerStatus(this.db, id, "blocked", {
      gateResultsJson: JSON.stringify([{ gate: "manual_block", passed: false, reason: reasonCode, evidenceRefs: [] }]),
    });
  }

  private mapRecordToEntry(record: {
    id: string;
    workspaceRoot: string;
    changeKind: string;
    targetId: string;
    previousStableRef: string | null;
    status: string;
    gateResultsJson: string | null;
    rollbackRef: string | null;
    rollbackCommandHint: string | null;
    sourceRefsJson: string;
    redactedPayloadJson: string | null;
    createdAt: string;
    activatedAt: string | null;
    rolledBackAt: string | null;
  }): AutonomousChangeLedgerEntry {
    return {
      id: record.id,
      workspaceRoot: record.workspaceRoot,
      changeKind: record.changeKind as AutonomousChangeKind,
      targetId: record.targetId,
      previousStableRef: record.previousStableRef ?? undefined,
      status: record.status as AutonomousChangeStatus,
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

  private toRedacted(entry: AutonomousChangeLedgerEntry): RedactedLedgerEntry {
    const { gateResultsJson: _, ...rest } = entry;
    return {
      ...rest,
      redactedPayloadJson: entry.redactedPayloadJson,
    };
  }
}

export { parseSourceRefs };
