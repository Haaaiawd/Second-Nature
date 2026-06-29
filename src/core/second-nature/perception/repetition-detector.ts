/**
 * RepetitionDetector — Resolve stable identity for v9 attention assembly.
 *
 * Core logic: Delegate identity resolution to the memory-continuity-system
 * EvidenceIdentityPort and return a StableEvidenceIdentity. The detector
 * itself does not write evidence rows.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §3.1`
 *
 * Dependencies:
 * - `src/storage/v9-evidence-identity-port.js` (EvidenceIdentityPort)
 * - `src/shared/types/v9-contracts.js` (EvidenceItem, StableEvidenceIdentity)
 *
 * Boundary:
 * - Read-only identity resolution.
 * - Does not create or mutate evidence rows.
 *
 * Test coverage: tests/unit/attention/v9-attention-assembler.test.ts
 */

import type { EvidenceItem, StableEvidenceIdentity } from "../../../shared/types/v9-contracts.js";
import type { EvidenceIdentityPort } from "../../../storage/v9-evidence-identity-port.js";

export interface RepetitionDetector {
  resolveStableIdentity(evidence: EvidenceItem): Promise<StableEvidenceIdentity>;
}

export function createRepetitionDetector(port: EvidenceIdentityPort): RepetitionDetector {
  return {
    async resolveStableIdentity(evidence: EvidenceItem): Promise<StableEvidenceIdentity> {
      return port.normalizeEvidenceIdentity(evidence);
    },
  };
}
