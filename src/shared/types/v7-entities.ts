/**
 * v7 全量共享实体类型 (v7 Shared Entity Types)
 *
 * Core logic: Centralizes all cross-system entity declarations introduced in
 * Second Nature v7, ensuring type consistency across state-memory,
 * control-plane, body-tool, dream-quiet, guidance-voice, connector, and
 * observability-health systems.
 *
 * Design authority:
 * - `02_ARCHITECTURE_OVERVIEW.md` §2 (System Inventory) — entity list
 * - `05A_TASKS.md` T-SMS.F.1 — contract requirements
 * - ADR-002/003/007/008 — entity semantics
 *
 * Dependencies:
 * - `SourceRef` from `./source-ref.js`
 * - `AgentGoal` from `./goal.js`
 *
 * Boundary:
 * - This file defines types only; no runtime logic or business rules.
 * - Sensitive fields (credential, raw private content, raw prompt,
 *   encryption key, session token) are explicitly excluded from
 *   RestoreSnapshot via type-level whitelist.
 * - RuntimeSecretAnchor never stores key plaintext (ADR-007).
 *
 * Test coverage: tests/unit/shared/v7-entities.test.ts
 */

import type { SourceRef } from "./source-ref.js";
import type { AgentGoal } from "./goal.js";

// ───────────────────────────────────────────────────────────────
// 1. Identity & Interaction (ADR-007)
// ───────────────────────────────────────────────────────────────

export interface PlatformHandle {
  platformId: string;
  handle: string;
  url?: string;
  verifiedAt?: string;
}

export interface IdentityProfile {
  profileId: string;
  canonicalName: string;
  canonicalAvatar?: string;
  canonicalBio?: string;
  platformHandles: PlatformHandle[];
  updatedAt: string;
}

export interface RecentInteractionSnapshot {
  interactionId: string;
  platformId: string;
  channelId?: string;
  summary: string;
  contentRef?: string;
  isReply: boolean;
  repliedAt?: string;
  createdAt: string;
}

// ───────────────────────────────────────────────────────────────
// 2. Tool Experience (ADR-003, DR-007, DR-010)
// ───────────────────────────────────────────────────────────────

export type ToolExperienceOutcome =
  | "success"
  | "failure"
  | "timeout"
  | "cancelled"
  | "probe_policy_denied";

export type ToolExperienceTriggerSource =
  | "heartbeat"
  | "manual_run"
  | "probe"
  | "idle_curiosity";

export interface ToolExperience {
  experienceId: string;
  connectorId: string;
  capabilityId: string;
  outcome: ToolExperienceOutcome;
  failureClass?: string;
  latencyMs: number;
  evidenceQuality: number;
  sourceRefs: SourceRef;
  triggerSource: ToolExperienceTriggerSource;
  createdAt: string;
}

// ───────────────────────────────────────────────────────────────
// 3. Connector Probe (ADR-008, DR-001, DR-006)
// ───────────────────────────────────────────────────────────────

export type ProbeActualStatus = "available" | "degraded" | "unavailable";

export interface CapabilityProbeResult {
  probeResultId: string;
  capabilityId: string;
  connectorId: string;
  actualStatus: ProbeActualStatus;
  httpStatus?: number;
  sampleResponseRef?: string;
  probeConfigRef: string;
  createdAt: string;
}

// ───────────────────────────────────────────────────────────────
// 4. Restore & Secret Recovery (ADR-007, DR-017, ADR-008)
// ───────────────────────────────────────────────────────────────

export type RestorableEntityKind =
  | "identity_profile"
  | "agent_goal"
  | "tool_experience"
  | "daily_diary"
  | "dream_output"
  | "narrative_timeline";

export type SensitiveExcludedKind =
  | "credential"
  | "raw_private_message"
  | "raw_prompt"
  | "encryption_key"
  | "session_token";

export interface RestoreSnapshot {
  snapshotId: string;
  entityWhitelist: RestorableEntityKind[];
  excludedSensitiveKinds: SensitiveExcludedKind[];
  capturedAt: string;
  payload: Record<string, unknown>;
}

export type SecretAnchorHealth = "ok" | "missing" | "wrong_key" | "rotation_needed";

export interface RuntimeSecretAnchor {
  anchorId: string;
  locationRef: string;
  health: SecretAnchorHealth;
  rotationPolicyRef?: string;
  updatedAt: string;
}

// ───────────────────────────────────────────────────────────────
// 5. Dream & Quiet (ADR-005, DR-023, DR-025)
// ───────────────────────────────────────────────────────────────

export type QuietClaimKind = "observation" | "fact" | "pattern";

export interface QuietClaim {
  claimId: string;
  kind: QuietClaimKind;
  text: string;
  sourceRefs: SourceRef;
  confidence: number;
  createdAt: string;
}

export interface DailyDiary {
  diaryId: string;
  day: string;
  observedToday: string[];
  notableSignals: string[];
  tomorrowDirection: string;
  sourceRefs: SourceRef;
  createdAt: string;
}

export type DreamOutputStatus = "candidate" | "accepted" | "archived" | "partial";

export interface DreamOutput {
  outputId: string;
  runId: string;
  status: DreamOutputStatus;
  canonicalEntries: unknown[];
  insights: unknown[];
  narrativeUpdate?: Record<string, unknown>;
  relationshipUpdate?: Record<string, unknown>;
  validation: {
    schemaValid: boolean;
    sourceGrounded: boolean;
    sensitivityClean: boolean;
    unsupportedClaims: string[];
    errors: string[];
    checkedAt: string;
  };
  createdAt?: string;
}

// ───────────────────────────────────────────────────────────────
// 6. Observability & Health (ADR-006, ADR-007)
// ───────────────────────────────────────────────────────────────

export type HealthDimensionStatus = "ok" | "degraded" | "blocked";

export interface SelfHealthSnapshot {
  snapshotId: string;
  dimensions: Record<
    string,
    { status: HealthDimensionStatus; reason?: string }
  >;
  checkedAt: string;
}

export interface HeartbeatDigest {
  digestId: string;
  day: string;
  connectorSummary: Array<{
    platformId: string;
    status: string;
    attemptCount: number;
  }>;
  goalSummary: Array<{ kind: string; activeCount: number }>;
  quietCount: number;
  dreamCount: number;
  breakerSummary: Array<{ connectorId: string; state: string }>;
  healthStatus: string;
  createdAt: string;
}

export interface NarrativeTimelineEntry {
  timelineId: string;
  entryType: string;
  subjectId: string;
  delta: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
  createdAt: string;
}

// ───────────────────────────────────────────────────────────────
// 7. Affordance (ADR-002, DR-003, DR-004)
// ───────────────────────────────────────────────────────────────

export type AffordanceStatus =
  | "safe"
  | "exploratory"
  | "needs_auth"
  | "painful"
  | "unavailable";

export interface AffordanceItem {
  platformId: string;
  capabilityId: string;
  intent: string;
  status: AffordanceStatus;
  reason?: string;
  lastProbedAt?: string;
}

export interface AffordanceMap {
  [platformId: string]: AffordanceItem[];
}

export interface AffordanceContextScope {
  platformIds?: string[];
  goalKind?: string;
  allowedStatuses?: AffordanceStatus[];
}

// ───────────────────────────────────────────────────────────────
// 8. Embodied Context (ADR-002, DR-013, DR-016, DR-020)
// ───────────────────────────────────────────────────────────────

export type EmbodiedContextSliceStatus = "loaded" | "degraded" | "blocked";

export interface EmbodiedContextSlice<T> {
  status: EmbodiedContextSliceStatus;
  data: T;
  reason?: string;
}

export interface EmbodiedContext {
  identity: EmbodiedContextSlice<IdentityProfile>;
  goals: EmbodiedContextSlice<AgentGoal[]>;
  recentInteractions: EmbodiedContextSlice<RecentInteractionSnapshot[]>;
  toolExperience: EmbodiedContextSlice<ToolExperience[]>;
  acceptedDream: EmbodiedContextSlice<DreamOutput[]>;
  affordanceMap?: EmbodiedContextSlice<AffordanceMap>;
  /**
   * selfHealth is populated by observability-health-system.
   */
  selfHealth?: EmbodiedContextSlice<SelfHealthSnapshot>;
  assembledAt: string;
}
