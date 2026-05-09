import { ConnectorPolicyError, classifyFailure, type FailureClass } from "./failure-taxonomy.js";
import { enforceExecutionPolicy, type EffectCommitLedgerPort } from "./execution-policy.js";
import type {
  CapabilityIntent,
  ChannelType,
  ConnectorRequest,
  ConnectorResult,
  ExecutionPlan,
  ExecutionRunner,
  RoutePlanner,
} from "./contract.js";
import type { ExecutionTelemetry } from "../../observability/services/execution-telemetry.js";

const DEFAULT_RETRY_MAX = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export interface CooldownPort {
  isBlocked(platformId: string, intent: CapabilityIntent): Promise<{ blocked: boolean; retryAfterMs?: number }>;
  markFailure(platformId: string, intent: CapabilityIntent, failureClass: FailureClass, retryAfterMs?: number): Promise<void>;
}

export interface ConnectorPolicyContext {
  routePlanner: RoutePlanner;
  executionRunner: ExecutionRunner;
  telemetry?: ExecutionTelemetry;
  cooldownPort?: CooldownPort;
  retryPolicy?: Partial<RetryPolicy>;
  allowDegradedFallback?: (plan: ExecutionPlan, request: ConnectorRequest) => boolean;
  effectCommitLedger?: EffectCommitLedgerPort;
}

function resolveRetryPolicy(input?: Partial<RetryPolicy>): RetryPolicy {
  return {
    maxRetries: input?.maxRetries ?? DEFAULT_RETRY_MAX,
    baseDelayMs: input?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
    maxDelayMs: input?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    jitter: input?.jitter ?? true,
  };
}

function computeRetryDelayMs(attempt: number, policy: RetryPolicy, retryAfterMs?: number): number {
  if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
    return retryAfterMs;
  }
  const base = Math.min(policy.baseDelayMs * 2 ** Math.max(0, attempt - 1), policy.maxDelayMs);
  if (!policy.jitter) return base;
  return Math.floor(base * 0.8 + Math.random() * base * 0.4);
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function makeTraceId(request: ConnectorRequest, plan: ExecutionPlan): string {
  return `${request.platformId}:${request.intent}:${plan.channel}:${Date.now()}`;
}

function resolveIdentity(request: ConnectorRequest): { decisionId: string; intentId: string } {
  if (!request.decisionId || !request.intentId) {
    throw new Error("connector_policy_missing_decision_or_intent_identity");
  }
  return {
    decisionId: request.decisionId,
    intentId: request.intentId,
  };
}

function isDegradedChannel(channel: ChannelType): boolean {
  return channel === "cli" || channel === "skill" || channel === "browser";
}

function adaptProtocolErrors(error: unknown): unknown {
  if (!error || typeof error !== "object") {
    return error;
  }

  const record = error as Record<string, unknown>;
  const detail = typeof record.detail === "string" ? record.detail : "";

  if (detail === "node_secret_required") {
    return { code: "verification_required", detail };
  }
  if (detail === "bundle_required") {
    return { code: "protocol_mismatch", detail };
  }
  if (detail === "asset_id mismatch") {
    return { code: "protocol_mismatch", detail };
  }

  return error;
}

export function createConnectorPolicyLayer(ctx: ConnectorPolicyContext) {
  const retryPolicy = resolveRetryPolicy(ctx.retryPolicy);
  const allowDegradedFallback = ctx.allowDegradedFallback ?? (() => true);

  return {
    async executeWithPolicy(intent: CapabilityIntent, request: ConnectorRequest): Promise<ConnectorResult<unknown>> {
      if (ctx.cooldownPort) {
        const cooldown = await ctx.cooldownPort.isBlocked(request.platformId, intent);
        if (cooldown.blocked) {
          return {
            status: "terminal_failure",
            failureClass: "cooldown_blocked",
            retryAfterMs: cooldown.retryAfterMs,
            metadata: {
              platformId: request.platformId,
              channel: request.preferredChannel ?? "api_rest",
              latencyMs: 0,
            },
          };
        }
      }

      const identity = resolveIdentity(request);

      let plan: ExecutionPlan;
      try {
        plan = await ctx.routePlanner.planRoute(intent, request);
      } catch (error) {
        const failure = classifyFailure(error);
        return {
          status: "terminal_failure",
          failureClass: failure.class,
          retryAfterMs: failure.retryAfterMs,
          metadata: {
            platformId: request.platformId,
            channel: request.preferredChannel ?? "api_rest",
            latencyMs: 0,
          },
        };
      }

      if (isDegradedChannel(plan.channel) && !allowDegradedFallback(plan, request)) {
        return {
          status: "terminal_failure",
          failureClass: "protocol_mismatch",
          metadata: {
            platformId: request.platformId,
            channel: plan.channel,
            latencyMs: 0,
            degraded: true,
          },
        };
      }

      const policyGate = await enforceExecutionPolicy(plan, intent, request, {
        effectCommitLedger: ctx.effectCommitLedger,
      });
      if (policyGate.skipAdapter && policyGate.existingOutcomeRef) {
        return {
          status: "success",
          data: { replayedCommit: true, outcomeRef: policyGate.existingOutcomeRef },
          metadata: {
            platformId: request.platformId,
            channel: plan.channel,
            latencyMs: 0,
            degraded: plan.degraded,
          },
        };
      }

      let lastFailure: { failureClass: FailureClass; retryAfterMs?: number; channel: ChannelType } | undefined;

      for (let attempt = 1; attempt <= retryPolicy.maxRetries; attempt += 1) {
        const traceId = `${makeTraceId(request, plan)}:${attempt}`;

        if (ctx.telemetry) {
          await ctx.telemetry.startAttempt({
            traceId,
            decisionId: identity.decisionId,
            intentId: identity.intentId,
            platformId: request.platformId,
            capability: request.intent,
            channel: plan.channel,
            retryPolicy: JSON.stringify(retryPolicy),
            idempotencyKey: request.idempotencyKey,
          });
        }

        const raw = await ctx.executionRunner.run(plan, request);
        if (raw.success) {
          if (ctx.telemetry) {
            await ctx.telemetry.completeAttempt(traceId, "succeeded");
          }

          return {
            status: "success",
            data: raw.payload,
            metadata: {
              platformId: raw.platformId,
              channel: raw.channel,
              latencyMs: raw.latencyMs,
              degraded: raw.degraded,
            },
          };
        }

        const classified = classifyFailure(adaptProtocolErrors(raw.error));
        lastFailure = {
          failureClass: classified.class,
          retryAfterMs: classified.retryAfterMs,
          channel: raw.channel,
        };

        if (ctx.telemetry) {
          await ctx.telemetry.completeAttempt(traceId, "failed", undefined, classified.class);
        }

        if (ctx.cooldownPort) {
          await ctx.cooldownPort.markFailure(request.platformId, intent, classified.class, classified.retryAfterMs);
        }

        const isRetryable = classified.retryable;
        if (!isRetryable || attempt >= retryPolicy.maxRetries) {
          return {
            status: "terminal_failure",
            failureClass: classified.class,
            retryAfterMs: classified.retryAfterMs,
            metadata: {
              platformId: raw.platformId,
              channel: raw.channel,
              latencyMs: raw.latencyMs,
              degraded: raw.degraded,
            },
          };
        }

        const delay = computeRetryDelayMs(attempt, retryPolicy, classified.retryAfterMs);
        await sleep(delay);
      }

      return {
        status: "terminal_failure",
        failureClass: lastFailure?.failureClass ?? "unknown_platform_change",
        retryAfterMs: lastFailure?.retryAfterMs,
        metadata: {
          platformId: request.platformId,
          channel: lastFailure?.channel ?? plan.channel,
          latencyMs: 0,
          degraded: isDegradedChannel(lastFailure?.channel ?? plan.channel),
        },
      };
    },
  };
}
