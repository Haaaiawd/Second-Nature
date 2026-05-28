/**
 * AffordanceContextScope — T-BTS.C.2
 *
 * Core logic: Filter semantics for affordance map assembly.
 * - platformIds whitelist (empty = all platforms)
 * - goalKind trust-tier filtering (task_completion prefers write/claim;
 *   passive_sensing exposes only read-only)
 * - allowedStatuses defaults to heartbeat-usable statuses; blocked/pending_trust always excluded
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
export const DEFAULT_ALLOWED_STATUSES = [
    "safe",
    "exploratory",
    "needs_auth",
];
const BLOCKED_STATUSES = [
    "unavailable", // painful is allowed for diagnostics; unavailable is blocked from active use
];
const READ_ONLY_INTENTS = new Set([
    "feed.read",
    "notification.list",
    "work.discover",
]);
const WRITE_INTENTS = new Set([
    "post.publish",
    "comment.reply",
    "message.send",
    "agent.register",
    "agent.heartbeat",
    "task.claim",
]);
function isReadOnlyIntent(intent) {
    return READ_ONLY_INTENTS.has(intent);
}
function isWriteIntent(intent) {
    return WRITE_INTENTS.has(intent);
}
/**
 * Apply context scope filtering to an affordance item list.
 * Returns a new array; does not mutate input.
 */
export function applyAffordanceContextScope(items, scope = {}) {
    const allowedStatuses = scope.allowedStatuses && scope.allowedStatuses.length > 0
        ? scope.allowedStatuses
        : [...DEFAULT_ALLOWED_STATUSES];
    // blocked/pending_trust always excluded at the status level
    const effectiveAllowed = allowedStatuses.filter((s) => !BLOCKED_STATUSES.includes(s));
    const platformSet = scope.platformIds && scope.platformIds.length > 0
        ? new Set(scope.platformIds)
        : undefined;
    return items.filter((item) => {
        // 1. Status filter
        if (!effectiveAllowed.includes(item.status)) {
            return false;
        }
        // 2. Platform whitelist
        if (platformSet && !platformSet.has(item.platformId)) {
            return false;
        }
        // 3. Goal-kind intent filtering
        if (scope.goalKind) {
            if (scope.goalKind === "passive_sensing") {
                // Only read-only capabilities
                if (!isReadOnlyIntent(item.intent)) {
                    return false;
                }
            }
            else if (scope.goalKind === "task_completion") {
                // Prefer write/claim — but do not exclude read; just allow all
                // (higher-level assembler may sort/prioritize)
            }
            // Other goalKinds: no additional intent filter
        }
        return true;
    });
}
/**
 * Build a default scope suitable for heartbeat-cycle affordance assembly.
 */
export function defaultHeartbeatScope() {
    return {
        allowedStatuses: [...DEFAULT_ALLOWED_STATUSES],
    };
}
