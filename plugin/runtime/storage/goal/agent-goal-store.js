import { eq, inArray, desc, and } from "drizzle-orm";
import { agentGoal } from "../db/schema/agent-goal.js";
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
function rowToGoal(row) {
    return {
        goalId: row.goalId,
        kind: row.kind,
        status: row.status,
        origin: row.origin,
        description: row.description,
        completionCriteria: row.completionCriteria,
        risk: row.risk,
        priorityHint: row.priorityHint,
        sourceRefs: safeParseJson(row.sourceRefsJson, []),
        acceptedBy: row.acceptedBy ? row.acceptedBy : undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
export function createAgentGoalStore(database) {
    const db = database.db;
    return {
        async upsertAgentGoal(goal) {
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
            }
            else {
                await db.insert(agentGoal).values({
                    goalId: goal.goalId,
                    kind: goal.kind,
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
        async listAgentGoals(query) {
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
            return rows.map(rowToGoal);
        },
        async transitionGoalStatus(input) {
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
        async loadAgentGoal(goalId) {
            const rows = await db
                .select()
                .from(agentGoal)
                .where(eq(agentGoal.goalId, goalId))
                .limit(1);
            if (rows.length === 0)
                return null;
            return rowToGoal(rows[0]);
        },
    };
}
