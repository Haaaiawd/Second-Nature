/**
 * AgentGoal v7 shared types — DR-014 snake_case kind / scope enforcement.
 *
 * Core logic:
 * - `kind` is a closed union of snake_case lowercase strings.
 * - `scope` controls visibility (global vs platform-specific vs session-bound).
 * - `status` supports full v7 lifecycle including paused → expired/replaced.
 *
 * Dependencies:
 * - `SourceRefTuple` from `./source-ref.js` for grounding.
 *
 * Boundary:
 * - Used by state-memory (GoalLifecycleStore), control-plane
 *   (GoalLifecyclePolicy), and runtime-ops (goal command surface).
 * - Non-enum values trigger compile errors via exhaustive union checks.
 *
 * Test coverage: tests/unit/shared/v7-entities.test.ts (invalid kind
 * `@ts-expect-error` compile guard).
 */

import type { SourceRefTuple } from "./source-ref.js";

export type AgentGoalKind =
  | "short_term"
  | "long_term"
  | "habit"
  | "maintenance"
  | "passive_sensing"
  | "outreach"
  | "exploration";

export type AgentGoalStatus =
  | "proposal"
  | "accepted"
  | "rejected"
  | "completed"
  | "paused"
  | "expired"
  | "replaced";

export type AgentGoalOrigin =
  | "owner_set"
  | "agent_proposed"
  | "policy_seeded";

export type AgentGoalScope = "global" | "platform_specific" | "session_bound";

export interface AgentGoal {
  goalId: string;
  kind: AgentGoalKind;
  scope: AgentGoalScope;
  status: AgentGoalStatus;
  origin: AgentGoalOrigin;
  description: string;
  completionCriteria: string;
  risk: "low" | "medium" | "high";
  priorityHint: number;
  sourceRefs: SourceRefTuple;
  acceptedBy?: "owner" | "policy_allowlist";
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGoalWrite {
  goalId: string;
  kind: AgentGoalKind;
  scope: AgentGoalScope;
  status: AgentGoalStatus;
  origin: AgentGoalOrigin;
  description: string;
  completionCriteria: string;
  risk: "low" | "medium" | "high";
  priorityHint: number;
  sourceRefs: SourceRefTuple;
  acceptedBy?: "owner" | "policy_allowlist";
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGoalStatusTransition {
  goalId: string;
  newStatus: AgentGoalStatus;
  acceptedBy?: "owner" | "policy_allowlist";
  updatedAt: string;
}
