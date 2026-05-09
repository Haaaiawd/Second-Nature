/**
 * Range-based hash-chain verification for append-only audit rows (T5.2.2 / INT-S3).
 *
 * Core logic: load events in [from, to], order by sequence, recompute recordHash and
 * verify previousHash links between consecutive **loaded** rows only (partial ranges
 * may start mid-chain; parent outside the slice is not validated). Empty or invalid
 * ranges yield incomplete (T5.2.2 / task verification plan).
 *
 * Dependencies: computeAuditRecordHash from audit-envelope; callers supply loadRange via deps.
 *
 * Test coverage: tests/unit/observability/verify-audit-hash-chain.test.ts
 */
import * as crypto from "node:crypto";

import type { AppendOnlyAuditStore } from "./append-only-audit-store.js";
import { computeAuditRecordHash, type AuditEnvelope, type AuditEventFamily } from "./audit-envelope.js";

export interface AuditExportRange {
  from: string;
  to: string;
  families?: AuditEventFamily[];
}

export type AuditHashChainVerificationStatus = "pass" | "broken" | "incomplete";

export interface AuditHashChainVerificationReport {
  reportId: string;
  generatedAt: string;
  range: AuditExportRange;
  checkedEventCount: number;
  status: AuditHashChainVerificationStatus;
  brokenAtEventIds: string[];
  reasons: string[];
}

export interface VerifyAuditHashChainDeps {
  loadRange(from: string, to: string, families?: AuditEventFamily[]): Promise<readonly AuditEnvelope<unknown>[]>;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function verifyAuditHashChain(
  range: AuditExportRange,
  deps: VerifyAuditHashChainDeps,
): Promise<AuditHashChainVerificationReport> {
  const generatedAt = new Date().toISOString();
  const reportId = crypto.randomUUID();

  if (range.from > range.to) {
    return {
      reportId,
      generatedAt,
      range,
      checkedEventCount: 0,
      status: "incomplete",
      brokenAtEventIds: [],
      reasons: ["invalid_range_from_after_to"],
    };
  }

  const raw = await deps.loadRange(range.from, range.to, range.families);
  const events = [...raw].sort((a, b) => a.sequence - b.sequence);

  if (events.length === 0) {
    return {
      reportId,
      generatedAt,
      range,
      checkedEventCount: 0,
      status: "incomplete",
      brokenAtEventIds: [],
      reasons: ["range_empty"],
    };
  }

  const brokenAtEventIds: string[] = [];

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]!;
    const expected = computeAuditRecordHash(event);
    if (event.integrity.recordHash !== expected) {
      brokenAtEventIds.push(event.eventId);
    }
    const prev = events[i - 1];
    if (prev && event.integrity.previousHash !== prev.integrity.recordHash) {
      brokenAtEventIds.push(event.eventId);
    }
  }

  const uniq = unique(brokenAtEventIds);
  const broken = uniq.length > 0;

  return {
    reportId,
    generatedAt,
    range,
    checkedEventCount: events.length,
    status: broken ? "broken" : "pass",
    brokenAtEventIds: uniq,
    reasons: broken ? ["hash_chain_broken"] : ["hash_chain_valid"],
  };
}

/** In-memory adapter: filter `AppendOnlyAuditStore.list()` by createdAt + optional families. */
export function createAppendOnlyAuditStoreRangeLoader(store: AppendOnlyAuditStore): VerifyAuditHashChainDeps {
  return {
    async loadRange(from: string, to: string, families?: AuditEventFamily[]) {
      const fams = families?.length ? new Set(families) : undefined;
      return store.list().filter((e) => {
        if (e.createdAt < from || e.createdAt > to) return false;
        if (fams && !fams.has(e.family)) return false;
        return true;
      });
    },
  };
}
