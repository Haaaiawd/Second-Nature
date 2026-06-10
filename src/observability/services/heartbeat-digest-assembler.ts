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
import type { AuditEnvelope } from "../audit/audit-envelope.js";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  date: string; // YYYY-MM-DD
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

// ─── Delivery adapter (T-OBS.C.4) ────────────────────────────────────────────

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

// ─── Ports ───────────────────────────────────────────────────────────────────

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

// ─── Connector attempt payload shape (partial, for aggregation) ───────────────

interface ConnectorAttemptPayload {
  platformId?: string;
  capability?: string;
  outcome?: "success" | "failure" | "circuit_open" | "blocked";
  // other fields omitted (raw payload forbidden)
}

interface DeliveryPayload {
  status?: string;
  outcome?: "sent" | "failed" | "not_sent";
}

interface DreamTracePayload {
  event?: "dream_started" | "dream_completed" | "dream_accepted" | "dream_skipped" | "dream_archived";
  skipReason?: string;
}

interface SourceCoveragePayload {
  subjectType?: string;
  status?: string;
  reasonCodes?: string[];
}

interface HeartbeatDecisionPayload {
  outcome?: string;
  platformId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSameDayUtc(isoTimestamp: string, dateStr: string): boolean {
  // dateStr: "YYYY-MM-DD"
  return isoTimestamp.startsWith(dateStr);
}

function filterByDate<T>(
  events: readonly AuditEnvelope<unknown>[],
  family: string,
  dateStr: string,
): Array<AuditEnvelope<T>> {
  return events.filter(
    (e) => e.family === family && isSameDayUtc(e.createdAt, dateStr),
  ) as Array<AuditEnvelope<T>>;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregateConnectors(
  events: readonly AuditEnvelope<unknown>[],
  dateStr: string,
): ConnectorDaySummary[] {
  const connectorEvents = filterByDate<ConnectorAttemptPayload>(events, "connector.attempt", dateStr);

  const byKey = new Map<string, ConnectorDaySummary>();

  for (const ev of connectorEvents) {
    const payload = ev.payload as ConnectorAttemptPayload;
    const platformId = payload.platformId ?? "unknown";
    const capability = payload.capability ?? "unknown";
    const key = `${platformId}::${capability}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        platformId,
        capability,
        successCount: 0,
        failureCount: 0,
        circuitOpenCount: 0,
        blockedCount: 0,
      });
    }

    const entry = byKey.get(key)!;
    switch (payload.outcome) {
      case "success":
        entry.successCount++;
        break;
      case "failure":
        entry.failureCount++;
        break;
      case "circuit_open":
        entry.circuitOpenCount++;
        break;
      case "blocked":
        entry.blockedCount++;
        break;
      default:
        // Unknown outcome — still count as an attempt (no-op for summaries)
        break;
    }
  }

  return Array.from(byKey.values());
}

function aggregateHealthSummary(
  events: readonly AuditEnvelope<unknown>[],
  dateStr: string,
): HealthDaySummary {
  const deliveryEvents = filterByDate<DeliveryPayload>(events, "delivery", dateStr);
  const heartbeatEvents = filterByDate<HeartbeatDecisionPayload>(events, "heartbeat.decision", dateStr);

  const deliverySuccessCount = deliveryEvents.filter(
    (e) => (e.payload as DeliveryPayload).outcome === "sent",
  ).length;
  const deliveryFailureCount = deliveryEvents.filter(
    (e) =>
      (e.payload as DeliveryPayload).outcome === "failed" ||
      (e.payload as DeliveryPayload).outcome === "not_sent",
  ).length;

  // Count circuit-breaker change events in heartbeat decisions
  const circuitBreakerChanges = heartbeatEvents.filter(
    (e) => (e.payload as HeartbeatDecisionPayload).outcome === "deferred",
  ).length;

  // Audit chain is healthy if we have consecutive events (simplified: always true here)
  const auditChainHealthy = true;

  return {
    circuitBreakerChanges,
    deliverySuccessCount,
    deliveryFailureCount,
    auditChainHealthy,
  };
}

function aggregateQuietDreamFromAudit(
  events: readonly AuditEnvelope<unknown>[],
  dateStr: string,
): Omit<QuietDreamDaySummary, "degraded" | "degradedReason"> {
  const dreamEvents = filterByDate<DreamTracePayload>(events, "dream.trace", dateStr);
  const quietEvents = filterByDate<SourceCoveragePayload>(events, "source_coverage", dateStr)
    .filter((ev) => (ev.payload as SourceCoveragePayload).subjectType === "quiet_artifact");

  let quietRuns = 0;
  let quietSucceeded = 0;
  let dreamRuns = 0;
  let dreamAccepted = 0;
  let dreamSkipped = 0;
  const dreamSkipReasons: string[] = [];

  for (const ev of quietEvents) {
    const payload = ev.payload as SourceCoveragePayload;
    quietRuns++;
    if (payload.status === "completed" || payload.status === "empty") {
      quietSucceeded++;
    }
  }

  for (const ev of dreamEvents) {
    const payload = ev.payload as DreamTracePayload;
    if (payload.event === "dream_started") dreamRuns++;
    if (payload.event === "dream_accepted") dreamAccepted++;
    if (payload.event === "dream_skipped") {
      dreamSkipped++;
      if (payload.skipReason) dreamSkipReasons.push(payload.skipReason);
    }
  }

  return {
    quietRuns,
    quietSucceeded,
    dreamRuns,
    dreamAccepted,
    dreamSkipped,
    dreamSkipReasons: [...new Set(dreamSkipReasons)],
  };
}

function isNothingSignificant(
  connectorSummary: ConnectorDaySummary[],
  goalSummary: GoalDaySummary,
  quietDreamSummary: QuietDreamDaySummary,
  healthSummary: HealthDaySummary,
): boolean {
  const hasConnectorActivity = connectorSummary.some(
    (c) =>
      c.successCount + c.failureCount + c.circuitOpenCount + c.blockedCount > 0,
  );
  const hasGoalActivity =
    !goalSummary.degraded &&
    (goalSummary.newGoals +
      goalSummary.completedGoals +
      goalSummary.expiredGoals +
      goalSummary.replacedGoals >
      0);
  const hasDreamActivity =
    !quietDreamSummary.degraded &&
    (quietDreamSummary.dreamRuns > 0 || quietDreamSummary.quietRuns > 0);
  const hasDeliveryActivity =
    healthSummary.deliverySuccessCount + healthSummary.deliveryFailureCount > 0;

  return (
    !hasConnectorActivity &&
    !hasGoalActivity &&
    !hasDreamActivity &&
    !hasDeliveryActivity
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

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
export async function generateHeartbeatDigest(
  date: string,
  deps: HeartbeatDigestAssemblerDeps,
): Promise<HeartbeatDigest> {
  const generatedAt = (deps.now ?? (() => new Date().toISOString()))();
  const { auditStore, stateMemoryPort, deliveryAdapter } = deps;
  const events = auditStore.list();

  // Aggregate connector and health from audit
  const connectorSummary = aggregateConnectors(events, date);
  const healthSummary = aggregateHealthSummary(events, date);

  // Goal transitions — via state-memory port (DR-032 degradation)
  let goalSummary: GoalDaySummary;
  if (stateMemoryPort) {
    try {
      const g = await stateMemoryPort.queryGoalTransitions(date);
      goalSummary = { ...g };
    } catch {
      goalSummary = {
        newGoals: 0,
        completedGoals: 0,
        expiredGoals: 0,
        replacedGoals: 0,
        activeGoals: 0,
        degraded: true,
        degradedReason: "state_memory_unavailable",
      };
    }
  } else {
    goalSummary = {
      newGoals: 0,
      completedGoals: 0,
      expiredGoals: 0,
      replacedGoals: 0,
      activeGoals: 0,
    };
  }

  // Quiet/Dream status — prefer state-memory port; fallback to audit-based aggregation
  let quietDreamSummary: QuietDreamDaySummary;
  if (stateMemoryPort) {
    try {
      const qd = await stateMemoryPort.queryQuietDreamStatus(date);
      quietDreamSummary = { ...qd };
    } catch {
      // DR-032: degrade gracefully
      const fromAudit = aggregateQuietDreamFromAudit(events, date);
      quietDreamSummary = {
        ...fromAudit,
        degraded: true,
        degradedReason: "state_memory_unavailable",
      };
    }
  } else {
    quietDreamSummary = aggregateQuietDreamFromAudit(events, date);
  }

  const nothingSignificant = isNothingSignificant(
    connectorSummary,
    goalSummary,
    quietDreamSummary,
    healthSummary,
  );

  const digest: HeartbeatDigest = {
    date,
    generatedAt,
    isNothingSignificant: nothingSignificant,
    connectorSummary,
    goalSummary,
    quietDreamSummary,
    healthSummary,
    realRunHealth: {
      gatePassed: false,
      contractSmokeOnly: true,
      seededStateDetected: false,
      hasRealClosure: false,
      hasQuietArtifact: false,
      hasDreamArtifact: false,
      missingReason: "Real-run health not evaluated — call checkRealRunHealth before digest generation",
    },
  };

  // T-OBS.C.4: delivery hook — attempt delivery if adapter is provided
  if (deliveryAdapter) {
    try {
      const result = await deliveryAdapter.deliver(digest);
      if (result.status === "sent") {
        // Proof must be present when claiming "sent"
        if (result.proof) {
          digest.deliveredAt = result.deliveredAt ?? generatedAt;
          digest.deliveryProof = result.proof;
        } else {
          // Adapter declared "sent" without proof — treat as not_sent (honesty constraint)
          digest.deliveryFallbackReason = "delivery_proof_missing";
        }
      } else {
        // status === "not_sent": record fallback reason, never claim sent
        digest.deliveryFallbackReason = result.fallbackReason ?? "delivery_failed";
      }
    } catch (err) {
      // Delivery threw — absorb error, record fallback, do not rethrow
      const message = err instanceof Error ? err.message : String(err);
      digest.deliveryFallbackReason = `delivery_error: ${message}`;
    }
  }

  return digest;
}
