import { z } from "zod";

import type {
  CredentialContext,
  CredentialState,
} from "../../shared/types/credential.js";
import {
  classifyFailure,
  ConnectorPolicyError,
  type FailureClass,
} from "./failure-taxonomy.js";

export const CHANNEL_TYPES = [
  "api_rest",
  "api_rpc",
  "a2a",
  "mcp",
  "cli",
  "skill",
  "browser",
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CAPABILITY_INTENTS = [
  "feed.read",
  "post.publish",
  "comment.reply",
  "notification.list",
  "message.send",
  "agent.register",
  "agent.heartbeat",
  "work.discover",
  "task.claim",
] as const;
export type BuiltInCapabilityIntent = (typeof CAPABILITY_INTENTS)[number];
export type CapabilityIntent = BuiltInCapabilityIntent | (string & {});

export function isKnownCapabilityIntent(intent: string): intent is BuiltInCapabilityIntent {
  return (CAPABILITY_INTENTS as readonly string[]).includes(intent);
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
  loadCooldownState(
    platformId: string,
    intent: CapabilityIntent,
  ): Promise<{ blocked: boolean; retryAfterMs?: number }>;
}

export interface RouteContextPort
  extends CredentialContextPort, CooldownLedgerPort {}

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
  planRoute(
    intent: CapabilityIntent,
    request: ConnectorRequest,
  ): Promise<ExecutionPlan>;
}

export interface ExecutionRunner {
  run(plan: ExecutionPlan, request: ConnectorRequest): Promise<RawAttempt>;
}

export interface ConnectorExecutionPort {
  executeCapability(
    intent: CapabilityIntent,
    request: ConnectorRequest,
  ): Promise<ConnectorResult<unknown>>;
}

export interface ConnectorExecutor {
  executeEffect(input: {
    platformId: string;
    intent: CapabilityIntent;
    payload: Record<string, unknown>;
    decisionId: string;
    intentId: string;
    idempotencyKey: string;
  }): Promise<ConnectorResult<unknown>>;
}

const capabilityIntentSchema = z.string().min(1).regex(/^[a-zA-Z0-9_.:-]+$/);

const connectorRequestSchema = z.object({
  platformId: z.string().min(1),
  intent: capabilityIntentSchema,
  payload: z.record(z.string(), z.unknown()),
  preferredChannel: z.enum(CHANNEL_TYPES).optional(),
  timeoutMs: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(1).optional(),
  decisionId: z.string().min(1).optional(),
  intentId: z.string().min(1).optional(),
});

export function normalizeOutcome(
  attempt: RawAttempt,
): ConnectorResult<unknown> {
  if (attempt.success) {
    return {
      status: "success",
      data: attempt.payload,
      metadata: {
        platformId: attempt.platformId,
        channel: attempt.channel,
        latencyMs: attempt.latencyMs,
        degraded: attempt.degraded,
      },
    };
  }

  const failure = classifyFailure(attempt.error);
  return {
    status: failure.retryable ? "retryable_failure" : "terminal_failure",
    failureClass: failure.class,
    retryAfterMs: failure.retryAfterMs,
    metadata: {
      platformId: attempt.platformId,
      channel: attempt.channel,
      latencyMs: attempt.latencyMs,
      degraded: attempt.degraded,
    },
  };
}

export function createConnectorContractCore(input: {
  manifestLoader: ConnectorManifestLoader;
  routePlanner: RoutePlanner;
  executionRunner: ExecutionRunner;
}): ConnectorExecutionPort {
  const { manifestLoader, routePlanner, executionRunner } = input;

  return {
    async executeCapability(
      intent: CapabilityIntent,
      request: ConnectorRequest,
    ): Promise<ConnectorResult<unknown>> {
      connectorRequestSchema.parse(request);
      if (intent !== request.intent) {
        throw new Error("connector_intent_mismatch");
      }

      const manifest = manifestLoader.loadManifest(request.platformId);
      if (!manifest.supportedCapabilities.includes(intent)) {
        throw new ConnectorPolicyError(
          "protocol_mismatch",
          "capability_not_supported_by_manifest",
        );
      }

      const plan = await routePlanner.planRoute(intent, request);
      const attempt = await executionRunner.run(plan, request);
      return normalizeOutcome(attempt);
    },
  };
}

export function isCredentialActive(state: CredentialState): boolean {
  return state === "active";
}
