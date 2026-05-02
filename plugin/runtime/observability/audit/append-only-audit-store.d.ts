/**
 * In-memory append-only audit store with hash-chain verification hooks.
 *
 * Core logic: reject broken previousHash links; expose ordered envelopes for tests / local tooling.
 *
 * Test coverage: tests/unit/observability/audit-envelope.test.ts
 */
import type { AuditEnvelope } from "./audit-envelope.js";
export declare class AppendOnlyAuditStore {
    private readonly events;
    append<T>(envelope: AuditEnvelope<T>): void;
    list(): readonly AuditEnvelope<unknown>[];
    lastRecordHash(): string | undefined;
}
