/**
 * Runtime Decision Recorder (T1.2.3).
 *
 * Core logic: after a workspace `runHeartbeatCycle` completes, persist two rows that
 * `loadStatus` already filters on, so operator status stops returning `unknown` for
 * `rhythm.mode` / `runtime.serviceStatus` once the runtime has executed at least once.
 *  - `decision_ledger` row via `DecisionLedger.recordHeartbeatDecision()` with
 *    `traceId` prefix `sn-runtime-` (matches `INTERNAL_RUNTIME_TRACE_PREFIX`).
 *  - `execution_attempts` row via `ExecutionTelemetry.startAttempt` +
 *    `completeAttempt` with `platformId === "second-nature-runtime"` (matches
 *    `INTERNAL_RUNTIME_PLATFORM_ID`).
 *
 * Boundaries:
 *  - Recorder failure must NOT break the heartbeat surface response — caller wraps with try/catch.
 *  - Carrier-only / probe-only / runtime-unavailable paths do NOT invoke this recorder
 *    (their semantics intentionally remain "unknown" until a full-runtime turn happens).
 *  - This is a derived observability writer; it is not the canonical decision producer
 *    (control-plane keeps that contract). It exists to close the read-side aggregation gap.
 */
import { randomUUID } from "node:crypto";

import type { ObservabilityDatabase } from "../db/index.js";
import { DecisionLedger, type HeartbeatDecisionEvent } from "./decision-ledger.js";
import { ExecutionTelemetry } from "./execution-telemetry.js";
import type {
  HeartbeatCycleResult,
  HeartbeatCycleStatus,
  HeartbeatSignal,
  RuntimeScope,
} from "../../core/second-nature/heartbeat/signal.js";

export const RUNTIME_DECISION_TRACE_PREFIX = "sn-runtime-";
export const RUNTIME_INTERNAL_PLATFORM_ID = "second-nature-runtime";
const RUNTIME_INTERNAL_CAPABILITY = "runtime.heartbeat";
const RUNTIME_INTERNAL_CHANNEL = "internal";

export interface RecordHeartbeatCycleInput {
  cycle: HeartbeatCycleResult;
  signal: HeartbeatSignal;
  /**
   * Override rhythm `mode` written to the ledger row. When omitted, falls back
   * to `"active"`; downstream loadStatus only treats `quiet` /
   * `maintenance_only` / `paused_for_interrupt` as Quiet-aware values.
   */
  rhythmMode?: HeartbeatDecisionEvent["mode"];
}

export interface RecordHeartbeatCycleOutput {
  traceId: string;
  decisionId: string;
  attemptId: string;
}

export interface RuntimeDecisionRecorder {
  recordHeartbeatCycle(input: RecordHeartbeatCycleInput): Promise<RecordHeartbeatCycleOutput>;
}

export interface CreateRuntimeDecisionRecorderDeps {
  ledger?: DecisionLedger;
  telemetry?: ExecutionTelemetry;
}

export function createRuntimeDecisionRecorder(
  observabilityDb: ObservabilityDatabase,
  overrides: CreateRuntimeDecisionRecorderDeps = {},
): RuntimeDecisionRecorder {
  const ledger = overrides.ledger ?? new DecisionLedger(observabilityDb);
  const telemetry = overrides.telemetry ?? new ExecutionTelemetry(observabilityDb);

  return {
    async recordHeartbeatCycle({ cycle, signal, rhythmMode }) {
      const timestamp =
        typeof signal.payload.timestamp === "string" && signal.payload.timestamp.trim().length > 0
          ? signal.payload.timestamp
          : new Date().toISOString();
      const uniqueId = randomUUID();
      const traceId = `${RUNTIME_DECISION_TRACE_PREFIX}${cycle.scope}-${cycle.status}-${uniqueId}`;
      const decisionId = `decision-runtime-${uniqueId}`;
      const tickId = `tick-runtime-${uniqueId}`;

      const event: HeartbeatDecisionEvent = {
        id: decisionId,
        tickId,
        traceId,
        runtimeScope: cycle.scope as RuntimeScope,
        triggerSource: signal.trigger,
        decisionStatus: mapCycleStatus(cycle.status),
        reasons: cycle.reasons,
        intentId: cycle.selectedIntentId,
        mode: rhythmMode ?? "active",
        createdAt: timestamp,
      };

      await ledger.recordHeartbeatDecision(event);

      const attemptId = await telemetry.startAttempt({
        traceId,
        decisionId,
        intentId: cycle.selectedIntentId ?? `${RUNTIME_INTERNAL_PLATFORM_ID}-tick`,
        platformId: RUNTIME_INTERNAL_PLATFORM_ID,
        capability: RUNTIME_INTERNAL_CAPABILITY,
        channel: RUNTIME_INTERNAL_CHANNEL,
        startedAt: timestamp,
      });

      const status = isFailureCycle(cycle.status) ? "failed" : "succeeded";
      const failureClass = status === "failed" ? cycleStatusFailureClass(cycle.status) : undefined;
      await telemetry.completeAttempt(traceId, status, undefined, failureClass);

      return { traceId, decisionId, attemptId };
    },
  };
}

function mapCycleStatus(status: HeartbeatCycleStatus): HeartbeatDecisionEvent["decisionStatus"] {
  switch (status) {
    case "intent_selected":
      return "intent_selected";
    case "denied":
      return "denied";
    case "deferred":
      return "deferred";
    case "delivery_unavailable":
      return "delivery_unavailable";
    case "runtime_carrier_only":
      return "runtime_carrier_only";
    case "heartbeat_ok":
    default:
      return "heartbeat_ok";
  }
}

function isFailureCycle(status: HeartbeatCycleStatus): boolean {
  return status === "delivery_unavailable" || status === "denied";
}

function cycleStatusFailureClass(status: HeartbeatCycleStatus): string | undefined {
  if (status === "delivery_unavailable") return "delivery_unavailable";
  if (status === "denied") return "decision_denied";
  return undefined;
}
