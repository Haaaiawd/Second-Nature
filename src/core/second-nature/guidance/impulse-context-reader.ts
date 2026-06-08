/**
 * ImpulseContextReader — Read agent-facing impulse context artifact from state.
 *
 * Core logic: Retrieve the latest persisted artifact for a given scene/capability
 * combo, with freshness diagnostics and explicit missing-artifact reasons.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/guidance-voice-system.md §1`
 * - `docs/validation/openclaw-plugin-classification.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (readImpulseContextArtifact)
 *
 * Boundary:
 * - Does NOT fall back to real-time assembly; returns missing reason when absent.
 * - Does NOT register a fake OpenClaw context-engine.
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import { readImpulseContextArtifact } from "../../../storage/v8-state-stores.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface ImpulseContextArtifactView {
  id: string;
  sceneType: string;
  capabilityIntent: string | null;
  platformId: string | null;
  capabilityClass: string | null;
  impulseSource: string;
  impulseText: string | null;
  atmosphereText: string | null;
  expressionBoundaryConstraints: string[];
  expressionBoundaryStyle: string | null;
  freshnessVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface MissingArtifactReason {
  available: false;
  reason:
    | "artifact_not_persisted"
    | "artifact_expired"
    | "state_unreadable"
    | "scene_capability_mismatch";
  operatorNextAction: string;
}

export type ReadImpulseContextResult =
  | { available: true; artifact: ImpulseContextArtifactView; freshnessMs: number }
  | MissingArtifactReason;

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function parseConstraints(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function readImpulseContext(
  db: StateDatabase,
  sceneType: string,
  capabilityIntent?: string,
  platformId?: string,
): Promise<ReadImpulseContextResult> {
  const result = await readImpulseContextArtifact(db, sceneType, capabilityIntent, platformId);

  if (result.degraded) {
    return {
      available: false,
      reason: "state_unreadable",
      operatorNextAction: "Check state database connectivity",
    };
  }

  const row = result.row;
  if (!row) {
    return {
      available: false,
      reason: "artifact_not_persisted",
      operatorNextAction: `Run guidance_payload for scene=${sceneType} cap=${capabilityIntent ?? "any"} to generate artifact`,
    };
  }

  const now = Date.now();
  const updatedAt = new Date(row.updatedAt).getTime();
  const freshnessMs = now - updatedAt;

  // Expire artifacts older than 24 hours
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (freshnessMs > ONE_DAY_MS) {
    return {
      available: false,
      reason: "artifact_expired",
      operatorNextAction: `Re-run guidance_payload for scene=${sceneType} — artifact is stale (${Math.round(freshnessMs / 3600000)}h old)`,
    };
  }

  return {
    available: true,
    artifact: {
      id: row.id,
      sceneType: row.sceneType,
      capabilityIntent: row.capabilityIntent,
      platformId: row.platformId,
      capabilityClass: row.capabilityClass,
      impulseSource: row.impulseSource,
      impulseText: row.impulseText,
      atmosphereText: row.atmosphereText,
      expressionBoundaryConstraints: parseConstraints(row.expressionBoundaryConstraintsJson),
      expressionBoundaryStyle: row.expressionBoundaryStyle,
      freshnessVersion: row.freshnessVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    freshnessMs,
  };
}
