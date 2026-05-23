/**
 * AffordanceContextScope — T-BTS.C.2
 *
 * Core logic: Filter semantics for affordance map assembly.
 * - platformIds whitelist (empty = all platforms)
 * - goalKind trust-tier filtering (task_completion prefers write/claim;
 *   passive_sensing exposes only read-only)
 * - allowedStatuses defaults to safe subset; blocked/pending_trust always excluded
 * - Credential-bearing items never enter affordance (ADR-003)
 *
 * Dependencies:
 * - `AffordanceItem`, `AffordanceContextScope` from `../../../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - Pure filter function; no side effects, no caching.
 * - Does NOT map probe status to affordance status — that is the assembler's job.
 *
 * Test coverage: tests/unit/body/affordance-context-scope.test.ts
 */
import type { AffordanceItem, AffordanceContextScope, AffordanceStatus } from "../../../../shared/types/v7-entities.js";
export declare const DEFAULT_ALLOWED_STATUSES: readonly AffordanceStatus[];
/**
 * Apply context scope filtering to an affordance item list.
 * Returns a new array; does not mutate input.
 */
export declare function applyAffordanceContextScope(items: readonly AffordanceItem[], scope?: AffordanceContextScope): AffordanceItem[];
/**
 * Build a default scope suitable for heartbeat-cycle affordance assembly.
 */
export declare function defaultHeartbeatScope(): AffordanceContextScope;
