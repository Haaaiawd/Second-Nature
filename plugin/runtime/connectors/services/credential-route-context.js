export function createCredentialRouteContextPort(vault) {
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
        async loadCooldownState() {
            return { blocked: false };
        },
    };
}
