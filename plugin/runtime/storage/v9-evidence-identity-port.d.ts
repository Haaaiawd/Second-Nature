/**
 * v9 Evidence Identity Port — Resolve stable evidence identity for attention-system.
 *
 * Core logic: Query the v8 evidence_item table (canonical identity owner in v9)
 * by platform + stable identity key, then map the row to StableEvidenceIdentity
 * with RepetitionKind. This port is read-only: it does not create evidence rows
 * and does not increment counters; normalization writes are owned by the v8
 * evidence ingestion path, which populates identity columns.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.md §4.2 §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §1.3 §3.1 §5.2`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §2`
 *
 * Dependencies:
 * - `src/storage/db/index.js` (StateDatabase)
 * - `src/storage/db/schema/v8-entities.js` (evidence_item)
 * - `src/shared/types/v9-contracts.js` (EvidenceItem, StableEvidenceIdentity)
 *
 * Boundary:
 * - Does not create evidence rows.
 * - Does not increment seenCount (write-side owner is evidence ingestion).
 * - Returns identity_unstable when source identity is unresolvable.
 *
 * Test coverage:
 * - tests/unit/attention/v9-attention-assembler.test.ts
 * - tests/integration/v9/stable-identity-attention.test.ts
 * - tests/integration/v9/repeated-feed-suppression.test.ts
 */
import type { StateDatabase } from "./db/index.js";
import type { EvidenceItem, EvidenceIdentityPort, StableEvidenceIdentity } from "../shared/types/v9-contracts.js";
export declare const createEvidenceIdentityPort: (db: StateDatabase) => EvidenceIdentityPort;
export type { EvidenceItem, StableEvidenceIdentity, EvidenceIdentityPort };
