import { ConnectorPolicyError } from "./failure-taxonomy.js";
const HIGH_RISK_SIDE_EFFECTS = new Set([
    "post.publish",
    "comment.reply",
    "message.send",
    "task.claim",
]);
function endpointModeFor(channel) {
    if (channel === "a2a")
        return "a2a_envelope";
    if (channel === "cli")
        return "cli_stdout";
    if (channel === "skill" || channel === "browser")
        return "skill_call";
    return "rest_json";
}
const DEFAULT_DEGRADED_CHANNELS = ["cli", "skill", "browser"];
function isDegradedChannel(channel, degradedChannels) {
    const policy = degradedChannels && degradedChannels.length > 0 ? degradedChannels : DEFAULT_DEGRADED_CHANNELS;
    return policy.includes(channel);
}
function chooseByCredentialState(channels, credential) {
    if (credential.status === "pending_verification") {
        if (channels.includes("skill"))
            return "skill";
        if (channels.includes("browser"))
            return "browser";
        throw new ConnectorPolicyError("verification_required", "verification_recovery_channel_missing");
    }
    return undefined;
}
function choosePreferred(channels, preferred) {
    if (preferred && channels.includes(preferred))
        return preferred;
    return undefined;
}
function chooseHealthy(channels, platformId, health) {
    for (const channel of channels) {
        const snapshot = health.get(platformId, channel);
        if (!snapshot)
            return channel;
        if (snapshot.healthy && !snapshot.degraded)
            return channel;
        if (snapshot.healthy)
            return channel;
    }
    return channels[0];
}
function enforceSideEffectSafety(intent, channel, degradedChannels) {
    if (!HIGH_RISK_SIDE_EFFECTS.has(intent)) {
        return;
    }
    if (isDegradedChannel(channel, degradedChannels)) {
        throw new ConnectorPolicyError("protocol_mismatch", "degraded_channel_not_allowed_for_side_effect");
    }
}
export class ConnectorRoutePlanner {
    registry;
    statePort;
    channelHealth;
    constructor(registry, statePort, channelHealth) {
        this.registry = registry;
        this.statePort = statePort;
        this.channelHealth = channelHealth;
    }
    async planRoute(intent, request) {
        const manifest = this.registry.loadManifest(request.platformId);
        if (!manifest.supportedCapabilities.includes(intent)) {
            throw new ConnectorPolicyError("protocol_mismatch", "capability_not_supported_by_manifest");
        }
        const cooldown = await this.statePort.loadCooldownState(request.platformId, intent);
        if (cooldown.blocked) {
            throw new ConnectorPolicyError("cooldown_blocked", "platform_or_intent_cooldown_blocked", cooldown.retryAfterMs);
        }
        const credential = await this.statePort.loadCredentialState(request.platformId);
        if (credential.status === "missing" || credential.status === "revoked" || credential.status === "failed") {
            throw new ConnectorPolicyError("auth_failure", "credential_unavailable_for_route");
        }
        if (credential.status === "expired") {
            throw new ConnectorPolicyError("credential_expired", "credential_expired_for_route");
        }
        const channels = [...manifest.channelPriority];
        const byCredential = chooseByCredentialState(channels, credential);
        const preferred = choosePreferred(channels, request.preferredChannel);
        const selected = byCredential ?? preferred ?? chooseHealthy(channels, request.platformId, this.channelHealth);
        if (!selected) {
            throw new ConnectorPolicyError("protocol_mismatch", "no_available_channel");
        }
        enforceSideEffectSafety(intent, selected, manifest.degradedChannels);
        return {
            platformId: request.platformId,
            intent,
            channel: selected,
            endpointMode: endpointModeFor(selected),
            idempotencyKey: request.idempotencyKey,
            degraded: isDegradedChannel(selected, manifest.degradedChannels),
        };
    }
}
