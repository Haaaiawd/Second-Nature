/**
 * JudgmentEngine — Produce JudgmentVerdict records from PerceptionCard.
 *
 * Core logic: Read a PerceptionCard, apply rules-only decision tree, and
 * write a source-backed JudgmentVerdict. No model assist; deterministic
 * verdict based on relevance, risk flags, source refs, and confidence.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.detail.md §3.3`
 * - `.anws/v8/04_SYSTEM_DESIGN/perception-judgment-system.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readPerceptionCardById, writeJudgmentVerdict)
 * - `src/shared/types/v8-contracts.js` (PlatformNeutralActionKind, SourceRef,
 *   DegradedOperationResult, V8ReasonCode, ACTION_KIND_REGISTRY)
 *
 * Boundary:
 * - Does not execute actions; produces verdict only.
 * - Does not write long-term memory; only emits review intent.
 * - Degrades gracefully on missing card or unreadable state.
 *
 * Test coverage: tests/unit/judgment/judgment-engine.test.ts
 */
import { readPerceptionCardById, writeJudgmentVerdict, } from "../../../storage/v8-state-stores.js";
import { parseSourceRefs } from "../../../shared/serialization.js";
import { ACTION_KIND_REGISTRY } from "../../../shared/types/v8-contracts.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";
// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────
const MIN_EXTERNAL_ACTION_CONFIDENCE = 0.70;
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function inferRiskPosture(sensitivityClass, riskFlags) {
    if (sensitivityClass === "sensitive" || riskFlags.includes("credential_shape_detected")) {
        return "blocked";
    }
    if (sensitivityClass === "private_context" || riskFlags.includes("private_context")) {
        return "high";
    }
    if (sensitivityClass === "public_technical") {
        return "medium";
    }
    return "low";
}
function selectVerdict(relevance, confidence, riskPosture, hasSourceRefs, possibleIntents) {
    // Missing source refs → ignore/watch only
    if (!hasSourceRefs) {
        return {
            actionKind: relevance > 0.5 ? "watch" : "ignore",
            reason: "judgment_missing_source_refs",
            finalConfidence: 0.5,
        };
    }
    // Risk blocked → watch or notify_owner only, no external write
    if (riskPosture === "blocked") {
        return {
            actionKind: relevance > 0.5 ? "notify_owner" : "watch",
            reason: "proposal_risk_blocked",
            finalConfidence: 0.6,
        };
    }
    // Low confidence → no auto/draft external write
    const canExternalWrite = confidence >= MIN_EXTERNAL_ACTION_CONFIDENCE;
    // Low relevance → ignore/watch
    if (relevance <= 0.3) {
        return {
            actionKind: relevance > 0.15 ? "watch" : "ignore",
            reason: "judgment_low_confidence",
            finalConfidence: 0.4,
        };
    }
    // Medium/high relevance + low risk → actionable
    const preferredIntent = possibleIntents.find((intent) => {
        const meta = ACTION_KIND_REGISTRY[intent];
        if (!meta)
            return false;
        if (meta.sideEffectClass === "external_write" && !canExternalWrite)
            return false;
        if (meta.sideEffectClass === "external_write" && riskPosture === "high")
            return false;
        return true;
    });
    if (preferredIntent) {
        return {
            actionKind: preferredIntent,
            reason: "proposal_created",
            finalConfidence: confidence,
        };
    }
    // Fallback to watch if no actionable intent allowed
    return {
        actionKind: "watch",
        reason: "judgment_low_confidence",
        finalConfidence: 0.5,
    };
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function runAgentJudgment(db, perceptionCardId, options) {
    const now = options?.now ?? new Date().toISOString();
    const readResult = await readPerceptionCardById(db, perceptionCardId);
    if (readResult.degraded) {
        return readResult.degraded;
    }
    const card = readResult.row;
    if (!card) {
        return {
            status: classifyDegradedStatus("state_unreadable"),
            reason: "state_unreadable",
            ownerStage: "judgment",
            sourceRefs: [],
            operatorNextAction: `PerceptionCard ${perceptionCardId} not found`,
            retryable: false,
        };
    }
    const sourceRefs = parseSourceRefs(card.sourceRefsJson);
    const hasSourceRefs = sourceRefs.length > 0;
    // Parse sensitivity class from payload (stored there by perception-builder)
    let sensitivityClass = "public_general";
    if (card.payloadJson) {
        try {
            const payload = JSON.parse(card.payloadJson);
            if (payload.sensitivityClass)
                sensitivityClass = String(payload.sensitivityClass);
        }
        catch {
            /* ignore */
        }
    }
    const riskPosture = inferRiskPosture(sensitivityClass, card.riskFlagsJson ? JSON.parse(card.riskFlagsJson) : []);
    // Parse possible intents from payload
    let possibleIntents = ["watch"];
    if (card.payloadJson) {
        try {
            const payload = JSON.parse(card.payloadJson);
            if (payload.possibleIntents && Array.isArray(payload.possibleIntents)) {
                possibleIntents = payload.possibleIntents;
            }
        }
        catch {
            /* ignore */
        }
    }
    let { actionKind, reason, finalConfidence } = selectVerdict(card.relevance ?? 0.3, card.confidence ?? 0.6, riskPosture, hasSourceRefs, possibleIntents);
    // T-DQ.R.3: Boost verdict when accepted memory projection matches topic
    const acceptedProjections = options?.acceptedProjections ?? [];
    const matchingProjection = acceptedProjections.find((p) => p.topicKey.toLowerCase() === (card.topic ?? "").toLowerCase());
    if (matchingProjection) {
        finalConfidence = Math.min(0.95, finalConfidence + 0.1);
        if (actionKind === "ignore") {
            actionKind = "remember";
            reason = "projection_topic_matched";
        }
    }
    const verdict = {
        id: `jud_${perceptionCardId}_${now.replace(/[:.]/g, "")}`,
        cycleId: card.cycleId,
        perceptionCardId,
        actionKind,
        confidence: finalConfidence,
        reason,
        riskPosture,
        sourceRefs: hasSourceRefs
            ? sourceRefs
            : [
                {
                    uri: `sn://judgment/missing_source_refs/${perceptionCardId}`,
                    family: "judgment",
                    id: perceptionCardId,
                    redactionClass: "none",
                    resolveStatus: "missing",
                },
            ],
        createdAt: now,
    };
    const writeResult = await writeJudgmentVerdict(db, {
        id: verdict.id,
        createdAt: now,
        cycleId: verdict.cycleId,
        perceptionCardId: verdict.perceptionCardId,
        actionKind: verdict.actionKind,
        confidence: verdict.confidence,
        reason: verdict.reason,
        riskPosture: verdict.riskPosture,
        sourceRefs: verdict.sourceRefs,
        redactionClass: riskPosture === "blocked" ? "blocked" : "none",
        lifecycleStatus: "pending",
        payloadJson: JSON.stringify({
            possibleIntents,
            sensitivityClass,
        }),
    });
    if ("reason" in writeResult) {
        return {
            status: classifyDegradedStatus(writeResult.reason),
            reason: writeResult.reason,
            ownerStage: "judgment",
            sourceRefs: [],
            operatorNextAction: `Failed to persist JudgmentVerdict: ${writeResult.reason}`,
            retryable: true,
        };
    }
    return {
        status: riskPosture === "blocked" ? "blocked" : "completed",
        verdicts: [verdict],
        reason,
    };
}
export async function runAgentJudgments(db, perceptionCardIds, options) {
    const succeeded = [];
    const failed = [];
    for (const perceptionCardId of perceptionCardIds) {
        const result = await runAgentJudgment(db, perceptionCardId, options);
        if ("verdicts" in result) {
            if (result.status === "completed" || result.status === "blocked") {
                succeeded.push(...result.verdicts);
            }
            else {
                failed.push({
                    perceptionCardId,
                    degraded: {
                        status: classifyDegradedStatus(result.reason ?? "judgment_low_confidence"),
                        reason: result.reason ?? "judgment_low_confidence",
                        ownerStage: "judgment",
                        sourceRefs: [],
                        operatorNextAction: `Judgment failed for ${perceptionCardId}`,
                        retryable: true,
                    },
                });
            }
        }
        else {
            failed.push({
                perceptionCardId,
                degraded: result,
            });
        }
    }
    return { succeeded, failed };
}
