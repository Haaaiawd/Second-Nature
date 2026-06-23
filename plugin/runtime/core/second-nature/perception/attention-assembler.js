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
import * as crypto from "node:crypto";
import { writeAttentionSignal } from "../../../storage/v9-state-stores.js";
import { createRepetitionDetector } from "./repetition-detector.js";
import { scoreNovelty, scoreRelevance, scoreRisk, suggestActions, suggestActivityThread, generateSummary, } from "./attention-scorer.js";
import { validateAttentionSignal } from "./attention-signal-validator.js";
function buildSignalId(cycleId, evidenceId, now) {
    const hash = crypto
        .createHash("sha256")
        .update(`${cycleId}:${evidenceId}:${now}`)
        .digest("hex")
        .slice(0, 12);
    return `att-${evidenceId.slice(0, 32)}-${hash}`;
}
export async function assembleAttention(input, deps) {
    const detector = createRepetitionDetector(deps.identityPort);
    const identity = await detector.resolveStableIdentity(input.evidence);
    const novelty = scoreNovelty(identity.repetitionStatus);
    const relevance = scoreRelevance(input.evidence, input.context);
    const risk = scoreRisk(input.evidence);
    const actions = suggestActions(input.evidence, identity, input.context);
    const thread = suggestActivityThread(input.evidence, identity, input.context);
    const signalId = buildSignalId(deps.cycleId, input.evidence.id, deps.now);
    let status = "attentive";
    let reason;
    let summary = generateSummary(input.evidence, identity, relevance, risk);
    if (!input.evidence.sourceRefs || input.evidence.sourceRefs.length === 0) {
        status = "attention_blocked_missing_sources";
        reason = "missing_source_refs";
        summary = "(blocked) missing source refs";
    }
    else if (identity.repetitionStatus === "identity_unstable") {
        // identity_unstable is allowed to produce a degraded attentive hint,
        // but it must not promote routine signal and cannot suggest create thread.
        status = "degraded";
        reason = "identity_unstable";
    }
    const draft = {
        signalId,
        novelty,
        relevance,
        repetition: identity.repetitionStatus,
        risk,
        possibleActions: actions,
        sourceRefs: input.evidence.sourceRefs ?? [],
        summary,
        status,
        reason,
        activityThreadId: thread.activityThreadId,
        threadSuggestion: thread.threadSuggestion,
    };
    const { signal, blocked } = validateAttentionSignal(draft);
    if (deps.db) {
        try {
            await writeAttentionSignal(deps.db, {
                id: signal.signalId,
                createdAt: deps.now,
                cycleId: deps.cycleId,
                novelty: signal.novelty,
                relevance: signal.relevance,
                repetition: signal.repetition,
                status: signal.status,
                sourceRefs: signal.sourceRefs,
                evidenceRefs: [input.evidence.id],
                riskFlags: signal.risk === "none" ? undefined : [signal.risk],
                possibleActions: signal.possibleActions,
                activityThreadId: signal.activityThreadId,
                threadSuggestion: signal.threadSuggestion,
                payloadJson: JSON.stringify({
                    reason: signal.reason,
                    threadReason: thread.reason,
                    cycleSequence: deps.cycleSequence,
                }),
            });
        }
        catch {
            // Persistence is best-effort for the assembler; the signal is still returned.
        }
    }
    return { signal, blocked };
}
