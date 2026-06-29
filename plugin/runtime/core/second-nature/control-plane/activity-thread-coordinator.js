/**
 * ActivityThreadCoordinator — T2.2.4
 *
 * Core logic: Cross-heartbeat continuation spine for ActivityThread.
 * - Selects active/related thread based on AttentionSignal.threadSuggestion.
 * - Creates/continues/pauses/completes threads.
 * - Advances at most one bounded ActivityStep per heartbeat.
 * - Side-effecting steps (propose_action, policy_closure) are recorded but not
 *   executed here; they remain subject to action-closure-policy.
 * - Runaway prevention: max steps, stale heartbeat detection, blocked status.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.9`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.1b`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3.5`
 * - ADR-002: Attention is not Agent mind.
 *
 * Boundary:
 * - Does not run an unbounded internal action loop.
 * - Does not execute side effects.
 * - Agent-facing wording stays neutral ("ongoing thread", "possible next move");
 *   never claims Agent thoughts, feelings, or mandatory actions.
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-activity-thread-coordinator.test.ts`
 * - `tests/integration/v9/activity-thread-continuation.test.ts`
 */
import { randomUUID } from "node:crypto";
// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────
export const ACTIVITY_THREAD_MAX_STEPS = 8;
export const ACTIVITY_THREAD_STALE_HEARTBEATS = 6;
// ───────────────────────────────────────────────────────────────
// Coordinator
// ───────────────────────────────────────────────────────────────
export function createActivityThreadCoordinator(deps) {
    return {
        async advanceActivityThread(options) {
            return advanceActivityThread({ ...options, ...deps });
        },
    };
}
export async function advanceActivityThread(options) {
    const { cycleRef, attention, context, threadPort, recordLoopStageEvent } = options;
    if (attention.status !== "attentive" || attention.threadSuggestion === "none") {
        await emitStageEvent(recordLoopStageEvent, {
            stage: "activity",
            status: "skipped",
            reason: attention.threadSuggestion === "none" ? "attention_thread_suggestion_none" : "attention_not_attentive",
            cycleId: cycleRef.cycleId,
            cycleSequence: cycleRef.cycleSequence,
            sourceRefs: attention.sourceRefs,
        });
        return { status: "skipped", reason: attention.threadSuggestion === "none" ? "attention_thread_suggestion_none" : "attention_not_attentive" };
    }
    if (attention.sourceRefs.length === 0) {
        await emitStageEvent(recordLoopStageEvent, {
            stage: "activity",
            status: "blocked",
            reason: "attention_blocked_missing_sources",
            cycleId: cycleRef.cycleId,
            cycleSequence: cycleRef.cycleSequence,
            sourceRefs: [],
        });
        return { status: "skipped", reason: "attention_blocked_missing_sources" };
    }
    const activeThreads = context.activityThreads?.status === "loaded" ? context.activityThreads.data : [];
    const related = selectRelatedThread(activeThreads, attention);
    const now = new Date().toISOString();
    if (related && shouldStopThread(related, cycleRef.cycleSequence)) {
        // Terminal lifecycle states are already stopped; do not mutate them.
        if (related.status === "blocked" || related.status === "completed" || related.status === "abandoned") {
            await emitStageEvent(recordLoopStageEvent, {
                stage: "activity",
                status: "skipped",
                reason: "activity_thread_terminal_status",
                cycleId: cycleRef.cycleId,
                cycleSequence: cycleRef.cycleSequence,
                sourceRefs: related.sourceRefs,
            });
            return { status: "stopped", thread: related, reason: "activity_thread_terminal_status" };
        }
        const status = related.completedStepCount >= ACTIVITY_THREAD_MAX_STEPS ? "blocked" : "paused";
        const reason = stopReason(related, cycleRef.cycleSequence);
        const stopCondition = status === "blocked" ? "max_steps" : "stale";
        const result = await threadPort.updateActivityThreadProgress(related.threadId, {
            status,
            blockerReason: reason,
            stopCondition,
            lastHeartbeatSequence: cycleRef.cycleSequence,
            updatedAt: now,
        });
        if (result.status !== "loaded") {
            return { status: "degraded", reason: result.reason ?? "activity_thread_progress_failed" };
        }
        await emitStageEvent(recordLoopStageEvent, {
            stage: "activity",
            status: status === "blocked" ? "blocked" : "skipped",
            reason,
            cycleId: cycleRef.cycleId,
            cycleSequence: cycleRef.cycleSequence,
            sourceRefs: related.sourceRefs,
        });
        return { status: "stopped", thread: result.data, reason };
    }
    let thread;
    if (related) {
        thread = related;
        const progressResult = await threadPort.updateActivityThreadProgress(related.threadId, {
            lastHeartbeatSequence: cycleRef.cycleSequence,
            updatedAt: now,
        });
        if (progressResult.status !== "loaded") {
            return { status: "degraded", reason: progressResult.reason ?? "activity_thread_progress_failed" };
        }
        thread = progressResult.data;
    }
    else {
        const createResult = await threadPort.createActivityThread({
            threadId: makeId("activity"),
            originAttentionSignalId: attention.signalId,
            status: "active",
            currentFocus: summarizeFocus(attention),
            associations: deriveAssociations(attention, context),
            nextPossibleMoves: deriveNextPossibleMoves(attention),
            completedStepCount: 0,
            stopCondition: "single_step_done",
            lastHeartbeatSequence: cycleRef.cycleSequence,
            sourceRefs: [{ family: "attention", id: attention.signalId }, ...attention.sourceRefs],
            createdAt: now,
            updatedAt: now,
        });
        if (createResult.status !== "loaded") {
            return { status: "degraded", reason: createResult.reason ?? "activity_thread_create_failed" };
        }
        thread = createResult.data;
    }
    const stepKind = chooseNextStepKind(thread, attention);
    const step = {
        stepId: makeId("activity_step"),
        threadId: thread.threadId,
        cycleId: cycleRef.cycleId,
        stepKind,
        summary: summarizeStep(stepKind, attention),
        sourceRefs: thread.sourceRefs,
        createdAt: now,
    };
    const appendResult = await threadPort.appendActivityStep(step);
    if (appendResult.status !== "loaded") {
        return { status: "degraded", reason: appendResult.reason ?? "activity_step_append_failed" };
    }
    const nextStatus = stepKind === "complete" ? "completed" : stepKind === "pause" ? "paused" : thread.status;
    const nextBlockerReason = nextStatus === "blocked" ? stepKind : thread.blockerReason;
    const nextStopCondition = nextStatus === "blocked"
        ? "max_steps"
        : nextStatus === "paused"
            ? "stale"
            : thread.stopCondition;
    const progressResult = await threadPort.updateActivityThreadProgress(thread.threadId, {
        status: nextStatus,
        completedStepCount: thread.completedStepCount + 1,
        lastStepKind: stepKind,
        lastHeartbeatSequence: cycleRef.cycleSequence,
        blockerReason: nextBlockerReason,
        stopCondition: nextStopCondition,
        nextPossibleMoves: deriveNextPossibleMoves(attention),
        updatedAt: now,
    });
    if (progressResult.status !== "loaded") {
        return { status: "degraded", reason: progressResult.reason ?? "activity_thread_progress_failed" };
    }
    await emitStageEvent(recordLoopStageEvent, {
        stage: "activity",
        status: "completed",
        reason: "activity_advanced",
        cycleId: cycleRef.cycleId,
        cycleSequence: cycleRef.cycleSequence,
        sourceRefs: thread.sourceRefs,
    });
    return { status: "advanced", thread: progressResult.data, step: appendResult.data };
}
// ───────────────────────────────────────────────────────────────
// Selection & lifecycle helpers
// ───────────────────────────────────────────────────────────────
function selectRelatedThread(threads, attention) {
    if (attention.activityThreadId) {
        const exact = threads.find((t) => t.threadId === attention.activityThreadId);
        if (exact)
            return exact;
    }
    // Only continue a thread when there is a shared source ref.
    return threads
        .filter((t) => t.status === "active")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .find((t) => sourceOverlap(t.sourceRefs, attention.sourceRefs));
}
function shouldStopThread(thread, cycleSequence) {
    if (thread.completedStepCount >= ACTIVITY_THREAD_MAX_STEPS)
        return true;
    if (cycleSequence - thread.lastHeartbeatSequence > ACTIVITY_THREAD_STALE_HEARTBEATS)
        return true;
    return thread.status === "blocked" || thread.status === "completed" || thread.status === "abandoned";
}
function stopReason(thread, cycleSequence) {
    if (thread.completedStepCount >= ACTIVITY_THREAD_MAX_STEPS)
        return "activity_thread_overlong";
    if (cycleSequence - thread.lastHeartbeatSequence > ACTIVITY_THREAD_STALE_HEARTBEATS) {
        return "activity_thread_stale";
    }
    return "activity_thread_terminal_status";
}
function chooseNextStepKind(thread, attention) {
    if (attention.threadSuggestion === "complete")
        return "complete";
    if (attention.threadSuggestion === "pause")
        return "pause";
    if (attention.threadSuggestion === "none")
        return "observe";
    const possible = deriveNextPossibleMoves(attention);
    const lastKind = thread.lastStepKind;
    // Fresh thread starts with the first suggested move (design doc §3.9).
    if (!lastKind) {
        return possible[0] ?? "observe";
    }
    // Continue from the last step kind, preferring suggested moves in the
    // canonical observe → associate → ask_agent → propose_action rotation.
    const rotation = [
        "observe",
        "associate",
        "ask_agent",
        "propose_action",
    ];
    const currentIdx = rotation.indexOf(lastKind);
    for (let offset = 1; offset <= rotation.length; offset++) {
        const candidate = rotation[(currentIdx + offset) % rotation.length];
        if (possible.includes(candidate))
            return candidate;
    }
    return possible[0] ?? "observe";
}
// ───────────────────────────────────────────────────────────────
// Content helpers
// ───────────────────────────────────────────────────────────────
function summarizeFocus(attention) {
    return attention.summary.length <= 200 ? attention.summary : attention.summary.slice(0, 197) + "...";
}
function deriveAssociations(attention, context) {
    const associations = [];
    if (attention.activityThreadId) {
        associations.push(`continues thread ${attention.activityThreadId}`);
    }
    const active = context.activityThreads?.status === "loaded" ? context.activityThreads.data : [];
    if (active.length > 0) {
        associations.push(`${active.length} active thread(s)`);
    }
    associations.push(...attention.possibleActions.map((a) => `possible: ${a}`));
    return associations.slice(0, 5).map((s) => (s.length <= 160 ? s : s.slice(0, 157) + "..."));
}
function deriveNextPossibleMoves(attention) {
    // Align with design doc §3.9: fresh threads start by associating the signal
    // with existing context, then rotate through observe/ask/propose as needed.
    const base = ["associate"];
    for (const action of attention.possibleActions) {
        if (action === "notify_owner")
            base.push("propose_action");
        if (action === "watch")
            base.push("observe");
        if (action === "remember")
            base.push("associate");
        if (action === "defer")
            base.push("pause");
    }
    return [...new Set(base)];
}
function summarizeStep(stepKind, attention) {
    const focus = summarizeFocus(attention);
    switch (stepKind) {
        case "observe":
            return `observe: ${focus}`;
        case "associate":
            return `associate: ${focus}`;
        case "ask_agent":
            return `ask agent: ${focus}`;
        case "propose_action":
            return `propose action: ${focus}`;
        case "policy_closure":
            return `policy closure: ${focus}`;
        case "pause":
            return `pause: ${focus}`;
        case "complete":
            return `complete: ${focus}`;
        default:
            return `${stepKind}: ${focus}`;
    }
}
// ───────────────────────────────────────────────────────────────
// Utility helpers
// ───────────────────────────────────────────────────────────────
function sourceOverlap(a, b) {
    const set = new Set(a.map((ref) => `${ref.family}:${ref.id}`));
    return b.some((ref) => set.has(`${ref.family}:${ref.id}`));
}
async function emitStageEvent(recorder, event) {
    if (!recorder)
        return;
    try {
        await recorder(event);
    }
    catch {
        // Stage event recording is best-effort; do not fail the activity advance.
    }
}
function makeId(prefix) {
    return `${prefix}_${randomUUID()}`;
}
