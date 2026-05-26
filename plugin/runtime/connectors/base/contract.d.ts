import type { CredentialContext, CredentialState } from "../../shared/types/credential.js";
import { type FailureClass } from "./failure-taxonomy.js";
export declare const CHANNEL_TYPES: readonly ["api_rest", "api_rpc", "a2a", "mcp", "cli", "skill", "browser"];
export type ChannelType = (typeof CHANNEL_TYPES)[number];
export declare const CAPABILITY_INTENTS: readonly ["feed.read", "post.publish", "comment.reply", "notification.list", "message.send", "agent.register", "agent.heartbeat", "work.discover", "task.claim"];
export type BuiltInCapabilityIntent = (typeof CAPABILITY_INTENTS)[number];
export type CapabilityIntent = BuiltInCapabilityIntent | (string & {});
export declare function isKnownCapabilityIntent(intent: string): intent is BuiltInCapabilityIntent;
export interface ConnectorRequestIdentity {
    /** Platform handle for the target platform (readable, no credential). */
    platformHandle?: string;
    /** Canonical name across all platforms. */
    canonicalName?: string;
}
export interface ConnectorRequest {
    platformId: string;
    intent: CapabilityIntent;
    payload: Record<string, unknown>;
    preferredChannel?: ChannelType;
    timeoutMs?: number;
    idempotencyKey?: string;
    decisionId?: string;
    intentId?: string;
    /** T-V7C.C.4: identity for connector request (readable, no credential). */
    identity?: ConnectorRequestIdentity;
}
export interface ExecutionPlan {
    platformId: string;
    intent: CapabilityIntent;
    channel: ChannelType;
    endpointMode: "rest_json" | "a2a_envelope" | "cli_stdout" | "skill_call";
    idempotencyKey?: string;
    /** True when selected channel is manifest-marked degraded (cli/skill/browser). */
    degraded?: boolean;
}
export interface ConnectorResult<T> {
    status: "success" | "retryable_failure" | "terminal_failure";
    data?: T;
    failureClass?: FailureClass;
    retryAfterMs?: number;
    executionId?: string;
    metadata: {
        platformId: string;
        channel: ChannelType;
        latencyMs: number;
        degraded?: boolean;
    };
}
export interface RawAttempt {
    platformId: string;
    channel: ChannelType;
    latencyMs: number;
    degraded?: boolean;
    success: boolean;
    payload?: unknown;
    error?: unknown;
}
export interface CredentialContextPort {
    loadCredentialState(platformId: string): Promise<CredentialContext>;
}
export interface CooldownLedgerPort {
    loadCooldownState(platformId: string, intent: CapabilityIntent): Promise<{
        blocked: boolean;
        retryAfterMs?: number;
    }>;
}
export interface RouteContextPort extends CredentialContextPort, CooldownLedgerPort {
}
export interface ConnectorManifestLike {
    platformId: string;
    supportedCapabilities: CapabilityIntent[];
    channelPriority: ChannelType[];
    credentialTypes: string[];
    degradedChannels?: ChannelType[];
    sourceRefPolicy?: {
        minSourceRefs?: number;
        rejectInlineSensitivePayload?: boolean;
    };
}
export interface ConnectorManifestLoader {
    loadManifest(platformId: string): ConnectorManifestLike;
}
export interface RoutePlanner {
    planRoute(intent: CapabilityIntent, request: ConnectorRequest): Promise<ExecutionPlan>;
}
export interface ExecutionRunner {
    run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt>;
}
export interface ConnectorExecutionPort {
    executeCapability(intent: CapabilityIntent, request: ConnectorRequest): Promise<ConnectorResult<unknown>>;
}
export interface ConnectorExecutor {
    executeEffect(input: {
        platformId: string;
        intent: CapabilityIntent;
        payload: Record<string, unknown>;
        decisionId: string;
        intentId: string;
        idempotencyKey: string;
        /** T-V7C.C.4: identity for connector request (readable, no credential). */
        identity?: ConnectorRequestIdentity;
    }): Promise<ConnectorResult<unknown>>;
}
export declare function normalizeOutcome(attempt: RawAttempt): ConnectorResult<unknown>;
export declare function createConnectorContractCore(input: {
    manifestLoader: ConnectorManifestLoader;
    routePlanner: RoutePlanner;
    executionRunner: ExecutionRunner;
}): ConnectorExecutionPort;
export declare function isCredentialActive(state: CredentialState): boolean;
