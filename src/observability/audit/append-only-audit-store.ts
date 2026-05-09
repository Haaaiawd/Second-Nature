/**
 * In-memory append-only audit store with hash-chain verification hooks.
 *
 * Core logic: reject broken previousHash links; expose ordered envelopes for tests / local tooling.
 *
 * Test coverage: tests/unit/observability/audit-envelope.test.ts
 */
import type { AuditEnvelope } from "./audit-envelope.js";

export class AppendOnlyAuditStore {
  private readonly events: AuditEnvelope<unknown>[] = [];

  append<T>(envelope: AuditEnvelope<T>): void {
    const last = this.events[this.events.length - 1];
    if (last) {
      if (envelope.integrity.previousHash !== last.integrity.recordHash) {
        throw new Error("audit_previous_hash_mismatch");
      }
    } else if (envelope.integrity.previousHash !== undefined) {
      throw new Error("audit_genesis_previous_hash");
    }

    this.events.push(envelope as AuditEnvelope<unknown>);
  }

  list(): readonly AuditEnvelope<unknown>[] {
    return this.events;
  }

  lastRecordHash(): string | undefined {
    return this.events[this.events.length - 1]?.integrity.recordHash;
  }
}
