/**
 * AttentionAssembler — Orchestrate identity → score → validate → signal.
 *
 * Core logic: Convert a single evidence item into a source-backed
 * AttentionSignal. The signal is a body-level attention hint, not a final
 * Agent judgment. Optionally persists the signal to the v9 attention_signal
 * table.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.md §4 §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/attention-system.detail.md §3.6 §3.7`
 *
 * Dependencies:
 * - `src/storage/v9-evidence-identity-port.js` (EvidenceIdentityPort)
 * - `src/storage/v9-state-stores.js` (writeAttentionSignal)
 * - `src/shared/types/v9-contracts.js` (AttentionSignal, SourceRef)
 * - `repetition-detector.js`, `attention-scorer.js`, `attention-signal-validator.js`
 *
 * Boundary:
 * - Does not make final action decisions.
 * - Does not mutate ActivityThread state (only suggests thread lifecycle).
 * - Blocks signals with missing source refs.
 *
 * Test coverage: tests/unit/attention/v9-attention-assembler.test.ts
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import type { EvidenceIdentityPort } from "../../../storage/v9-evidence-identity-port.js";
import type { AttentionSignal } from "../../../shared/types/v9-contracts.js";
import { type RichEvidenceItem, type AttentionContext } from "./attention-scorer.js";
export interface AttentionAssemblerInput {
    evidence: RichEvidenceItem;
    context: AttentionContext;
}
export interface AttentionAssemblerDeps {
    identityPort: EvidenceIdentityPort;
    cycleId: string;
    cycleSequence?: number;
    db?: StateDatabase;
    now: string;
}
export interface AttentionAssemblerResult {
    signal: AttentionSignal;
    blocked: boolean;
}
export declare function assembleAttention(input: AttentionAssemblerInput, deps: AttentionAssemblerDeps): Promise<AttentionAssemblerResult>;
export type { RichEvidenceItem, AttentionContext };
