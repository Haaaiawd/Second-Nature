import type { CredentialContext } from "../../shared/types/credential.js";
import {
  type CapabilityIntent,
  type ChannelType,
  type ConnectorRequest,
  type ExecutionPlan,
  type RouteContextPort,
} from "./contract.js";
import type { CapabilityContractRegistry } from "./manifest.js";
import { ConnectorPolicyError } from "./failure-taxonomy.js";
import { ChannelHealthStore } from "./channel-health.js";

const HIGH_RISK_SIDE_EFFECTS: ReadonlySet<CapabilityIntent> = new Set([
  "post.publish",
  "comment.reply",
  "message.send",
  "task.claim",
]);

function endpointModeFor(channel: ChannelType): ExecutionPlan["endpointMode"] {
  if (channel === "a2a") return "a2a_envelope";
  if (channel === "cli") return "cli_stdout";
  if (channel === "skill" || channel === "browser") return "skill_call";
  return "rest_json";
}

const DEFAULT_DEGRADED_CHANNELS: readonly ChannelType[] = ["cli", "skill", "browser"];

function isDegradedChannel(channel: ChannelType, degradedChannels?: ChannelType[]): boolean {
  const policy = degradedChannels && degradedChannels.length > 0 ? degradedChannels : DEFAULT_DEGRADED_CHANNELS;
  return policy.includes(channel);
}

function chooseByCredentialState(channels: ChannelType[], credential: CredentialContext): ChannelType | undefined {
  if (credential.status === "pending_verification") {
    if (channels.includes("skill")) return "skill";
    if (channels.includes("browser")) return "browser";
    throw new ConnectorPolicyError("verification_required", "verification_recovery_channel_missing");
  }

  return undefined;
}

function choosePreferred(channels: ChannelType[], preferred?: ChannelType): ChannelType | undefined {
  if (preferred && channels.includes(preferred)) return preferred;
  return undefined;
}

function chooseHealthy(channels: ChannelType[], platformId: string, health: ChannelHealthStore): ChannelType | undefined {
  for (const channel of channels) {
    const snapshot = health.get(platformId, channel);
    if (!snapshot) return channel;
    if (snapshot.healthy && !snapshot.degraded) return channel;
    if (snapshot.healthy) return channel;
  }
  return channels[0];
}

function enforceSideEffectSafety(intent: CapabilityIntent, channel: ChannelType, degradedChannels?: ChannelType[]): void {
  if (!HIGH_RISK_SIDE_EFFECTS.has(intent)) {
    return;
  }
  if (isDegradedChannel(channel, degradedChannels)) {
    throw new ConnectorPolicyError("protocol_mismatch", "degraded_channel_not_allowed_for_side_effect");
  }
}

export class ConnectorRoutePlanner {
  constructor(
    private readonly registry: CapabilityContractRegistry,
    private readonly statePort: RouteContextPort,
    private readonly channelHealth: ChannelHealthStore
  ) {}

  async planRoute(intent: CapabilityIntent, request: ConnectorRequest): Promise<ExecutionPlan> {
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
