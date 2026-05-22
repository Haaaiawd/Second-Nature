/**
 * AgentGoal v7 shared types — DR-014 snake_case kind / scope enforcement.
 *
 * Core logic:
 * - `kind` is a closed union of snake_case lowercase strings.
 * - `scope` controls visibility (global vs platform-specific vs session-bound).
 * - `status` supports full v7 lifecycle including paused → expired/replaced.
 *
 * Dependencies:
 * - `SourceRef` from `./source-ref.js` for grounding.
 *
 * Boundary:
 * - Used by state-memory (GoalLifecycleStore), control-plane
 *   (GoalLifecyclePolicy), and runtime-ops (goal command surface).
 * - Non-enum values trigger compile errors via exhaustive union checks.
 *
 * Test coverage: tests/unit/shared/v7-entities.test.ts (invalid kind
 * `@ts-expect-error` compile guard).
 */
export {};
