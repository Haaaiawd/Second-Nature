/**
 * HeartbeatDigestAssembler — T-OBS.C.3 / T-OBS.C.4
 *
 * Core logic: aggregate one day's audit events from AppendOnlyAuditStore
 * into a dashboard-style HeartbeatDigest (connector counts / goal changes /
 * quiet-dream status / health summary). No outreach phrasing. No raw payload.
 * No credential content. If no significant events, isNothingSignificant = true.
 *
 * T-OBS.C.4 delivery hook:
 *   An optional DigestDeliveryAdapter can be injected via deps.deliveryAdapter.
 *   After digest assembly, generateHeartbeatDigest calls adapter.deliver(digest).
 *   On success: digest.deliveredAt and digest.deliveryProof are populated.
 *   On failure: digest.deliveryFallbackReason is set; deliveredAt is NOT set.
 *   Honesty constraint: not_sent is never reported as sent (ADR-007).
 *
 * DR-032 degradation:
 *   If state-memory port is unavailable, goalSummary + quietDreamSummary
 *   return degraded = true with reason. Other sections (connector / health) unaffected.
 *
 * Boundary:
 * - Reads AppendOnlyAuditStore.list() (in-memory) for connector.attempt + heartbeat.decision
 *   + dream.trace + delivery audit events.
 * - Reads optional StateMemoryDigestPort for goal transitions + quiet/dream scheduling state.
 * - Does NOT write to state-memory (persistence is runtime-ops' responsibility).
 * - Does NOT use outreach language (NG2 from PRD: not a "reach out to you" message).
 * - Does NOT push digest itself; delivery is triggered by runtime-ops (NG5 from L0).
 *   The adapter here is an injected hook used during assembly, not an autonomous push.
 *
 * Test coverage:
 *   tests/unit/observability/heartbeat-digest-assembler.test.ts (T-OBS.C.3)
 *   tests/integration/observability/digest-delivery.test.ts (T-OBS.C.4)
 */
import type { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";
export interface ConnectorDaySummary {
    platformId: string;
    capability: string;
    successCount: number;
    failureCount: number;
    circuitOpenCount: number;
    blockedCount: number;
}
export interface GoalDaySummary {
    newGoals: number;
    completedGoals: number;
    expiredGoals: number;
    replacedGoals: number;
    activeGoals: number;
    degraded?: boolean;
    degradedReason?: string;
}
export interface QuietDreamDaySummary {
    quietRuns: number;
    quietSucceeded: number;
    dreamRuns: number;
    dreamAccepted: number;
    dreamSkipped: number;
    dreamSkipReasons: string[];
    degraded?: boolean;
    degradedReason?: string;
}
export interface HealthDaySummary {
    circuitBreakerChanges: number;
    deliverySuccessCount: number;
    deliveryFailureCount: number;
    auditChainHealthy: boolean;
}
export interface DeliveryProofRef {
    channelId: string;
    messageHash: string;
}
export interface RealRunHealthDigestProjection {
    gatePassed: boolean;
    contractSmokeOnly: boolean;
    seededStateDetected: boolean;
    hasRealClosure: boolean;
    hasQuietArtifact: boolean;
    hasDreamArtifact: boolean;
    missingStage?: string;
    missingReason?: string;
}
export interface HeartbeatDigest {
    date: string;
    generatedAt: string;
    isNothingSignificant: boolean;
    connectorSummary: ConnectorDaySummary[];
    goalSummary: GoalDaySummary;
    quietDreamSummary: QuietDreamDaySummary;
    healthSummary: HealthDaySummary;
    /** Real-run health gate result (T-OBS.R.3) */
    realRunHealth: RealRunHealthDigestProjection;
    /** Set when delivery succeeded */
    deliveredAt?: string;
    /** Proof of successful delivery (channel + message hash, no raw content) */
    deliveryProof?: DeliveryProofRef;
    /** Set when delivery failed; status is always "not_sent" in this case */
    deliveryFallbackReason?: string;
}
/** Result from a delivery attempt */
export interface DigestDeliveryResult {
    /**
     * "sent"     — delivery succeeded; proof is populated.
     * "not_sent" — delivery failed or was skipped; fallbackReason is populated.
     */
    status: "sent" | "not_sent";
    proof?: DeliveryProofRef;
    /** Human-readable reason why delivery was not sent */
    fallbackReason?: string;
    deliveredAt?: string;
}
/**
 * Adapter injected by runtime-ops to perform channel-specific delivery.
 * The adapter is responsible for the actual push (Feishu DM / dashboard / etc.).
 * It must never declare "sent" without a verifiable proof.
 */
export interface DigestDeliveryAdapter {
    deliver(digest: HeartbeatDigest): Promise<DigestDeliveryResult>;
}
/** Port for reading goal and quiet/dream scheduling state from state-memory. */
export interface StateMemoryDigestPort {
    queryGoalTransitions(date: string): Promise<{
        newGoals: number;
        completedGoals: number;
        expiredGoals: number;
        replacedGoals: number;
        activeGoals: number;
    }>;
    queryQuietDreamStatus(date: string): Promise<{
        quietRuns: number;
        quietSucceeded: number;
        dreamRuns: number;
        dreamAccepted: number;
        dreamSkipped: number;
        dreamSkipReasons: string[];
    }>;
}
export interface HeartbeatDigestAssemblerDeps {
    auditStore: AppendOnlyAuditStore;
    stateMemoryPort?: StateMemoryDigestPort;
    /**
     * Optional delivery adapter (T-OBS.C.4).
     * When provided, the assembled digest is passed to adapter.deliver() after assembly.
     * Delivery result (proof / fallback) is merged back into the returned digest.
     * Delivery failure does NOT throw — the assembled digest is still returned,
     * with deliveryFallbackReason set.
     */
    deliveryAdapter?: DigestDeliveryAdapter;
    /** Override for testability */
    now?: () => string;
}
/**
 * Generate a HeartbeatDigest for the given date (YYYY-MM-DD).
 *
 * Aggregates connector attempts, heartbeat decisions, dream traces, and delivery
 * audit events from the in-memory audit store. Goal transitions and quiet/dream
 * scheduling state are loaded from state-memory via the optional port (DR-032
 * degradation applied if unavailable).
 *
 * If deps.deliveryAdapter is provided (T-OBS.C.4), the assembled digest is
 * passed to the adapter after assembly. Delivery proof or fallback reason is
 * merged into the returned digest. Delivery failure never causes a throw.
 *
 * Does NOT contain outreach language, raw payloads, credentials, or private content.
 */
export declare function generateHeartbeatDigest(date: string, deps: HeartbeatDigestAssemblerDeps): Promise<HeartbeatDigest>;
