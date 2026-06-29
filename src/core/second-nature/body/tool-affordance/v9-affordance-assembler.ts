/**
 * v9 AffordanceAssembler — T6.2.1 real-hand affordance baseline.
 *
 * Core logic: Assemble `AffordancePosture` per platform+capability from three
 * independent axes:
 *   - access:      has the capability been registered and credentialed?
 *   - reliability: does recent probe/execution evidence prove it works now?
 *   - familiarity: how much verified history / routine practice exists?
 *
 * Rules:
 *   - Unregistered capability → access=none, reliability=unproven, familiarity=scaffold.
 *   - Registered but no credential → access=needs_auth.
 *   - Registered with credential → access=credentialed.
 *   - Successful probe/execution within 7 days → reliability=proven.
 *   - Failed execution within 7 days → reliability=degraded.
 *   - Only evidence older than 7 days → reliability=stale.
 *   - Active routine for capability → familiarity=routine.
 *   - No routine but >=3 successes → familiarity=practiced.
 *   - Otherwise → familiarity=scaffold.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/body-connector-system.detail.md §3.1 §4.1 §5`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (AffordancePosture, SourceRef)
 * - `src/storage/services/tool-experience-store.js` (v7/v8 ToolExperience, CapabilityProbeResult)
 * - `src/storage/v9-state-stores.js` (active ToolRoutine read)
 *
 * Boundary:
 * - Does NOT perform live HTTP probes — reads persisted evidence only.
 * - Does NOT derive write availability from read success.
 * - Scaffold / stale probe cannot masquerade as real-hand available.
 *
 * Test coverage:
 * - tests/unit/body/v9-affordance-posture.test.ts
 * - tests/integration/v9/real-hand-affordance.test.ts
 */

import type {
  AffordancePosture,
  AffordanceQuery,
  SourceRef,
  AffordanceAccessLevel,
  AffordanceReliabilityLevel,
  AffordanceFamiliarityLevel,
} from "../../../../shared/types/v9-contracts.js";
import type { ToolExperience, CapabilityProbeResult } from "../../../../shared/types/v7-entities.js";
import type { StateDatabase } from "../../../../storage/db/index.js";
import {
  createCapabilityProbeResultStore,
  createToolExperienceStore,
} from "../../../../storage/services/tool-experience-store.js";
import { readActiveToolRoutinesByCapabilityPattern } from "../../../../storage/v9-state-stores.js";

const AFFORDANCE_STALE_PROBE_MS = 7 * 24 * 60 * 60 * 1000;
const FAMILIARITY_SUCCESS_THRESHOLD = 3;

export interface CapabilityRef {
  platformId: string;
  capabilityId: string;
  intent?: string;
}

export interface AffordanceRegistryPort {
  listCapabilities(platformId?: string): CapabilityRef[];
}

export interface CredentialPresencePort {
  hasCredential(platformId: string): boolean | Promise<boolean>;
}

export interface AffordanceAssemblerDeps {
  db: StateDatabase;
  registry: AffordanceRegistryPort;
  credentialPresence: CredentialPresencePort;
  now?: string;
}

function toSourceRef(
  family: SourceRef["family"],
  id: string | undefined,
  label?: string,
): SourceRef | undefined {
  if (!id) return undefined;
  return { family, id, label };
}

function sourceRefOrEmpty(
  family: SourceRef["family"],
  id: string | undefined,
): SourceRef[] {
  const ref = toSourceRef(family, id);
  return ref ? [ref] : [];
}

function collectSourceRefs(
  probe: CapabilityProbeResult | undefined,
  experiences: ToolExperience[],
  routineId: string | undefined,
): SourceRef[] {
  const refs: SourceRef[] = [];
  if (probe) {
    refs.push({ family: "capability_probe_result", id: probe.probeResultId });
  }
  for (const exp of experiences.slice(0, 3)) {
    refs.push({ family: "connector", id: exp.experienceId, label: exp.outcome });
  }
  if (routineId) {
    refs.push({ family: "routine", id: routineId });
  }
  return refs;
}

function deriveAccessLevel(
  registered: boolean,
  hasCredential: boolean,
): AffordanceAccessLevel {
  if (!registered) return "none";
  if (!hasCredential) return "needs_auth";
  return "credentialed";
}

function deriveReliabilityLevel(
  probe: CapabilityProbeResult | undefined,
  experiences: ToolExperience[],
  nowMs: number,
): AffordanceReliabilityLevel {
  const withinWindow = (iso: string | undefined): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && nowMs - t <= AFFORDANCE_STALE_PROBE_MS;
  };

  // Execution evidence is stronger than probe evidence.
  const recentExec = experiences.find((e) => withinWindow(e.createdAt));
  if (recentExec) {
    return recentExec.outcome === "success" ? "proven" : "degraded";
  }

  // NOTE: v7 CapabilityProbeResult.actualStatus is {available, degraded, unavailable}.
  // The v9 design doc also defines ProbeStatus.not_implemented, which should map to
  // reliability=unproven + familiarity=scaffold. That state cannot be represented in
  // the current v7 probe table and will be introduced when the v9 probe runner is
  // implemented (T6.3.x). Until then, unavailable/degraded probe results degrade.
  if (probe && withinWindow(probe.createdAt)) {
    return probe.actualStatus === "available" ? "proven" : "degraded";
  }

  // No recent evidence, but there is older evidence → stale.
  if (probe || experiences.length > 0) {
    return "stale";
  }

  return "unproven";
}

function deriveFamiliarityLevel(
  experiences: ToolExperience[],
  routineId: string | undefined,
  registered: boolean,
): AffordanceFamiliarityLevel {
  if (!registered) return "scaffold";
  if (routineId) return "routine";
  const successCount = experiences.filter((e) => e.outcome === "success").length;
  if (successCount >= FAMILIARITY_SUCCESS_THRESHOLD) return "practiced";
  return "scaffold";
}

function lastExecutedAt(experiences: ToolExperience[]): string | undefined {
  return experiences[0]?.createdAt;
}

export async function assembleToolAffordance(
  deps: AffordanceAssemblerDeps,
  query: AffordanceQuery = {},
): Promise<AffordancePosture[]> {
  const { db, registry, credentialPresence } = deps;
  const nowIso = deps.now ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  const probeStore = createCapabilityProbeResultStore(db);
  const experienceStore = createToolExperienceStore(db);

  const allCapabilities = registry.listCapabilities(query.platformId);
  const filtered = allCapabilities.filter((cap) => {
    if (query.platformId && cap.platformId !== query.platformId) return false;
    if (query.capabilityId && cap.capabilityId !== query.capabilityId) return false;
    return true;
  });

  const postures: AffordancePosture[] = [];

  for (const cap of filtered) {
    const platformId = cap.platformId;
    const capabilityId = cap.capabilityId;
    const registered = true;

    const probeResults = await probeStore.listProbeResults(platformId, 100);
    const probe = probeResults.find((p) => p.capabilityId === capabilityId);

    const experiences = await experienceStore.listToolExperience({
      connectorId: platformId,
      capabilityId,
      limit: 20,
    });

    const routines = await readActiveToolRoutinesByCapabilityPattern(db, capabilityId);
    const routine = routines[0];

    const hasCredential = await credentialPresence.hasCredential(platformId);

    const accessLevel = deriveAccessLevel(registered, hasCredential);
    const reliabilityLevel = deriveReliabilityLevel(probe, experiences, nowMs);
    const familiarityLevel = deriveFamiliarityLevel(
      experiences,
      routine?.id ?? undefined,
      registered,
    );

    const sourceRefs = collectSourceRefs(probe, experiences, routine?.id ?? undefined);

    postures.push({
      platformId,
      capabilityId,
      accessLevel,
      reliabilityLevel,
      familiarityLevel,
      lastProbedAt: probe?.createdAt,
      lastExecutedAt: lastExecutedAt(experiences),
      routineId: routine?.id ?? undefined,
      sourceRefs,
    });
  }

  return postures;
}

export function createStaticRegistry(
  capabilities: CapabilityRef[],
): AffordanceRegistryPort {
  return {
    listCapabilities(platformId?: string) {
      if (!platformId) return capabilities;
      return capabilities.filter((c) => c.platformId === platformId);
    },
  };
}

export function createCredentialPresenceFromVault(
  vault: { loadCredentialContext(platformId: string): Promise<{ status?: string } | null> },
): CredentialPresencePort {
  return {
    async hasCredential(platformId: string) {
      const ctx = await vault.loadCredentialContext(platformId);
      // Only "active" credentials grant real-hand access. Other states
      // (pending_verification, expired, revoked, failed, decrypt_failed)
      // surface as needs_auth so planning does not treat them as available.
      return Boolean(ctx && ctx.status === "active");
    },
  };
}

export { AFFORDANCE_STALE_PROBE_MS, FAMILIARITY_SUCCESS_THRESHOLD };
