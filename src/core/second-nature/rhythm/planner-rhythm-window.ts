/**
 * Maps calendar rhythm policy + continuity into planner-facing window slice (T2.1.3).
 * Control-plane owns allowedIntentKinds; state never emits them (T2.1.2 boundary).
 */
import type { ContinuitySnapshot, IntentKind } from "../types.js";
import type { RhythmPolicy, RhythmWindowDecision } from "./rhythm-policy.js";
import { selectRhythmWindow } from "./select-window.js";

export interface PlannerRhythmWindowSlice {
  windowId: string;
  allowedIntentKinds: IntentKind[];
  quietBias: boolean;
}

const ALL_INTENT_KINDS: IntentKind[] = [
  "work",
  "exploration",
  "social",
  "quiet",
  "reflection",
  "outreach",
  "maintenance",
];

function allowedForPaused(): IntentKind[] {
  return ["maintenance"];
}

function allowedForMaintenanceOnly(): IntentKind[] {
  return ["work", "maintenance"];
}

function allowedForActiveWindow(windowId: string): IntentKind[] {
  if (windowId.includes("work")) {
    return ["work", "exploration", "maintenance", "reflection", "outreach", "social", "quiet"];
  }
  if (windowId.includes("social")) {
    return ["social", "exploration", "work", "maintenance", "reflection", "outreach", "quiet"];
  }
  if (windowId.includes("reflection")) {
    return ["reflection", "work", "maintenance", "exploration", "social", "outreach", "quiet"];
  }
  return ALL_INTENT_KINDS;
}

function mergeQuietBias(decision: RhythmWindowDecision, continuity: ContinuitySnapshot, windowIsQuiet: boolean): boolean {
  return windowIsQuiet || decision.topLevelMode === "quiet" || continuity.mode === "quiet";
}

/**
 * Derive allowed intent kinds and quiet bias for candidate planning.
 */
export function buildPlannerRhythmWindow(now: string, continuity: ContinuitySnapshot, policy: RhythmPolicy): PlannerRhythmWindowSlice {
  const decision = selectRhythmWindow(now, continuity, policy);
  const window = policy.windows.find((w) => w.id === decision.windowId) ?? policy.windows[0]!;
  const windowIsQuiet = window.mode === "quiet";
  const quietBias = mergeQuietBias(decision, continuity, windowIsQuiet);

  let allowed: IntentKind[];

  if (decision.topLevelMode === "paused_for_interrupt") {
    allowed = allowedForPaused();
  } else if (decision.topLevelMode === "maintenance_only") {
    allowed = allowedForMaintenanceOnly();
  } else {
    /** Calendar quiet sets `quietBias` only; candidate kinds stay window-biased (guards enforce quiet suppression). */
    allowed = allowedForActiveWindow(window.id);
  }

  return { windowId: decision.windowId, allowedIntentKinds: allowed, quietBias };
}
