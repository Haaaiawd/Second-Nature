import { readConnectorCooldownState } from "../../storage/v8-state-stores.js";
export function createCredentialRouteContextPort(vault, db) {
    return {
        async loadCredentialState(platformId) {
            const ctx = await vault.loadCredentialContext(platformId);
            // Defensive: some ORM findFirst variants return {} instead of null/undefined.
            if (!ctx || !ctx.platformId || !ctx.status) {
                return {
                    platformId,
                    status: "missing",
                    credentialType: "api_key",
                };
            }
            return ctx;
        },
        async loadCooldownState(platformId, intent) {
            const read = await readConnectorCooldownState(db, platformId, intent);
            if (read.degraded) {
                // Fail-closed on unreadable cooldown state
                return { blocked: true, reason: "cooldown_state_unreadable" };
            }
            if (!read.row) {
                return { blocked: false };
            }
            const now = new Date().toISOString();
            const blocked = new Date(read.row.blockedUntil).getTime() > new Date(now).getTime();
            return {
                blocked,
                retryAfterMs: blocked
                    ? Math.max(0, new Date(read.row.blockedUntil).getTime() - new Date(now).getTime())
                    : undefined,
            };
        },
    };
}
