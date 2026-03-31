import * as crypto from "crypto";
const GLOBAL_SCOPE = "global-control-plane-flight";
const DEFAULT_TTL_MS = 90_000;
export class LeaseManager {
    ttlMs;
    leases = new Map();
    constructor(ttlMs = DEFAULT_TTL_MS) {
        this.ttlMs = ttlMs;
    }
    async acquire(effectClass, scopeHint) {
        const scope = this.resolveScope(effectClass, scopeHint);
        if (!scope) {
            return {
                id: "no-lease-required",
                granted: true,
                scope: "none",
                async release() {
                    return;
                },
            };
        }
        const now = Date.now();
        const existing = this.leases.get(scope);
        if (existing && existing.expiresAt > now) {
            return {
                id: existing.id,
                granted: false,
                scope,
                async release() {
                    return;
                },
            };
        }
        const record = {
            id: crypto.randomUUID(),
            scope,
            expiresAt: now + this.ttlMs,
        };
        this.leases.set(scope, record);
        return {
            id: record.id,
            granted: true,
            scope,
            release: async () => {
                const current = this.leases.get(scope);
                if (current && current.id === record.id) {
                    this.leases.delete(scope);
                }
            },
        };
    }
    resolveScope(effectClass, scopeHint) {
        if (effectClass === "external_platform_action" || effectClass === "user_outreach") {
            return scopeHint && scopeHint.length > 0 ? `${GLOBAL_SCOPE}:${scopeHint}` : GLOBAL_SCOPE;
        }
        return null;
    }
}
