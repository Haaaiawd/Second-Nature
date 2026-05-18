/**
 * T2.4.1 — Platform-specific intent resolution.
 *
 * When accepted goals, narrative, or connector evidence point to a specific
 * platform, the planner emits a `CandidateIntent` with an explicit
 * `platformId`.  If the platform cannot be inferred, the caller falls
 * back to the generic connector_action path (platformId undefined).
 *
 * Boundaries:
 * - Does NOT execute connectors; only resolves platform + capability.
 * - Does NOT validate credentials; that is the guard layer's job.
 * - Optional registry: when absent, resolution is best-effort from goals/evidence.
 */
import type { IntentKind } from "../types.js";
import type { ControlPlaneSourceRef } from "../types.js";
import type { AgentGoal } from "../../../storage/goal/agent-goal-store.js";
import type { CapabilityContractRegistry } from "../../../connectors/base/manifest.js";
import type { CapabilityIntent } from "../../../connectors/base/contract.js";

const KNOWN_PLATFORM_IDS = ["moltbook", "instreet", "evomap"];

function kindToCapability(kind: IntentKind): CapabilityIntent | null {
  if (kind === "exploration") return "feed.read";
  if (kind === "social") return "comment.reply";
  if (kind === "work") return "work.discover";
  if (kind === "outreach") return "message.send";
  return null;
}

function extractPlatformIdsFromGoals(
  goals: AgentGoal[],
  kind: IntentKind,
): string[] {
  const capability = kindToCapability(kind);
  const results = new Set<string>();
  for (const goal of goals) {
    const text = `${goal.description} ${goal.completionCriteria ?? ""}`.toLowerCase();
    for (const pid of KNOWN_PLATFORM_IDS) {
      if (text.includes(pid)) {
        results.add(pid);
      }
    }
    // Also match if goal text contains the capability name (e.g. "feed.read")
    if (capability && text.includes(capability.toLowerCase())) {
      // capability alone doesn't tell us platform; keep for later
    }
  }
  return [...results];
}

function extractPlatformIdsFromEvidence(
  refs: ControlPlaneSourceRef[],
): string[] {
  const results = new Set<string>();
  for (const ref of refs) {
    if (ref.kind === "connector_result" && ref.id) {
      for (const pid of KNOWN_PLATFORM_IDS) {
        if (ref.id.includes(pid)) {
          results.add(pid);
        }
      }
    }
    // Parse platform:// URIs
    if (ref.uri && ref.uri.startsWith("platform://")) {
      const platformPart = ref.uri.slice("platform://".length).split("/")[0];
      if (platformPart && KNOWN_PLATFORM_IDS.includes(platformPart)) {
        results.add(platformPart);
      }
    }
  }
  return [...results];
}

function validatePlatformCapability(
  platformId: string,
  kind: IntentKind,
  registry: CapabilityContractRegistry,
): boolean {
  const capability = kindToCapability(kind);
  if (!capability) return false;
  try {
    return registry.hasCapability(platformId, capability);
  } catch {
    return false;
  }
}

export interface PlatformResolutionContext {
  /** Accepted goals that may name a platform or capability. */
  acceptedGoals?: AgentGoal[];
  /** Evidence refs that may embed platform identity. */
  evidenceRefs?: ControlPlaneSourceRef[];
}

/**
 * Resolve an explicit platformId for a candidate intent kind.
 * Returns `undefined` when no unambiguous platform can be inferred.
 */
export function resolvePlatformForIntent(
  kind: IntentKind,
  context: PlatformResolutionContext,
  registry?: CapabilityContractRegistry,
): string | undefined {
  const capability = kindToCapability(kind);
  if (!capability) {
    // Quiet, reflection, maintenance have no connector capability mapping.
    return undefined;
  }

  const candidates: string[] = [];

  if (context.acceptedGoals && context.acceptedGoals.length > 0) {
    candidates.push(...extractPlatformIdsFromGoals(context.acceptedGoals, kind));
  }

  if (context.evidenceRefs && context.evidenceRefs.length > 0) {
    candidates.push(...extractPlatformIdsFromEvidence(context.evidenceRefs));
  }

  // Deduplicate while preserving order
  const ordered = [...new Set(candidates)];

  if (registry) {
    for (const pid of ordered) {
      if (validatePlatformCapability(pid, kind, registry)) {
        return pid;
      }
    }
    // If none validated, return the first candidate anyway
    // (guard layer will deny with a specific reason)
    return ordered[0];
  }

  return ordered[0];
}
