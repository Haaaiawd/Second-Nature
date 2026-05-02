/**
 * T3.3.1 — Near-real connector smoke: sentinel adapters + policy + telemetry + life evidence ingest.
 * Uses fixture payloads (no live HTTP); task.claim runs with idempotency key (dry-run style outcome).
 */
import { eq } from "drizzle-orm";

import type { ConnectorRequest, ExecutionPlan, ExecutionRunner, RouteContextPort } from "../base/contract.js";
import { CapabilityContractRegistry } from "../base/manifest.js";
import { ConnectorRoutePlanner } from "../base/route-planner.js";
import { ChannelHealthStore } from "../base/channel-health.js";
import { createConnectorPolicyLayer } from "../base/policy-layer.js";
import { InMemoryEffectCommitLedger } from "../base/execution-policy.js";
import { mapLifeEvidence } from "../base/map-life-evidence.js";
import { moltbookManifest } from "../social-community/moltbook/manifest.js";
import { evomapManifest } from "../agent-network/evomap/manifest.js";
import { ExecutionTelemetry } from "../../observability/services/execution-telemetry.js";
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import { executionAttempts } from "../../observability/db/schema/index.js";
import type { StateDatabase } from "../../storage/db/index.js";
import { appendLifeEvidence } from "../../storage/life-evidence/append-life-evidence.js";

const DECISION_ID = "dec-near-real-smoke";

function smokeRouteContext(): RouteContextPort {
  return {
    async loadCredentialState(platformId: string) {
      if (platformId === "moltbook") {
        return { platformId, status: "active", credentialType: "api_key" };
      }
      if (platformId === "evomap") {
        return { platformId, status: "active", credentialType: "node_secret" };
      }
      throw new Error(`near_real_smoke_unsupported_platform:${platformId}`);
    },
    async loadCooldownState() {
      return { blocked: false as const };
    },
  };
}

const smokeExecutionRunner: ExecutionRunner = {
  async run(plan: ExecutionPlan, request: ConnectorRequest) {
    if (plan.platformId === "moltbook" && plan.intent === "feed.read") {
      return {
        platformId: plan.platformId,
        channel: plan.channel,
        latencyMs: 2,
        success: true,
        payload: {
          items: [{ id: "mb-smoke-1", title: "near-real fixture post" }],
        },
      };
    }
    if (plan.platformId === "evomap" && plan.intent === "work.discover") {
      return {
        platformId: plan.platformId,
        channel: plan.channel,
        latencyMs: 3,
        success: true,
        payload: {
          items: [{ id: "ev-task-smoke-1", title: "fixture agent task" }],
        },
      };
    }
    if (plan.platformId === "evomap" && plan.intent === "task.claim") {
      return {
        platformId: plan.platformId,
        channel: plan.channel,
        latencyMs: 1,
        success: true,
        degraded: plan.degraded,
        payload: {
          dryRun: true,
          taskId: typeof request.payload.taskId === "string" ? request.payload.taskId : "unknown",
          note: "near_real_smoke_no_external_side_effect",
        },
      };
    }

    throw new Error(`near_real_smoke_unhandled:${plan.platformId}:${plan.intent}`);
  },
};

export interface NearRealConnectorSmokeResult {
  generatedAt: string;
  platforms: { social: "moltbook"; agentNetwork: "evomap" };
  feedReadEvidenceId?: string;
  workDiscoverEvidenceId?: string;
  taskClaimDryRunOk: boolean;
  executionAttemptRowsForDecision: number;
}

export interface RunNearRealConnectorSmokeInput {
  state: StateDatabase;
  observabilityDb: ObservabilityDatabase;
  workspaceRoot: string;
}

export async function runNearRealConnectorSmoke(input: RunNearRealConnectorSmokeInput): Promise<NearRealConnectorSmokeResult> {
  const ledger = new InMemoryEffectCommitLedger();
  const registry = new CapabilityContractRegistry();
  registry.register({ ...moltbookManifest });
  registry.register({ ...evomapManifest });

  const planner = new ConnectorRoutePlanner(registry, smokeRouteContext(), new ChannelHealthStore());
  const telemetry = new ExecutionTelemetry(input.observabilityDb);

  const policy = createConnectorPolicyLayer({
    routePlanner: planner,
    executionRunner: smokeExecutionRunner,
    telemetry,
    effectCommitLedger: ledger,
    retryPolicy: { maxRetries: 1, jitter: false },
  });

  const base = {
    decisionId: DECISION_ID,
    payload: {},
  };

  const feedResult = await policy.executeWithPolicy("feed.read", {
    platformId: "moltbook",
    intent: "feed.read",
    ...base,
    intentId: "intent-smoke-feed-read",
    payload: {},
  });

  let feedReadEvidenceId: string | undefined;
  const feedCand = mapLifeEvidence({
    platformId: "moltbook",
    intent: "feed.read",
    result: feedResult,
  });
  if (feedCand) {
    const ack = await appendLifeEvidence(input.state, input.workspaceRoot, feedCand);
    feedReadEvidenceId = ack.evidenceId;
  }

  const workResult = await policy.executeWithPolicy("work.discover", {
    platformId: "evomap",
    intent: "work.discover",
    ...base,
    intentId: "intent-smoke-work-discover",
    payload: {},
  });

  let workDiscoverEvidenceId: string | undefined;
  const workCand = mapLifeEvidence({
    platformId: "evomap",
    intent: "work.discover",
    result: workResult,
  });
  if (workCand) {
    const ack = await appendLifeEvidence(input.state, input.workspaceRoot, workCand);
    workDiscoverEvidenceId = ack.evidenceId;
  }

  const claimResult = await policy.executeWithPolicy("task.claim", {
    platformId: "evomap",
    intent: "task.claim",
    ...base,
    intentId: "intent-smoke-task-claim",
    payload: { taskId: "ev-task-smoke-1" },
    idempotencyKey: "idem-near-real-task-claim-smoke",
  });

  const claimPayload =
    claimResult.status === "success" && claimResult.data && typeof claimResult.data === "object"
      ? (claimResult.data as Record<string, unknown>)
      : undefined;

  const attemptRows = await input.observabilityDb.db
    .select()
    .from(executionAttempts)
    .where(eq(executionAttempts.decisionId, DECISION_ID));

  return {
    generatedAt: new Date().toISOString(),
    platforms: { social: "moltbook", agentNetwork: "evomap" },
    feedReadEvidenceId,
    workDiscoverEvidenceId,
    taskClaimDryRunOk:
      claimResult.status === "success" &&
      claimPayload?.dryRun === true &&
      claimPayload?.note === "near_real_smoke_no_external_side_effect",
    executionAttemptRowsForDecision: attemptRows.length,
  };
}
