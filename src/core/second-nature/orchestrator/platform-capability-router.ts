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

function kindToCapability(kind: IntentKind): CapabilityIntent | null {
  if (kind === "exploration") return "feed.read";
  if (kind === "social") return "comment.reply";
  if (kind === "work") return "work.discover";
  if (kind === "outreach") return "message.send";
  return null;
}

function getPlatformIds(registry?: CapabilityContractRegistry): string[] {
  if (registry) {
    return registry.listRegisteredPlatformIds();
  }
  // Fallback: built-in platforms when registry is absent (backward compat)
  return ["moltbook", "instreet", "evomap"];
}

function extractPlatformIdsFromGoals(
  goals: AgentGoal[],
  kind: IntentKind,
  platformIds: string[],
): string[] {
  const capability = kindToCapability(kind);
  const results = new Set<string>();
  for (const goal of goals) {
    const text = `${goal.description} ${goal.completionCriteria ?? ""}`.toLowerCase();
    for (const pid of platformIds) {
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
  platformIds: string[],
): string[] {
  const results = new Set<string>();
  for (const ref of refs) {
    if (ref.kind === "connector_result" && ref.id) {
      for (const pid of platformIds) {
        if (ref.id.includes(pid)) {
          results.add(pid);
        }
      }
    }
    // Parse platform:// URIs
    if (ref.uri && ref.uri.startsWith("platform://")) {
      const platformPart = ref.uri.slice("platform://".length).split("/")[0];
      if (platformPart && platformIds.includes(platformPart)) {
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

  const platformIds = getPlatformIds(registry);
  const candidates: string[] = [];

  if (context.acceptedGoals && context.acceptedGoals.length > 0) {
    candidates.push(...extractPlatformIdsFromGoals(context.acceptedGoals, kind, platformIds));
  }

  if (context.evidenceRefs && context.evidenceRefs.length > 0) {
    candidates.push(...extractPlatformIdsFromEvidence(context.evidenceRefs, platformIds));
  }

  // Deduplicate while preserving order
  const ordered = [...new Set(candidates)];

  if (ordered.length === 0) {
    return undefined;
  }

  if (ordered.length > 1) {
    // Ambiguous: multiple platforms inferred → do not guess, return undefined.
    // Guard layer will deny with "ambiguous_platform" reason.
    return undefined;
  }

  const single = ordered[0];

  if (registry) {
    if (validatePlatformCapability(single, kind, registry)) {
      return single;
    }
    // Registry says unsupported → undefined (guard layer will deny)
    return undefined;
  }

  // No registry: best-effort return the single candidate (backward compat)
  return single;
}
