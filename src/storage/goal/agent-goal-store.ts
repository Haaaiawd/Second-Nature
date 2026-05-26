import { eq, inArray, desc, and } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { agentGoal } from "../db/schema/agent-goal.js";
import type { AgentGoalRow } from "../db/schema/agent-goal.js";

export interface SourceRef {
  sourceId: string;
  kind: string;
  url?: string;
  snippet?: string;
}

export interface AgentGoal {
  goalId: string;
  kind: "short_term" | "long_term";
  scope?: string;
  status: "proposal" | "accepted" | "rejected" | "completed" | "paused";
  origin: "owner_set" | "agent_proposed" | "policy_seeded";
  description: string;
  completionCriteria: string;
  risk: "low" | "medium" | "high";
  priorityHint: number;
  sourceRefs: SourceRef[];
  acceptedBy?: "owner" | "policy_allowlist";
  createdAt: string;
  updatedAt: string;
}

export interface AgentGoalWrite {
  goalId: string;
  kind: "short_term" | "long_term";
  scope?: string;
  status: "proposal" | "accepted" | "rejected" | "completed" | "paused";
  origin: "owner_set" | "agent_proposed" | "policy_seeded";
  description: string;
  completionCriteria: string;
  risk: "low" | "medium" | "high";
  priorityHint: number;
  sourceRefs: SourceRef[];
  acceptedBy?: "owner" | "policy_allowlist";
  createdAt: string;
  updatedAt: string;
}

export interface AgentGoalStatusTransition {
  goalId: string;
  newStatus: "proposal" | "accepted" | "rejected" | "completed" | "paused";
  acceptedBy?: "owner" | "policy_allowlist";
  updatedAt: string;
}

export interface AgentGoalQuery {
  statuses?: AgentGoal["status"][];
  origins?: AgentGoal["origin"][];
  limit?: number;
}

export interface AgentGoalWriteAck {
  goalId: string;
  status: "acknowledged" | "degraded";
}

export interface AgentGoalStore {
  upsertAgentGoal(goal: AgentGoalWrite): Promise<AgentGoalWriteAck>;
  listAgentGoals(query: AgentGoalQuery): Promise<AgentGoal[]>;
  transitionGoalStatus(input: AgentGoalStatusTransition): Promise<AgentGoalWriteAck>;
  loadAgentGoal(goalId: string): Promise<AgentGoal | null>;
}

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToGoal(row: AgentGoalRow): AgentGoal {
  return {
    goalId: row.goalId,
    kind: row.kind as "short_term" | "long_term",
    scope: row.scope ?? undefined,
    status: row.status as AgentGoal["status"],
    origin: row.origin as AgentGoal["origin"],
    description: row.description,
    completionCriteria: row.completionCriteria,
    risk: row.risk as "low" | "medium" | "high",
    priorityHint: row.priorityHint,
    sourceRefs: safeParseJson<SourceRef[]>(row.sourceRefsJson, []),
    acceptedBy: row.acceptedBy ? (row.acceptedBy as "owner" | "policy_allowlist") : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createAgentGoalStore(database: StateDatabase): AgentGoalStore {
  const db = database.db;

  return {
    async upsertAgentGoal(goal: AgentGoalWrite): Promise<AgentGoalWriteAck> {
      // T-V7C.C.4: dedupe — same kind+scope accepted goals → mark old as replaced
      if (goal.status === "accepted") {
        const oldGoals = await db
          .select()
          .from(agentGoal)
          .where(
            and(
              eq(agentGoal.kind, goal.kind),
              eq(agentGoal.scope, goal.scope ?? "global"),
              eq(agentGoal.status, "accepted"),
            ),
          );
        for (const old of oldGoals) {
          if (old.goalId !== goal.goalId) {
            await db
              .update(agentGoal)
              .set({ status: "replaced" as const, updatedAt: goal.updatedAt })
              .where(eq(agentGoal.goalId, old.goalId));
          }
        }
      }

      const existing = await db
        .select()
        .from(agentGoal)
        .where(eq(agentGoal.goalId, goal.goalId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(agentGoal)
          .set({
            kind: goal.kind,
            scope: goal.scope ?? "global",
            status: goal.status,
            origin: goal.origin,
            description: goal.description,
            completionCriteria: goal.completionCriteria,
            risk: goal.risk,
            priorityHint: goal.priorityHint,
            sourceRefsJson: JSON.stringify(goal.sourceRefs),
            acceptedBy: goal.acceptedBy ?? null,
            updatedAt: goal.updatedAt,
          })
          .where(eq(agentGoal.goalId, goal.goalId));
      } else {
        await db.insert(agentGoal).values({
          goalId: goal.goalId,
          kind: goal.kind,
          scope: goal.scope ?? "global",
          status: goal.status,
          origin: goal.origin,
          description: goal.description,
          completionCriteria: goal.completionCriteria,
          risk: goal.risk,
          priorityHint: goal.priorityHint,
          sourceRefsJson: JSON.stringify(goal.sourceRefs),
          acceptedBy: goal.acceptedBy ?? null,
          createdAt: goal.createdAt,
          updatedAt: goal.updatedAt,
        });
      }

      return { goalId: goal.goalId, status: "acknowledged" };
    },

    async listAgentGoals(query: AgentGoalQuery): Promise<AgentGoal[]> {
      const conditions = [];
      if (query.statuses && query.statuses.length > 0) {
        conditions.push(inArray(agentGoal.status, query.statuses));
      }
      if (query.origins && query.origins.length > 0) {
        conditions.push(inArray(agentGoal.origin, query.origins));
      }

      const rows = await db
        .select()
        .from(agentGoal)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(agentGoal.updatedAt))
        .limit(query.limit ?? 100);

      // T-V7C.C.4: dedupe by kind+scope — keep newest (rows already sorted by updatedAt desc)
      const seen = new Map<string, AgentGoal>();
      for (const row of rows) {
        const goal = rowToGoal(row);
        const key = `${goal.kind}:${goal.scope ?? "global"}`;
        if (!seen.has(key)) {
          seen.set(key, goal);
        }
      }
      return Array.from(seen.values());
    },

    async transitionGoalStatus(input: AgentGoalStatusTransition): Promise<AgentGoalWriteAck> {
      await db
        .update(agentGoal)
        .set({
          status: input.newStatus,
          acceptedBy: input.acceptedBy ?? null,
          updatedAt: input.updatedAt,
        })
        .where(eq(agentGoal.goalId, input.goalId));

      return { goalId: input.goalId, status: "acknowledged" };
    },

    async loadAgentGoal(goalId: string): Promise<AgentGoal | null> {
      const rows = await db
        .select()
        .from(agentGoal)
        .where(eq(agentGoal.goalId, goalId))
        .limit(1);

      if (rows.length === 0) return null;
      return rowToGoal(rows[0]!);
    },
  };
}
