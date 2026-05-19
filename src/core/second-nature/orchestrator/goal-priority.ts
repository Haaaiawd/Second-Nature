/**
 * T2.1.4 — Goal-Directed Intent Priority.
 *
 * `applyGoalPriority` adjusts candidate intent priorities based on accepted AgentGoals.
 * Priority order: user_task > accepted_goal > rhythm.
 * Only goals with status === "accepted" are considered.
 * Agent-proposed goals are included ONLY if policy-accepted (acceptedBy === "policy_allowlist").
 * All other statuses (proposal / rejected / completed / paused) are implicitly excluded.
 */
import type { CandidateIntent } from "../types.js";
import type { AgentGoal } from "../../../storage/goal/agent-goal-store.js";

/**
 * Per-goal priority boost applied when an accepted goal matches a candidate.
 *
 * Rationale: +20 per goal keeps a priority-50 candidate under 200
 * even with 7 matching goals (50 + 140 = 190). Planner baselines
 * range from 40–100, so 200 provides ample headroom without overflow.
 */
const GOAL_PRIORITY_BOOST = 20;

export function isGoalRelatedToCandidate(goal: AgentGoal, candidate: CandidateIntent): boolean {
  const goalText = `${goal.description} ${goal.completionCriteria}`.toLowerCase();

  // Direct platformId mention in goal text
  if (candidate.platformId) {
    const platformId = candidate.platformId.toLowerCase();
    if (goalText.includes(platformId)) return true;
  }

  // Fallback: Goal description contains candidate summary keywords
  const summaryWords = candidate.summary.toLowerCase().split(/\s+/);
  for (const word of summaryWords) {
    if (word.length > 3 && goalText.includes(word)) return true;
  }

  return false;
}

export interface ApplyGoalPriorityResult {
  candidates: CandidateIntent[];
  goalInfluences: Array<{
    candidateId: string;
    goalIds: string[];
    boost: number;
  }>;
}

export function applyGoalPriority(
  candidates: CandidateIntent[],
  goals: AgentGoal[] | undefined,
): ApplyGoalPriorityResult {
  const acceptedGoals = (goals ?? []).filter(
    (g) =>
      g.status === "accepted" &&
      (g.origin !== "agent_proposed" || g.acceptedBy === "policy_allowlist"),
  );

  if (acceptedGoals.length === 0) {
    return {
      candidates: candidates.map((c) => ({
        ...c,
        priorityReasons: c.priorityReasons ?? ["rhythm"],
      })),
      goalInfluences: [],
    };
  }

  const influences: ApplyGoalPriorityResult["goalInfluences"] = [];

  const adjusted = candidates.map((candidate) => {
    const relatedGoals = acceptedGoals.filter((g) => isGoalRelatedToCandidate(g, candidate));

    if (relatedGoals.length === 0) {
      return {
        ...candidate,
        priorityReasons: candidate.priorityReasons ?? ["rhythm"],
      };
    }

    const boost = GOAL_PRIORITY_BOOST * relatedGoals.length;
    const goalIds = relatedGoals.map((g) => g.goalId);

    influences.push({
      candidateId: candidate.id,
      goalIds,
      boost,
    });

    const reasons = [
      ...(candidate.priorityReasons ?? ["rhythm"]),
      ...relatedGoals.map((g) => `goal_boost:${g.goalId}`),
    ];

    return {
      ...candidate,
      priority: candidate.priority + boost,
      goalInfluenceRefs: goalIds,
      priorityReasons: reasons,
    };
  });

  return {
    candidates: adjusted.sort((a, b) => b.priority - a.priority),
    goalInfluences: influences,
  };
}
