/**
 * In-memory append-only audit store with hash-chain verification hooks.
 * v7 (DR-033): per-family lastHashCache for O(1) previousHash lookup.
 *
 * Core logic:
 * - reject broken previousHash links per audit family
 * - maintain in-memory lastHashCache so append() is O(1) regardless of store size
 * - seedFamilyHash() for post-restart backfill from DB latest record
 *
 * Test coverage: tests/unit/observability/audit-envelope.test.ts
 */
import type { AuditEnvelope } from "./audit-envelope.js";
export declare class AppendOnlyAuditStore {
    private readonly events;
    private readonly lastHashCache;
    append<T>(envelope: AuditEnvelope<T>): void;
    list(): readonly AuditEnvelope<unknown>[];
    /** O(1) per-family previousHash; falls back to global last when family omitted (backward compat). */
    lastRecordHash(family?: string): string | undefined;
    /**
     * Seed cache after process restart from DB latest record (DR-033 backfill).
     *
     * TODO(T-OBS.C.1): wire a startup bootstrap routine that queries the DB audit_log
     * table for the latest recordHash per family and calls seedFamilyHash().
     * Blocked: the observability DB schema does not yet have an audit_log table
     * with previousHash/recordHash columns; once added, backfill should be
     * invoked in the store constructor or at app bootstrap time.
     */
    seedFamilyHash(family: string, hash: string): void;
    /** Expose cached families for diagnostics / testing. */
    cachedFamilies(): readonly string[];
}
