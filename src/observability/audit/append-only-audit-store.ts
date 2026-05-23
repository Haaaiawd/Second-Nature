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

export class AppendOnlyAuditStore {
  private readonly events: AuditEnvelope<unknown>[] = [];
  private readonly lastHashCache = new Map<string, string>();

  append<T>(envelope: AuditEnvelope<T>): void {
    const family = envelope.family;
    const cachedHash = this.lastHashCache.get(family);

    if (cachedHash !== undefined) {
      if (envelope.integrity.previousHash !== cachedHash) {
        throw new Error("audit_previous_hash_mismatch");
      }
    } else {
      // No family cache — first event for this family
      if (envelope.integrity.previousHash !== undefined) {
        throw new Error("audit_genesis_previous_hash");
      }
    }

    this.events.push(envelope as AuditEnvelope<unknown>);
    this.lastHashCache.set(family, envelope.integrity.recordHash);
  }

  list(): readonly AuditEnvelope<unknown>[] {
    return this.events;
  }

  /** O(1) per-family previousHash; falls back to global last when family omitted (backward compat). */
  lastRecordHash(family?: string): string | undefined {
    if (family) {
      return this.lastHashCache.get(family);
    }
    return this.events[this.events.length - 1]?.integrity.recordHash;
  }

  /** Seed cache after process restart from DB latest record (DR-033 backfill). */
  seedFamilyHash(family: string, hash: string): void {
    this.lastHashCache.set(family, hash);
  }

  /** Expose cached families for diagnostics / testing. */
  cachedFamilies(): readonly string[] {
    return Array.from(this.lastHashCache.keys());
  }
}
