/**
 * IdleCuriosityPolicy — T-CP.C.3
 *
 * Core logic: When no active goal exists, selects at most one healthy,
 * allowlisted, read-only sensing intent from the affordance map.
 *
 * Rules:
 * - Only read-only capabilities (heuristic: intent ends with .read / .discover / .inspect / .search).
 * - Only safe or exploratory affordance status.
 * - Max one candidate per heartbeat.
 * - 1-hour cooldown per platform.
 * - No eligible connector → reason idle_policy_no_eligible_connector.
 *
 * Boundary:
 * - Does NOT execute connector.
 * - Returns a candidate descriptor, not an execution authorization.
 *
 * Test coverage: tests/unit/control-plane/idle-curiosity-policy.test.ts
 */
import type {
  AffordanceMap,
  AffordanceItem,
} from "../../../shared/types/v7-entities.js";

export interface IdleCuriosityCandidate {
  platformId: string;
  capabilityId: string;
  intent: string;
  reason: string;
}

export interface IdleCuriosityPolicyResult {
  candidate?: IdleCuriosityCandidate;
  reason: string;
}

export interface IdleCuriosityPolicy {
  select(
    affordanceMap: AffordanceMap,
    recentIdleHistory: { platformId: string; at: string }[],
  ): IdleCuriosityPolicyResult;
}

const IDLE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function isReadOnlyIntent(intent: string): boolean {
  return (
    intent.endsWith(".read") ||
    intent.endsWith(".discover") ||
    intent.endsWith(".inspect") ||
    intent.endsWith(".search")
  );
}

export function createIdleCuriosityPolicy(): IdleCuriosityPolicy {
  return {
    select(affordanceMap, recentIdleHistory) {
      const now = Date.now();

      // Build eligible list
      const eligible: AffordanceItem[] = [];
      for (const [platformId, items] of Object.entries(affordanceMap) as [string, AffordanceItem[]][]) {
        for (const item of items) {
          // Read-only only
          if (!isReadOnlyIntent(item.intent)) continue;

          // Healthy status only
          if (item.status !== "safe" && item.status !== "exploratory")
            continue;

          // Check cooldown
          const lastIdle = recentIdleHistory
            .filter((h) => h.platformId === platformId)
            .sort(
              (a, b) =>
                new Date(b.at).getTime() - new Date(a.at).getTime(),
            )[0];
          if (lastIdle) {
            const elapsed =
              now - new Date(lastIdle.at).getTime();
            if (elapsed < IDLE_COOLDOWN_MS) continue;
          }

          eligible.push(item);
        }
      }

      if (eligible.length === 0) {
        return { reason: "idle_policy_no_eligible_connector" };
      }

      // Deterministic selection: first eligible by stable sort
      const chosen = eligible.sort((a, b) =>
        a.platformId.localeCompare(b.platformId) ||
        a.capabilityId.localeCompare(b.capabilityId),
      )[0];

      return {
        candidate: {
          platformId: chosen.platformId,
          capabilityId: chosen.capabilityId,
          intent: chosen.intent,
          reason: "idle_sensing_selected",
        },
        reason: "idle_sensing_selected",
      };
    },
  };
}
