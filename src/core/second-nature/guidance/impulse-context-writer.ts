/**
 * ImpulseContextWriter — Persist assembled impulse + atmosphere as agent-facing artifact.
 *
 * Core logic: Convert impulse assembly result into a durable artifact that can be
 * read during setup, heartbeat, and platform-scene entry without re-assembly.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/guidance-voice-system.md §1`
 * - `docs/validation/openclaw-plugin-classification.md §5`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (writeImpulseContextArtifact)
 * - `src/guidance/impulse-assembler.js` (ImpulseAssemblerResult)
 *
 * Boundary:
 * - Does NOT register a fake OpenClaw context-engine.
 * - Does NOT claim delivery or decision capability.
 * - Overwrites existing artifact for same scene/capability combo (upsert behavior).
 */

import type { StateDatabase } from "../../../storage/db/index.js";
import { writeImpulseContextArtifact } from "../../../storage/v8-state-stores.js";
import type { ImpulseAssemblerResult } from "../../../guidance/impulse-assembler.js";
import type { SourceRef, DegradedOperationResult } from "../../../shared/types/v8-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface ImpulseContextArtifactInput {
  sceneType: string;
  capabilityIntent?: string;
  platformId?: string;
  impulseResult: ImpulseAssemblerResult;
  atmosphereText?: string;
  expressionBoundaryConstraints: string[];
  expressionBoundaryStyle?: string;
}

export interface WriteArtifactResult {
  id: string;
  freshnessVersion: number;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function buildArtifactId(
  sceneType: string,
  capabilityIntent: string | undefined,
  platformId: string | undefined,
): string {
  const cap = capabilityIntent ?? "none";
  const plat = platformId ?? "generic";
  return `ica_${sceneType}_${cap}_${plat}`;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export async function writeImpulseContext(
  db: StateDatabase,
  input: ImpulseContextArtifactInput,
  options?: { now?: string; sourceRefs?: SourceRef[] },
): Promise<WriteArtifactResult | DegradedOperationResult> {
  const now = options?.now ?? new Date().toISOString();
  const id = buildArtifactId(input.sceneType, input.capabilityIntent, input.platformId);

  const sourceRefs: SourceRef[] = options?.sourceRefs ?? [
    {
      uri: `sn://impulse-context/${id}`,
      family: "projection",
      id,
      redactionClass: "none",
      resolveStatus: "resolvable",
    },
  ];

  const result = await writeImpulseContextArtifact(db, {
    id,
    createdAt: now,
    updatedAt: now,
    sceneType: input.sceneType,
    capabilityIntent: input.capabilityIntent ?? null,
    platformId: input.platformId ?? null,
    capabilityClass: input.impulseResult.capabilityClass ?? null,
    impulseSource: input.impulseResult.source,
    impulseText: input.impulseResult.impulse?.text ?? null,
    atmosphereText: input.atmosphereText ?? null,
    expressionBoundaryConstraintsJson: JSON.stringify(input.expressionBoundaryConstraints),
    expressionBoundaryStyle: input.expressionBoundaryStyle ?? null,
    freshnessVersion: 1,
    sourceRefs,
    redactionClass: "none",
    payloadJson: JSON.stringify({
      impulseKind: input.impulseResult.impulse?.kind ?? null,
      impulseReviewStatus: input.impulseResult.impulse?.reviewStatus ?? null,
    }),
    lifecycleStatus: "active",
  });

  if ("reason" in result) {
    return result;
  }

  return { id, freshnessVersion: 1 };
}
