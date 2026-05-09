import type { ObservabilityDatabase } from "../db/index.js";
import { DecisionLedger, type HeartbeatDecisionEvent } from "./decision-ledger.js";
import { ExecutionTelemetry } from "./execution-telemetry.js";
import type { HeartbeatCycleResult, HeartbeatSignal } from "../../core/second-nature/heartbeat/signal.js";
export declare const RUNTIME_DECISION_TRACE_PREFIX = "sn-runtime-";
export declare const RUNTIME_INTERNAL_PLATFORM_ID = "second-nature-runtime";
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
export declare function createRuntimeDecisionRecorder(observabilityDb: ObservabilityDatabase, overrides?: CreateRuntimeDecisionRecorderDeps): RuntimeDecisionRecorder;
