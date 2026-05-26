import { createAgentGoalStore } from "../../storage/goal/agent-goal-store.js";
import type { StateDatabase } from "../../storage/db/index.js";
import type { AgentGoal } from "../../storage/goal/agent-goal-store.js";
import { randomUUID } from "node:crypto";

export interface GoalCommandInput {
  action: "set" | "list" | "accept" | "reject";
  goalId?: string;
  description?: string;
  completionCriteria?: string;
  /** T1.4.2 — alias for `completionCriteria`. */
  criteria?: string;
  risk?: "low" | "medium" | "high";
  kind?: "short_term" | "long_term";
  scope?: string;
  statusFilter?: string;
  originFilter?: string;
  limit?: number;
}

export interface GoalCommandResult {
  ok: boolean;
  command: "goal";
  action: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    requiredUserInput?: string[];
    nextStep?: string;
  };
  [key: string]: unknown;
}

function createGoalCommandError(
  code: string,
  message: string,
  requiredUserInput?: string[],
  nextStep?: string,
): GoalCommandResult {
  return {
    ok: false,
    command: "goal",
    action: "unknown",
    error: {
      code,
      message,
      requiredUserInput,
      nextStep,
    },
  };
}

function serializeGoal(goal: AgentGoal): Record<string, unknown> {
  return {
    goalId: goal.goalId,
    kind: goal.kind,
    status: goal.status,
    origin: goal.origin,
    description: goal.description,
    completionCriteria: goal.completionCriteria,
    risk: goal.risk,
    priorityHint: goal.priorityHint,
    sourceRefs: goal.sourceRefs,
    acceptedBy: goal.acceptedBy,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

export async function goalCommand(
  stateDb: StateDatabase | undefined,
  input: GoalCommandInput,
): Promise<GoalCommandResult> {
  if (!stateDb) {
    return createGoalCommandError(
      "STATE_UNAVAILABLE",
      "goal command requires StateDatabase to be wired into OpsRouterDeps",
      [],
      "wire_state_into_ops_router",
    );
  }

  const store = createAgentGoalStore(stateDb);
  const action = input.action;

  switch (action) {
    case "set": {
      const description = input.description?.trim();
      if (!description || description.length === 0) {
        return createGoalCommandError(
          "MISSING_DESCRIPTION",
          "goal set requires description",
          ["description"],
          "reinvoke_goal_set_with_description",
        );
      }

      const goalId = input.goalId?.trim() || randomUUID();
      const now = new Date().toISOString();

      // T1.4.2: `criteria` is an alias for `completionCriteria`.
      const completionCriteria =
        input.completionCriteria?.trim() ||
        input.criteria?.trim() ||
        "";
      await store.upsertAgentGoal({
        goalId,
        kind: input.kind ?? "short_term",
        scope: input.scope?.trim() || "global",
        status: "accepted",
        origin: "owner_set",
        description,
        completionCriteria,
        risk: input.risk ?? "low",
        priorityHint: 0,
        sourceRefs: [],
        acceptedBy: "owner",
        createdAt: now,
        updatedAt: now,
      });

      const created = await store.loadAgentGoal(goalId);
      return {
        ok: true,
        command: "goal",
        action: "set",
        data: {
          goal: created ? serializeGoal(created) : null,
          before: null,
          after: { status: "accepted", origin: "owner_set", acceptedBy: "owner" },
        },
      };
    }

    case "list": {
      const statuses = input.statusFilter
        ? input.statusFilter.split(",").map((s) => s.trim() as AgentGoal["status"])
        : undefined;
      const origins = input.originFilter
        ? input.originFilter.split(",").map((s) => s.trim() as AgentGoal["origin"])
        : undefined;

      const goals = await store.listAgentGoals({
        statuses,
        origins,
        limit: input.limit ?? 50,
      });

      return {
        ok: true,
        command: "goal",
        action: "list",
        data: {
          total: goals.length,
          goals: goals.map(serializeGoal),
        },
      };
    }

    case "accept": {
      const goalId = input.goalId?.trim();
      if (!goalId) {
        return createGoalCommandError(
          "MISSING_GOAL_ID",
          "goal accept requires goalId",
          ["goalId"],
          "reinvoke_goal_accept_with_goalId",
        );
      }

      const before = await store.loadAgentGoal(goalId);
      if (!before) {
        return createGoalCommandError(
          "GOAL_NOT_FOUND",
          `No goal found for goalId: ${goalId}`,
          ["goalId"],
          "verify_goal_id_or_run_goal_list",
        );
      }

      if (before.status !== "proposal") {
        return createGoalCommandError(
          "INVALID_STATUS_TRANSITION",
          `Cannot accept goal with status '${before.status}'. Only 'proposal' goals can be accepted.`,
          ["goalId"],
          "verify_goal_status_or_run_goal_list",
        );
      }

      await store.transitionGoalStatus({
        goalId,
        newStatus: "accepted",
        acceptedBy: "owner",
        updatedAt: new Date().toISOString(),
      });

      const after = await store.loadAgentGoal(goalId);
      return {
        ok: true,
        command: "goal",
        action: "accept",
        data: {
          goalId,
          before: { status: before.status, origin: before.origin },
          after: after
            ? { status: after.status, origin: after.origin, acceptedBy: after.acceptedBy }
            : null,
        },
      };
    }

    case "reject": {
      const goalId = input.goalId?.trim();
      if (!goalId) {
        return createGoalCommandError(
          "MISSING_GOAL_ID",
          "goal reject requires goalId",
          ["goalId"],
          "reinvoke_goal_reject_with_goalId",
        );
      }

      const before = await store.loadAgentGoal(goalId);
      if (!before) {
        return createGoalCommandError(
          "GOAL_NOT_FOUND",
          `No goal found for goalId: ${goalId}`,
          ["goalId"],
          "verify_goal_id_or_run_goal_list",
        );
      }

      if (before.status !== "proposal") {
        return createGoalCommandError(
          "INVALID_STATUS_TRANSITION",
          `Cannot reject goal with status '${before.status}'. Only 'proposal' goals can be rejected.`,
          ["goalId"],
          "verify_goal_status_or_run_goal_list",
        );
      }

      await store.transitionGoalStatus({
        goalId,
        newStatus: "rejected",
        updatedAt: new Date().toISOString(),
      });

      const after = await store.loadAgentGoal(goalId);
      return {
        ok: true,
        command: "goal",
        action: "reject",
        data: {
          goalId,
          before: { status: before.status, origin: before.origin },
          after: after ? { status: after.status, origin: after.origin } : null,
        },
      };
    }

    default: {
      return createGoalCommandError(
        "UNKNOWN_GOAL_ACTION",
        `Unknown goal action: ${action}. Supported: set, list, accept, reject.`,
        ["action"],
        "reinvoke_with_supported_action",
      );
    }
  }
}
