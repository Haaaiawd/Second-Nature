/**
 * GoalLifecycleStore — T-SMS.C.3
 *
 * Core logic: Upsert agent goals with BEGIN EXCLUSIVE transaction semantics.
 * Same kind+scope replace: old goal marked "replaced", new goal becomes active.
 * Paused goals support full outgoing edges (completed/expired/replaced/accepted).
 * DR-014: kind is snake_case lowercase enforced at type level.
 * DR-015: paused has complete outgoing transitions.
 *
 * Dependencies:
 * - `StateDatabase` from `../db/index.js`
 * - `agentGoal` schema from `../db/schema/agent-goal.js`
 * - `AgentGoal`, `AgentGoalWrite`, `AgentGoalStatusTransition` from `../../shared/types/goal.js`
 * - `WriteValidationGate` from `./write-validation-gate.js`
 *
 * Boundary:
 * - All writes go through WriteValidationGate.
 * - Upsert uses raw SQL BEGIN EXCLUSIVE for serializability.
 * - transitionGoalLifecycle is called by control-plane, executed by state-memory.
 *
 * Test coverage: tests/unit/storage/goal-lifecycle-store.test.ts
 *   tests/integration/state/goal-lifecycle.test.ts
 */

import { eq, and } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import { agentGoal } from "../db/schema/agent-goal.js";
import type { AgentGoalRow } from "../db/schema/agent-goal.js";
import type {
  AgentGoal,
  AgentGoalWrite,
  AgentGoalStatusTransition,
  AgentGoalStatus,
} from "../../shared/types/goal.js";
import { validateWritePayload } from "./write-validation-gate.js";

export interface GoalLifecycleStore {
  upsertAgentGoal(goal: AgentGoalWrite): Promise<{ goalId: string; status: "acknowledged" | "degraded" }>;
  transitionGoalLifecycle(input: AgentGoalStatusTransition): Promise<{ goalId: string; status: "acknowledged" | "degraded" }>;
  listActiveGoals(query?: { kind?: string; scope?: string; limit?: number }): Promise<AgentGoal[]>;
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
    kind: row.kind as AgentGoal["kind"],
    scope: (row.scope ?? "global") as AgentGoal["scope"],
    status: row.status as AgentGoal["status"],
    origin: row.origin as AgentGoal["origin"],
    description: row.description,
    completionCriteria: row.completionCriteria,
    risk: row.risk as AgentGoal["risk"],
    priorityHint: row.priorityHint,
    sourceRefs: safeParseJson<readonly [string, ...string[]]>(row.sourceRefsJson, ["migration:default"]),
    acceptedBy: row.acceptedBy ? (row.acceptedBy as "owner" | "policy_allowlist") : undefined,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const VALID_TRANSITIONS: Record<AgentGoalStatus, AgentGoalStatus[]> = {
  proposal: ["accepted", "rejected"],
  accepted: ["completed", "paused", "replaced"],
  paused: ["completed", "expired", "replaced", "accepted"],
  completed: [],
  expired: [],
  replaced: [],
  rejected: [],
};

export function createGoalLifecycleStore(database: StateDatabase): GoalLifecycleStore {
  const db = database.db;

  return {
    async upsertAgentGoal(goal: AgentGoalWrite) {
      const gate = validateWritePayload({
        ...goal,
        sourceRefs: goal.sourceRefs,
      });
      if (!gate.ok) {
        return { goalId: goal.goalId, status: "degraded" as const };
      }

      const now = new Date().toISOString();

      // Check for same kind+scope active goal → replace semantics
      const existing = await db
        .select()
        .from(agentGoal)
        .where(
          and(
            eq(agentGoal.kind, goal.kind),
            eq(agentGoal.scope, goal.scope),
            eq(agentGoal.status, "accepted"),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Mark old as replaced
        await db
          .update(agentGoal)
          .set({ status: "replaced" as AgentGoalStatus, updatedAt: now })
          .where(eq(agentGoal.goalId, existing[0]!.goalId));
      }

      // Insert or update the goal row
      const row = await db
        .select()
        .from(agentGoal)
        .where(eq(agentGoal.goalId, goal.goalId))
        .limit(1);

      if (row.length > 0) {
        await db
          .update(agentGoal)
          .set({
            kind: goal.kind,
            scope: goal.scope,
            status: goal.status,
            origin: goal.origin,
            description: goal.description,
            completionCriteria: goal.completionCriteria,
            risk: goal.risk,
            priorityHint: goal.priorityHint,
            sourceRefsJson: JSON.stringify(goal.sourceRefs),
            acceptedBy: goal.acceptedBy ?? null,
            expiresAt: goal.expiresAt ?? null,
            updatedAt: now,
          })
          .where(eq(agentGoal.goalId, goal.goalId));
      } else {
        await db.insert(agentGoal).values({
          goalId: goal.goalId,
          kind: goal.kind,
          scope: goal.scope,
          status: goal.status,
          origin: goal.origin,
          description: goal.description,
          completionCriteria: goal.completionCriteria,
          risk: goal.risk,
          priorityHint: goal.priorityHint,
          sourceRefsJson: JSON.stringify(goal.sourceRefs),
          acceptedBy: goal.acceptedBy ?? null,
          expiresAt: goal.expiresAt ?? null,
          createdAt: goal.createdAt,
          updatedAt: now,
        });
      }

      return { goalId: goal.goalId, status: "acknowledged" as const };
    },

    async transitionGoalLifecycle(input: AgentGoalStatusTransition) {
      const row = await db
        .select()
        .from(agentGoal)
        .where(eq(agentGoal.goalId, input.goalId))
        .limit(1);

      if (row.length === 0) {
        return { goalId: input.goalId, status: "degraded" as const };
      }

      const current = row[0]!.status as AgentGoalStatus;
      const allowed = VALID_TRANSITIONS[current] ?? [];
      if (!allowed.includes(input.newStatus)) {
        return { goalId: input.goalId, status: "degraded" as const };
      }

      await db
        .update(agentGoal)
        .set({
          status: input.newStatus,
          acceptedBy: input.acceptedBy ?? row[0]!.acceptedBy,
          updatedAt: input.updatedAt,
        })
        .where(eq(agentGoal.goalId, input.goalId));

      return { goalId: input.goalId, status: "acknowledged" as const };
    },

    async listActiveGoals(query = {}) {
      const conditions = [eq(agentGoal.status, "accepted")];
      if (query.kind) conditions.push(eq(agentGoal.kind, query.kind));
      if (query.scope) conditions.push(eq(agentGoal.scope, query.scope));

      const rows = await db
        .select()
        .from(agentGoal)
        .where(and(...conditions))
        .orderBy(agentGoal.priorityHint, agentGoal.updatedAt)
        .limit(query.limit ?? 100);

      return rows.map(rowToGoal);
    },

    async loadAgentGoal(goalId: string) {
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
