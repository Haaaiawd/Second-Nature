/**
 * PainSignal query — T-BTS.C.4
 *
 * Core logic: Computes a bounded pain signal from recent ToolExperience rows.
 * Does NOT expose raw payload. Returns aggregated metrics for affordance map
 * and heartbeat guard consumption.
 *
 * Dependencies:
 * - `ToolExperienceStore` from `../../../../storage/services/tool-experience-store.js`
 * - `ToolExperience` from `../../../../shared/types/v7-entities.js`
 *
 * Boundary:
 * - Read-only; no side effects.
 * - Bounded to last N rows (default 10) to keep computation constant-time.
 *
 * Test coverage: tests/unit/body/pain-signal-query.test.ts
 */

import type { ToolExperienceStore } from "../../../../storage/services/tool-experience-store.js";
import type { ToolExperience } from "../../../../shared/types/v7-entities.js";

export interface PainSignal {
  connectorId: string;
  capabilityId: string;
  painLevel: number; // 0.0 .. 1.0
  recentFailureRate: number; // 0.0 .. 1.0
  consecutiveFailures: number;
  cooldownRecommended: boolean;
  lastOutcomes: Array<{ outcome: string; createdAt: string }>;
}

export interface PainSignalQuery {
  getPainSignal(
    connectorId: string,
    capabilityId?: string,
  ): Promise<PainSignal | undefined>;
}

export function createPainSignalQuery(
  store: ToolExperienceStore,
  options: { lookbackLimit?: number; cooldownThreshold?: number } = {},
): PainSignalQuery {
  const lookbackLimit = options.lookbackLimit ?? 10;
  const cooldownThreshold = options.cooldownThreshold ?? 3;

  return {
    async getPainSignal(connectorId, capabilityId) {
      const rows = await store.listToolExperience({
        connectorId,
        capabilityId,
        limit: lookbackLimit,
      });

      if (rows.length === 0) {
        return undefined;
      }

      // Sort by createdAt ASC to compute consecutive failures correctly
      const sorted = [...rows].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime(),
      );

      const failures = sorted.filter(
        (r) => r.outcome === "failure" || r.outcome === "timeout",
      );
      const recentFailureRate = failures.length / sorted.length;

      // Count trailing consecutive failures
      let consecutiveFailures = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (
          sorted[i]!.outcome === "failure" ||
          sorted[i]!.outcome === "timeout"
        ) {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      const painLevel = Math.min(
        1.0,
        recentFailureRate * 0.5 + consecutiveFailures * 0.15,
      );

      return {
        connectorId,
        capabilityId: capabilityId ?? "*",
        painLevel,
        recentFailureRate,
        consecutiveFailures,
        cooldownRecommended: consecutiveFailures >= cooldownThreshold,
        lastOutcomes: sorted.slice(-5).map((r) => ({
          outcome: r.outcome,
          createdAt: r.createdAt,
        })),
      };
    },
  };
}
