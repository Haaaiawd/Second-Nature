/**
 * AffordanceAssembler — T-BTS.C.1
 *
 * Core logic: Assemble a platform→capability affordance map from the v7
 * capability registry and recent probe results.
 *
 * Mapping rules (probe actualStatus → affordance status):
 * - available  → safe
 * - degraded   → exploratory
 * - unavailable → unavailable
 * - no probe + credential required → needs_auth
 * - no probe + no credential required → unavailable
 *
 * Caching:
 * - TTL cache (default 30s) keyed by serialized scope.
 * - Invalidate on explicit call or when underlying data changes.
 *
 * Performance target: P95 < 1s for 50 manifests.
 *
 * Dependencies:
 * - `CapabilityContractRegistryV7` from `../../../../connectors/base/manifest-v7.js`
 * - `AffordanceItem`, `AffordanceMap`, `AffordanceContextScope`
 *   from `../../../../shared/types/v7-entities.js`
 * - `applyAffordanceContextScope` from `./affordance-context-scope.js`
 *
 * Boundary:
 * - Does NOT perform HTTP probes — reads cached probe results only.
 * - Credential-bearing entries are excluded (ADR-003).
 * - Returns a plain object; caller decides persistence.
 *
 * Test coverage: tests/unit/body/affordance-assembler.test.ts
 */

import type { CapabilityContractRegistryV7 } from "../../../../connectors/base/manifest-v7.js";
import type {
  AffordanceItem,
  AffordanceMap,
  AffordanceContextScope,
  ProbeActualStatus,
} from "../../../../shared/types/v7-entities.js";
import { applyAffordanceContextScope } from "./affordance-context-scope.js";

export interface ProbeResultReader {
  getLatestProbeResult(
    platformId: string,
    capabilityId: string,
  ): { actualStatus: ProbeActualStatus; createdAt: string } | undefined;
}

export interface AffordanceAssembler {
  assembleAffordanceMap(
    scope?: AffordanceContextScope,
  ): Promise<AffordanceMap>;
  invalidateCache(): void;
}

export interface AffordanceAssemblerOptions {
  registry: CapabilityContractRegistryV7;
  probeReader: ProbeResultReader;
  credentialRequired?: (platformId: string, capabilityId: string) => boolean;
  ttlMs?: number;
}

function statusFromProbe(
  probeStatus: ProbeActualStatus,
): AffordanceItem["status"] {
  switch (probeStatus) {
    case "available":
      return "safe";
    case "degraded":
      return "exploratory";
    case "unavailable":
      return "unavailable";
    default:
      return "unavailable";
  }
}

function scopeKey(scope: AffordanceContextScope): string {
  return JSON.stringify([
    scope.platformIds?.sort() ?? [],
    scope.goalKind ?? "",
    scope.allowedStatuses?.sort() ?? [],
  ]);
}

export function createAffordanceAssembler(
  options: AffordanceAssemblerOptions,
): AffordanceAssembler {
  const {
    registry,
    probeReader,
    credentialRequired,
    ttlMs = 30_000,
  } = options;

  let cache: {
    key: string;
    map: AffordanceMap;
    cachedAt: number;
  } | undefined;

  function buildRawMap(): AffordanceMap {
    const map: AffordanceMap = {};

    for (const platformId of registry.listRegisteredPlatformIds()) {
      const caps = registry.listCapabilities(platformId);
      const items: AffordanceItem[] = [];

      for (const cap of caps) {
        const probe = probeReader.getLatestProbeResult(
          platformId,
          cap.capabilityId,
        );

        let status: AffordanceItem["status"];
        let reason: string | undefined;
        let lastProbedAt: string | undefined;

        if (probe) {
          status = statusFromProbe(probe.actualStatus);
          lastProbedAt = probe.createdAt;
          if (status === "unavailable") {
            reason = `probe_unavailable:${cap.capabilityId}`;
          }
        } else {
          const needsCred = credentialRequired?.(platformId, cap.capabilityId) ?? true;
          if (needsCred) {
            status = "needs_auth";
            reason = "credential_not_probed";
          } else {
            status = "unavailable";
            reason = "no_probe_result";
          }
        }

        items.push({
          platformId,
          capabilityId: cap.capabilityId,
          intent: cap.intent,
          status,
          reason,
          lastProbedAt,
        });
      }

      if (items.length > 0) {
        map[platformId] = items;
      }
    }

    return map;
  }

  return {
    async assembleAffordanceMap(scope = {}) {
      const key = scopeKey(scope);
      const now = Date.now();

      if (cache && cache.key === key && now - cache.cachedAt < ttlMs) {
        // Re-apply scope filter on cached raw map (scope may change)
        const filtered: AffordanceMap = {};
        for (const [pid, items] of Object.entries(cache.map)) {
          const scoped = applyAffordanceContextScope(items, scope);
          if (scoped.length > 0) {
            filtered[pid] = scoped;
          }
        }
        return filtered;
      }

      const raw = buildRawMap();
      cache = { key, map: raw, cachedAt: now };

      const filtered: AffordanceMap = {};
      for (const [pid, items] of Object.entries(raw)) {
        const scoped = applyAffordanceContextScope(items, scope);
        if (scoped.length > 0) {
          filtered[pid] = scoped;
        }
      }
      return filtered;
    },

    invalidateCache() {
      cache = undefined;
    },
  };
}
