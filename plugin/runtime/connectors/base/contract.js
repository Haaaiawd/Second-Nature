import { z } from "zod";
import { classifyFailure, ConnectorPolicyError, } from "./failure-taxonomy.js";
export const CHANNEL_TYPES = [
    "api_rest",
    "api_rpc",
    "a2a",
    "mcp",
    "cli",
    "skill",
    "browser",
];
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
];
export function isKnownCapabilityIntent(intent) {
    return CAPABILITY_INTENTS.includes(intent);
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
export function normalizeOutcome(attempt) {
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
export function createConnectorContractCore(input) {
    const { manifestLoader, routePlanner, executionRunner } = input;
    return {
        async executeCapability(intent, request) {
            connectorRequestSchema.parse(request);
            if (intent !== request.intent) {
                throw new Error("connector_intent_mismatch");
            }
            const manifest = manifestLoader.loadManifest(request.platformId);
            if (!manifest.supportedCapabilities.includes(intent)) {
                throw new ConnectorPolicyError("protocol_mismatch", "capability_not_supported_by_manifest");
            }
            const plan = await routePlanner.planRoute(intent, request);
            const attempt = await executionRunner.run(plan, request);
            return normalizeOutcome(attempt);
        },
    };
}
export function isCredentialActive(state) {
    return state === "active";
}
