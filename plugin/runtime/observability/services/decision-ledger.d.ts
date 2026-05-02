import type { ObservabilityDatabase } from "../db/index.js";
import type { DecisionRecord } from "../../shared/types/continuity.js";
export interface QuietLifecycleEvent {
    id: string;
    tickId: string;
    eventType: "quiet.entered" | "quiet.skipped" | "quiet.interrupted" | "quiet.resumed" | "quiet.suppressed";
    reason?: string;
    suppressedBy?: string;
    reflectionCandidates?: string[];
    createdAt: string;
}
export interface OutreachDecision {
    id: string;
    tickId: string;
    eventType: "outreach.considered" | "outreach.denied" | "outreach.deferred" | "outreach.sent";
    platformId?: string;
    targetUserId?: string;
    valueScore?: number;
    suppressionReason?: string;
    messagePreview?: string;
    createdAt: string;
}
export interface HeartbeatDecisionEvent {
    id: string;
    tickId: string;
    traceId: string;
    runtimeScope: "rhythm" | "user_task" | "user_reply";
    triggerSource: "heartbeat_bridge" | "user_task" | "user_reply" | "interrupt" | "resume";
    decisionStatus: "heartbeat_ok" | "intent_selected" | "denied" | "deferred" | "runtime_carrier_only";
    reasons: string[];
    intentId?: string;
    mode: "active" | "quiet" | "maintenance_only" | "paused_for_interrupt";
    createdAt: string;
}
export declare class DecisionLedger {
    private db;
    constructor(db: ObservabilityDatabase);
    recordDecision(record: DecisionRecord): Promise<void>;
    recordHeartbeatDecision(event: HeartbeatDecisionEvent): Promise<void>;
    recordQuietLifecycle(event: QuietLifecycleEvent): Promise<void>;
    recordOutreachDecision(event: OutreachDecision): Promise<void>;
    queryByTickId(tickId: string): Promise<DecisionRecord[]>;
    queryByTraceId(traceId: string): Promise<DecisionRecord | null>;
    queryByIntentId(intentId: string): Promise<DecisionRecord[]>;
    private mapToDecisionRecord;
}
