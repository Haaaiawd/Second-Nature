/**
 * v9 HeartbeatOrchestrator — Attention-to-closure heartbeat cycle.
 *
 * Core logic: Assemble EmbodiedContext, build AttentionSignal, advance
 * ActivityThread, resolve Agent/routine-authored intent, evaluate policy,
 * record exactly-one terminal closure, and trigger daily rhythm.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.1 §5`
 * - `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §4.1`
 * - ADR-002: Attention is not Agent mind
 * - ADR-005: Procedural memory as verified routine
 *
 * Dependencies:
 * - `src/core/second-nature/control-plane/v9-embodied-context-assembler.js`
 * - `src/core/second-nature/control-plane/activity-thread-coordinator.js`
 * - `src/core/second-nature/action/v9-action-proposal-builder.js`
 * - `src/core/second-nature/action/v9-autonomy-policy-evaluator.js`
 * - `src/core/second-nature/action/v9-action-closure-recorder.js`
 * - `src/storage/db/schema/v8-entities.js` (heartbeat_cycle_trace, loop_stage_event)
 * - `src/storage/v8-state-stores.js` (checkDailyRhythm)
 *
 * Boundary:
 * - Does NOT make semantic action decisions; intent must be authored by Agent or routine.
 * - Does NOT execute real external platform writes.
 * - AttentionSignal is a hint, not a final judgment.
 * - Every cycle produces exactly one terminal closure or explicit degraded reason.
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-attention-cycle.test.ts`
 * - `tests/integration/v9/attention-to-closure-chain.test.ts`
 */
import { desc } from "drizzle-orm";
import { heartbeatCycleTrace, loopStageEvent, } from "../../../storage/db/schema/v8-entities.js";
import { checkDailyRhythm } from "../quiet-dream/daily-rhythm-scheduler.js";
import { buildV9ActionProposal } from "../action/v9-action-proposal-builder.js";
import { evaluateV9ActionPolicy } from "../action/v9-autonomy-policy-evaluator.js";
import { recordV9NoActionClosure, recordV9PolicyOutcomeClosure, } from "../action/v9-action-closure-recorder.js";
import { classifyDegradedStatus } from "../../../shared/degraded-status-classifier.js";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function cycleRefSourceRef(cycleId) {
    return { family: "audit", id: cycleId, label: "cycle" };
}
function closureRefSourceRef(closureId) {
    return { family: "action_closure", id: closureId, label: "closure" };
}
function makeDegraded(reason, sourceRefs, detail) {
    return {
        status: classifyDegradedStatus(reason),
        reason: reason,
        ownerStage: "control_context",
        sourceRefs: sourceRefs,
        operatorNextAction: detail ?? "Retry heartbeat after control-context recovery",
        retryable: true,
    };
}
async function nextCycleSequence(db) {
    try {
        const rows = await db.db
            .select({ cycleSequence: heartbeatCycleTrace.cycleSequence })
            .from(heartbeatCycleTrace)
            .orderBy(desc(heartbeatCycleTrace.cycleSequence))
            .limit(1);
        return (rows[0]?.cycleSequence ?? 0) + 1;
    }
    catch {
        return 1;
    }
}
function buildCycleId(sequence, now) {
    return `cyc_v9_${now.replace(/[:.]/g, "")}_${sequence}`;
}
async function startCycleTrace(db, cycleId, cycleSequence, now) {
    const trace = {
        id: cycleId,
        cycleSequence,
        heartbeatStartedAt: now,
        heartbeatCompletedAt: null,
        inputCount: 0,
        outputCount: 0,
        status: "started",
        sourceRefsJson: JSON.stringify([cycleRefSourceRef(cycleId)]),
        redactionClass: "none",
        payloadJson: null,
    };
    try {
        await db.db.insert(heartbeatCycleTrace).values(trace);
        return null;
    }
    catch (err) {
        return makeDegraded("state_unreadable", [cycleRefSourceRef(cycleId)], `Cycle trace write failed: ${err instanceof Error ? err.message : String(err)}`);
    }
}
async function recordV9LoopStageEvent(db, event) {
    try {
        await db.db.insert(loopStageEvent).values({
            id: event.id,
            cycleId: event.cycleId,
            cycleSequence: event.cycleSequence,
            stage: event.stage,
            status: event.status,
            reason: event.reason,
            sourceRefsJson: JSON.stringify(event.sourceRefs ?? []),
            proofRefsJson: JSON.stringify(event.proofRefs ?? []),
            traceRefsJson: JSON.stringify(event.traceRefs ?? []),
            redactionClass: "none",
            occurredAt: event.occurredAt,
        });
    }
    catch {
        // Stage events are best-effort observability; do not block the cycle.
    }
}
async function advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now) {
    try {
        const rhythmResult = await checkDailyRhythm(db, { now });
        if ("status" in rhythmResult && rhythmResult.status === "checked") {
            await recordV9LoopStageEvent(db, {
                id: `evt_${cycleId}_daily_rhythm`,
                cycleId,
                cycleSequence,
                stage: "quiet",
                status: "completed",
                occurredAt: now,
                sourceRefs: [cycleRef],
            });
            return { rhythmState: rhythmResult.state };
        }
        const degraded = rhythmResult;
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_daily_rhythm`,
            cycleId,
            cycleSequence,
            stage: "quiet",
            status: "failed",
            reason: degraded.reason,
            occurredAt: now,
            sourceRefs: [cycleRef],
        });
        return { rhythmDegraded: degraded };
    }
    catch (rhythmErr) {
        const detail = rhythmErr instanceof Error ? rhythmErr.message : String(rhythmErr);
        const degraded = makeDegraded("state_unreadable", [cycleRef], `Daily rhythm check failed: ${detail.slice(0, 120)}`);
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_daily_rhythm`,
            cycleId,
            cycleSequence,
            stage: "quiet",
            status: "failed",
            reason: degraded.reason,
            occurredAt: now,
            sourceRefs: [cycleRef],
        });
        return { rhythmDegraded: degraded };
    }
}
function inferAffordancePosture(context, intent) {
    const map = context.affordanceMap?.data;
    // affordanceMap is currently typed as an empty interface in v9 contracts.
    // We probe for the shape produced by v9 affordance assembler.
    const entries = map?.entries ?? [];
    const match = entries.find((e) => e.platformId === (intent.targetPlatformId ?? "") &&
        e.capabilityId === (intent.targetCapabilityId ?? ""));
    if (match)
        return match;
    return {
        platformId: intent.targetPlatformId ?? "unknown",
        capabilityId: intent.targetCapabilityId ?? "unknown",
        accessLevel: "none",
        reliabilityLevel: "unproven",
        familiarityLevel: "scaffold",
        sourceRefs: [],
    };
}
// ───────────────────────────────────────────────────────────────
// Default ActionClosurePort
// ───────────────────────────────────────────────────────────────
function createDefaultActionClosurePort(db, context) {
    return {
        async evaluateAndDispatch(intent, cycleRef) {
            const proposalResult = buildV9ActionProposal({
                cycleId: cycleRef.cycleId,
                agentIntent: intent,
                attentionRefs: intent.attentionSignalRefs.map((ref) => ({
                    signalId: ref.id,
                    selectedActionKind: "watch",
                    rationale: "attention grounding",
                    sourceRefs: [ref],
                })),
                now: new Date().toISOString(),
            });
            if (proposalResult.status === "no_action") {
                return {
                    actionKind: "no_action",
                    decision: "deny",
                    reasonCode: proposalResult.reason,
                };
            }
            const proposal = proposalResult.proposal;
            const affordancePosture = inferAffordancePosture(context, intent);
            const policyContext = {
                affordancePosture,
                platformPermissionDeclared: false,
                circuitBreakerClosed: true,
                ownerPreference: false,
                credentialHealth: "ok",
            };
            const decision = evaluateV9ActionPolicy(proposal, policyContext, {
                now: new Date().toISOString(),
            });
            return {
                actionKind: proposal.actionKind,
                decision: decision.decision,
                reasonCode: decision.decisionReason,
                proposal,
                downgradedActionKind: decision.downgradedActionKind,
            };
        },
    };
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function runV9HeartbeatCycle(db, request, deps) {
    const now = request.requestedAt ?? new Date().toISOString();
    const cycleSequence = await nextCycleSequence(db);
    const cycleId = buildCycleId(cycleSequence, now);
    const cycleRef = cycleRefSourceRef(cycleId);
    if (request.runtimeAvailable === false) {
        return {
            cycleId,
            cycleSequence,
            status: "carrier_only",
            noActionReason: "runtime_unavailable",
        };
    }
    const traceError = await startCycleTrace(db, cycleId, cycleSequence, now);
    if (traceError) {
        return {
            cycleId,
            cycleSequence,
            status: "degraded",
            degraded: traceError,
        };
    }
    let context;
    try {
        context = await deps.assembler.assembleEmbodiedContext();
    }
    catch (assemblyErr) {
        const detail = assemblyErr instanceof Error ? assemblyErr.message : String(assemblyErr);
        const degraded = makeDegraded("continuity_unavailable", [cycleRef], `EmbodiedContext assembly failed: ${detail.slice(0, 120)}`);
        const closure = await recordV9NoActionClosure(db, cycleId, cycleSequence, "continuity_unavailable", {
            now,
            traceRefs: [cycleRef],
        });
        const closureRef = "id" in closure ? closureRefSourceRef(closure.id) : undefined;
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_context`,
            cycleId,
            cycleSequence,
            stage: "continuity",
            status: "failed",
            reason: degraded.reason,
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_closure`,
            cycleId,
            cycleSequence,
            stage: "closure",
            status: closureRef ? "completed" : "failed",
            reason: degraded.reason,
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        const { rhythmState, rhythmDegraded } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);
        return {
            cycleId,
            cycleSequence,
            status: "degraded",
            closureRef,
            noActionReason: "continuity_unavailable",
            degraded,
            rhythmState,
            rhythmDegraded,
        };
    }
    await recordV9LoopStageEvent(db, {
        id: `evt_${cycleId}_context`,
        cycleId,
        cycleSequence,
        stage: "continuity",
        status: "completed",
        occurredAt: new Date().toISOString(),
        sourceRefs: [cycleRef],
    });
    const actionClosurePort = deps.actionClosurePort ?? createDefaultActionClosurePort(db, context);
    // ── Evidence load (best-effort; AttentionPort may also load evidence itself) ──
    let evidenceItems = [];
    try {
        if (deps.evidenceReadPort) {
            evidenceItems = await deps.evidenceReadPort.loadRecentEvidence({ workspaceRoot: request.workspaceRoot, limit: 20 });
        }
    }
    catch {
        // Evidence load is advisory for attention grounding; degraded read does not block the cycle.
    }
    // ── Attention stage ──
    await recordV9LoopStageEvent(db, {
        id: `evt_${cycleId}_attention`,
        cycleId,
        cycleSequence,
        stage: "attention",
        status: "started",
        occurredAt: now,
        sourceRefs: [cycleRef],
    });
    const attentionResult = await deps.attentionPort.buildAttentionSignal({
        cycleId,
        cycleSequence,
        evidenceItems,
        embodiedContext: context,
    });
    if ("ownerStage" in attentionResult) {
        const degraded = attentionResult;
        const closure = await recordV9NoActionClosure(db, cycleId, cycleSequence, degraded.reason, {
            now,
            traceRefs: [cycleRef],
        });
        const closureRef = "id" in closure ? closureRefSourceRef(closure.id) : undefined;
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_attention`,
            cycleId,
            cycleSequence,
            stage: "attention",
            status: "failed",
            reason: degraded.reason,
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_closure`,
            cycleId,
            cycleSequence,
            stage: "closure",
            status: closureRef ? "completed" : "failed",
            reason: degraded.reason,
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        const { rhythmState, rhythmDegraded } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);
        return {
            cycleId,
            cycleSequence,
            status: "degraded",
            closureRef,
            noActionReason: degraded.reason,
            degraded,
            rhythmState,
            rhythmDegraded,
        };
    }
    const attention = attentionResult;
    if (attention.status === "attention_blocked_missing_sources") {
        const closure = await recordV9NoActionClosure(db, cycleId, cycleSequence, "attention_blocked_missing_sources", {
            now,
            traceRefs: attention.sourceRefs.length > 0 ? attention.sourceRefs : [cycleRef],
        });
        const closureRef = "id" in closure ? closureRefSourceRef(closure.id) : undefined;
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_attention`,
            cycleId,
            cycleSequence,
            stage: "attention",
            status: "blocked",
            reason: "attention_blocked_missing_sources",
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_closure`,
            cycleId,
            cycleSequence,
            stage: "closure",
            status: closureRef ? "completed" : "failed",
            reason: "attention_blocked_missing_sources",
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        const { rhythmState, rhythmDegraded } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);
        return {
            cycleId,
            cycleSequence,
            status: "degraded",
            closureRef,
            noActionReason: "attention_blocked_missing_sources",
            rhythmState,
            rhythmDegraded,
        };
    }
    await recordV9LoopStageEvent(db, {
        id: `evt_${cycleId}_attention`,
        cycleId,
        cycleSequence,
        stage: "attention",
        status: "completed",
        occurredAt: new Date().toISOString(),
        sourceRefs: attention.sourceRefs,
    });
    // ── Activity thread stage ──
    await recordV9LoopStageEvent(db, {
        id: `evt_${cycleId}_activity`,
        cycleId,
        cycleSequence,
        stage: "activity",
        status: "started",
        occurredAt: new Date().toISOString(),
        sourceRefs: attention.sourceRefs,
    });
    const activityResult = await deps.activityThreadCoordinator.advanceActivityThread({
        cycleRef: { cycleId, cycleSequence },
        attention,
        context,
    });
    let activity;
    if (activityResult.status === "advanced") {
        activity = { thread: activityResult.thread, step: activityResult.step };
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_activity`,
            cycleId,
            cycleSequence,
            stage: "activity",
            status: "completed",
            reason: "activity_advanced",
            occurredAt: new Date().toISOString(),
            sourceRefs: activityResult.thread.sourceRefs,
        });
    }
    else if (activityResult.status === "degraded") {
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_activity`,
            cycleId,
            cycleSequence,
            stage: "activity",
            status: "failed",
            reason: activityResult.reason,
            occurredAt: new Date().toISOString(),
            sourceRefs: attention.sourceRefs,
        });
    }
    else {
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_activity`,
            cycleId,
            cycleSequence,
            stage: "activity",
            status: "skipped",
            reason: activityResult.reason,
            occurredAt: new Date().toISOString(),
            sourceRefs: attention.sourceRefs,
        });
    }
    // ── Intent resolution ──
    const intent = await deps.intentResolver.resolveIntent({
        attention,
        activity,
        context,
        cycleRef: { cycleId, cycleSequence },
    });
    if (!intent) {
        const closure = await recordV9NoActionClosure(db, cycleId, cycleSequence, "attention_hint_without_agent_or_routine_intent", {
            now,
            traceRefs: attention.sourceRefs,
            activityThreadId: activity?.thread.threadId,
            activityStepId: activity?.step.stepId,
        });
        const closureRef = "id" in closure ? closureRefSourceRef(closure.id) : undefined;
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_closure`,
            cycleId,
            cycleSequence,
            stage: "closure",
            status: closureRef ? "completed" : "failed",
            reason: "attention_hint_without_agent_or_routine_intent",
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        const { rhythmState, rhythmDegraded } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);
        return {
            cycleId,
            cycleSequence,
            status: closureRef ? "completed" : "degraded",
            closureRef,
            noActionReason: "attention_hint_without_agent_or_routine_intent",
            degraded: closureRef ? undefined : closure,
            rhythmState,
            rhythmDegraded,
        };
    }
    // ── Policy evaluation / closure ──
    await recordV9LoopStageEvent(db, {
        id: `evt_${cycleId}_policy`,
        cycleId,
        cycleSequence,
        stage: "policy",
        status: "started",
        occurredAt: new Date().toISOString(),
        sourceRefs: intent.sourceRefs,
    });
    const dispatch = await actionClosurePort.evaluateAndDispatch(intent, { cycleId, cycleSequence }, context);
    if (!dispatch) {
        const closure = await recordV9NoActionClosure(db, cycleId, cycleSequence, "attention_hint_without_agent_or_routine_intent", {
            now,
            traceRefs: intent.sourceRefs,
            activityThreadId: activity?.thread.threadId,
            activityStepId: activity?.step.stepId,
        });
        const closureRef = "id" in closure ? closureRefSourceRef(closure.id) : undefined;
        await recordV9LoopStageEvent(db, {
            id: `evt_${cycleId}_policy`,
            cycleId,
            cycleSequence,
            stage: "policy",
            status: "skipped",
            reason: "attention_hint_without_agent_or_routine_intent",
            occurredAt: new Date().toISOString(),
            sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
        });
        const { rhythmState, rhythmDegraded } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);
        return {
            cycleId,
            cycleSequence,
            status: closureRef ? "completed" : "degraded",
            closureRef,
            noActionReason: "attention_hint_without_agent_or_routine_intent",
            rhythmState,
            rhythmDegraded,
        };
    }
    const closureResult = await recordV9PolicyOutcomeClosure(db, cycleId, cycleSequence, dispatch.actionKind, dispatch.decision, dispatch.reasonCode, {
        intentId: intent.intentId,
        platformId: intent.targetPlatformId,
        capabilityId: intent.targetCapabilityId,
        sourceRefs: intent.sourceRefs,
        proofRefs: dispatch.proposal?.proofRefs,
        traceRefs: [cycleRef],
        payload: {
            downgradedActionKind: dispatch.downgradedActionKind,
            routineInvocationId: intent.routineInvocation?.routineId,
            routineVersion: intent.routineInvocation?.version,
        },
    }, {
        now,
        activityThreadId: activity?.thread.threadId,
        activityStepId: activity?.step.stepId,
        routineInvocationId: intent.routineInvocation?.routineId,
        routineVersion: intent.routineInvocation?.version,
    });
    const closureRef = "id" in closureResult ? closureRefSourceRef(closureResult.id) : undefined;
    await recordV9LoopStageEvent(db, {
        id: `evt_${cycleId}_policy`,
        cycleId,
        cycleSequence,
        stage: "policy",
        status: closureRef ? "completed" : "failed",
        reason: dispatch.reasonCode,
        occurredAt: new Date().toISOString(),
        sourceRefs: closureRef ? [closureRef, ...intent.sourceRefs] : intent.sourceRefs,
        proofRefs: dispatch.proposal?.proofRefs,
    });
    await recordV9LoopStageEvent(db, {
        id: `evt_${cycleId}_closure`,
        cycleId,
        cycleSequence,
        stage: "closure",
        status: closureRef ? "completed" : "failed",
        reason: dispatch.reasonCode,
        occurredAt: new Date().toISOString(),
        sourceRefs: closureRef ? [closureRef, cycleRef] : [cycleRef],
    });
    // ── Daily rhythm trigger ──
    const { rhythmState, rhythmDegraded } = await advanceAndRecordDailyRhythm(db, cycleId, cycleSequence, cycleRef, now);
    // ── Final safety net ──
    if (!closureRef) {
        const fallback = await recordV9NoActionClosure(db, cycleId, cycleSequence, "closure_no_action", {
            now,
            traceRefs: [cycleRef],
        });
        const fallbackRef = "id" in fallback ? closureRefSourceRef(fallback.id) : undefined;
        return {
            cycleId,
            cycleSequence,
            status: fallbackRef ? "completed" : "degraded",
            closureRef: fallbackRef,
            noActionReason: "closure_no_action",
            degraded: closureResult ?? rhythmDegraded,
            rhythmState,
            rhythmDegraded,
        };
    }
    return {
        cycleId,
        cycleSequence,
        status: "completed",
        closureRef,
        noActionReason: dispatch.actionKind === "no_action" ? dispatch.reasonCode : undefined,
        degraded: rhythmDegraded,
        rhythmState,
        rhythmDegraded,
    };
}
export function createV9HeartbeatOrchestrator(db, deps) {
    return {
        run: (request) => runV9HeartbeatCycle(db, request, {
            ...deps,
            db,
            actionClosurePort: deps.actionClosurePort,
        }),
    };
}
