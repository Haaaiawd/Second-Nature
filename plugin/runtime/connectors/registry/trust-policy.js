/**
 * Classify manifest runner into trust status per v6 trust decision tree.
 * declarative_http/a2a/mcp -> declarative_trusted
 * cli_descriptor -> declarative_trusted (P0 conditional; dry-run/read path优先)
 * custom_adapter/skill/browser -> custom_adapter_pending_trust
 * explicit blocked/trusted_custom_adapter in manifest.trust respected.
 */
export function classifyTrust(manifest) {
    if (manifest.trust?.status === "blocked") {
        return "blocked";
    }
    if (manifest.trust?.status === "trusted_custom_adapter") {
        return "trusted_custom_adapter";
    }
    const kind = manifest.runner.kind;
    switch (kind) {
        case "declarative_http":
        case "declarative_a2a":
        case "declarative_mcp":
        case "cli_descriptor":
            return "declarative_trusted";
        case "custom_adapter":
        case "skill":
        case "browser":
            return "custom_adapter_pending_trust";
        default: {
            // Exhaustive check; unknown runner kind is blocked for safety
            return "blocked";
        }
    }
}
/**
 * Determine whether a connector entry is executable based on trust status.
 */
export function isExecutable(trustStatus) {
    return trustStatus === "declarative_trusted" || trustStatus === "trusted_custom_adapter";
}
