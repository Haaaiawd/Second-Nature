/**
 * CharacterFrameLifecycle — Contest/re-authoring state machine and projection
 * adapter for CharacterFrame.
 *
 * Core logic:
 * - Apply accept/reject/revise/retire actions with a transition matrix.
 * - Build bounded `EmbodiedContextCharacterProjection` from an accepted frame.
 * - Build `CharacterFramePointer` for SelfContinuityCard injection.
 * - Mark first injection as `newlyProposed` until Agent contests or accepts.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md §5.1 §6.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §2.1 §3.2 §3.3 §4.2 §4.3`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.5`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §5`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js`
 * - `src/core/second-nature/character/character-frame-builder.js`
 *
 * Boundary:
 * - `contested` is not a CharacterFrame status; it is a runtime pointer/projection
 *   status owned by `control-context-system`.
 * - Only `accepted` frames can be projected as `active`.
 * - `newlyProposed` is a projection/pointer flag, not a frame status.
 * - Revision creates a new `candidate` frame linked to the original; the original
 *   stays `accepted` until the revision is accepted.
 * - Supersede sets the previous accepted frame to `superseded` with `validUntil`.
 *
 * Test coverage:
 * - `tests/unit/character/v9-character-lifecycle.test.ts`
 * - `tests/integration/v9/character-context-projection.test.ts`
 */

import { randomUUID } from "node:crypto";
import type {
  CharacterContestAction,
  CharacterContestResult,
  CharacterFrame,
  CharacterFramePointer,
  CharacterFrameStatus,
  EmbodiedContextCharacterProjection,
  EmergentHabit,
  GrowthTension,
  SourceRef,
  ValuePosture,
  RelationshipPosture,
  ExpressionPosture,
} from "../../../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────

const POINTER_SUMMARY_MAX_CHARS = 200;
const PROJECTION_TEXT_MAX_BYTES = 900;
const CONTEST_PROMPT_MAX_BYTES = 300;
const CONTESTABLE_PREFIX = "[Contestable projection] ";

const CONFIDENCE_ORDER: Record<EmergentHabit["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface CharacterFrameStorePort {
  readFrameById(id: string): Promise<CharacterFrame | null>;
  readLatestAcceptedFrame(): Promise<CharacterFrame | null>;
  readPendingRevisionFor(frameId: string): Promise<CharacterFrame | null>;
  writeCandidateFrame(frame: CharacterFrame): Promise<void>;
  updateFrameLifecycle(
    frameId: string,
    status: CharacterFrameStatus,
    opts?: {
      supersededBy?: string;
      successorFrameId?: string;
      validUntil?: string;
      revisionOf?: string | null;
      acceptedAt?: string;
      charCount?: number;
      payloadJson?: string;
    },
  ): Promise<void>;
}

export interface BuildProjectionOptions {
  pointerStatus?: CharacterFramePointer["status"];
  newlyProposed?: boolean;
}

export interface ProjectionWithPointer {
  pointer: CharacterFramePointer;
  projection: EmbodiedContextCharacterProjection;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function countUtf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

function truncateToBytes(text: string, maxBytes: number): string {
  if (countUtf8Bytes(text) <= maxBytes) return text;
  const ellipsis = "…";
  const ellipsisBytes = countUtf8Bytes(ellipsis);
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (countUtf8Bytes(text.slice(0, mid)) + ellipsisBytes <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return text.slice(0, low) + ellipsis;
}

function makeSourceRef(family: SourceRef["family"], id: string): SourceRef {
  return { family, id };
}

function hasFirstInjectionMarker(frame: CharacterFrame): boolean {
  try {
    const payload = frame.payloadJson ? JSON.parse(frame.payloadJson) : null;
    return payload && typeof payload.firstInjectedAt === "string";
  } catch {
    return false;
  }
}

function markFirstSeenPayload(now: string): string {
  return JSON.stringify({ firstInjectedAt: now });
}

function sortBySourceCountAndConfidence<T extends { sourceRefs: SourceRef[]; confidence?: EmergentHabit["confidence"] }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const srcDiff = b.sourceRefs.length - a.sourceRefs.length;
    if (srcDiff !== 0) return srcDiff;
    if (a.confidence && b.confidence) {
      return CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
    }
    return 0;
  });
}

function sortBySourceCount<T extends { sourceRefs: SourceRef[] }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.sourceRefs.length - a.sourceRefs.length);
}

function buildFrameSummary(frame: CharacterFrame): string {
  const parts: string[] = [];
  if (frame.emergentHabits && frame.emergentHabits.length > 0) {
    parts.push(`habits: ${sortBySourceCountAndConfidence(frame.emergentHabits).map((h) => h.description).join("; ")}`);
  }
  if (frame.valuePosture) {
    parts.push(`values: ${frame.valuePosture.ordering.join(", ")}`);
  }
  if (frame.relationshipPosture) {
    parts.push(`relationship: ${frame.relationshipPosture.stance}`);
  }
  if (frame.expressionPosture) {
    parts.push(`expression: ${frame.expressionPosture.styleNotes.join("; ")}`);
  }
  if (frame.growthTensions && frame.growthTensions.length > 0) {
    parts.push(`tensions: ${sortBySourceCount(frame.growthTensions).map((t) => t.tension).join("; ")}`);
  }
  const joined = parts.join(" | ");
  if (countUtf8Bytes(joined) <= POINTER_SUMMARY_MAX_CHARS) return joined;
  return truncateToBytes(joined, POINTER_SUMMARY_MAX_CHARS);
}

function serializePostureSourceRefs(refs: SourceRef[]): string {
  if (refs.length === 0) return "";
  return ` [${refs.map((r) => `${r.family}:${r.id}`).join(", ")}]`;
}

function serializeHabit(h: EmergentHabit): string {
  return `- ${h.description} (${h.confidence})${serializePostureSourceRefs(h.sourceRefs)}`;
}

function serializeValuePosture(v: ValuePosture): string {
  const note = v.note ? `\n  note: ${v.note}${serializePostureSourceRefs(v.sourceRefs)}` : "";
  return `Values: ${v.ordering.join(" > ")}${serializePostureSourceRefs(v.sourceRefs)}${note}`;
}

function serializeRelationshipPosture(r: RelationshipPosture): string {
  return `Relationship: ${r.toward} — ${r.stance}${serializePostureSourceRefs(r.sourceRefs)}`;
}

function serializeExpressionPosture(e: ExpressionPosture): string {
  const parts = [`Expression: ${e.styleNotes.join("; ")}${serializePostureSourceRefs(e.sourceRefs)}`];
  if (e.boundaryConstraints && e.boundaryConstraints.length > 0) {
    parts.push(`Boundaries: ${e.boundaryConstraints.join("; ")}`);
  }
  return parts.join("\n");
}

function serializeGrowthTension(t: GrowthTension): string {
  return `- ${t.tension}${serializePostureSourceRefs(t.sourceRefs)}`;
}

function serializeFrameText(frame: CharacterFrame): string {
  const sections: string[] = [];
  if (frame.emergentHabits && frame.emergentHabits.length > 0) {
    sections.push(
      "Habits:\n" + sortBySourceCountAndConfidence(frame.emergentHabits).map(serializeHabit).join("\n"),
    );
  }
  if (frame.valuePosture) {
    sections.push(serializeValuePosture(frame.valuePosture));
  }
  if (frame.relationshipPosture) {
    sections.push(serializeRelationshipPosture(frame.relationshipPosture));
  }
  if (frame.expressionPosture) {
    sections.push(serializeExpressionPosture(frame.expressionPosture));
  }
  if (frame.growthTensions && frame.growthTensions.length > 0) {
    sections.push(
      "Growth tensions:\n" + sortBySourceCount(frame.growthTensions).map(serializeGrowthTension).join("\n"),
    );
  }
  if (frame.conflictNotes && frame.conflictNotes.length > 0) {
    sections.push(
      "Conflict notes:\n" + frame.conflictNotes.map((n) => `- ${n.note}`).join("\n"),
    );
  }
  const body = sections.join("\n\n");
  const full = CONTESTABLE_PREFIX + body;
  if (countUtf8Bytes(full) <= PROJECTION_TEXT_MAX_BYTES) return full;
  // If prefix + body exceeds budget, drop prefix and truncate body to leave room for ellipsis.
  const bodyBudget = PROJECTION_TEXT_MAX_BYTES - countUtf8Bytes(CONTESTABLE_PREFIX);
  return CONTESTABLE_PREFIX + truncateToBytes(body, bodyBudget);
}

// ───────────────────────────────────────────────────────────────
// Lifecycle state machine
// ───────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<CharacterFrameStatus, CharacterContestAction[]> = {
  candidate: ["accept", "reject", "revise"],
  accepted: ["reject", "revise", "retire"],
  rejected: ["revise"],
  retired: ["revise"],
  superseded: [],
};

const ACTION_TO_STATUS: Record<Exclude<CharacterContestAction, "revise">, CharacterFrameStatus> = {
  accept: "accepted",
  reject: "rejected",
  retire: "retired",
};

function copyFrameForRevision(frame: CharacterFrame, now: string): CharacterFrame {
  return {
    ...frame,
    id: randomUUID(),
    version: frame.version + 1,
    status: "candidate",
    validFrom: now,
    validUntil: null,
    revisionOf: frame.id,
    supersededBy: null,
    acceptedAt: undefined,
    payloadJson: undefined,
    createdAt: now,
  };
}

export async function applyCharacterContest(
  frameId: string,
  action: CharacterContestAction,
  store: CharacterFrameStorePort,
  options: { reason?: string; now?: string } = {},
): Promise<CharacterContestResult> {
  const frame = await store.readFrameById(frameId);
  if (!frame) {
    throw new Error("character_frame_not_found");
  }

  const validActions = VALID_TRANSITIONS[frame.status];
  if (!validActions.includes(action)) {
    throw new Error(`invalid_contest_action:${frame.status}-${action}`);
  }

  const now = options.now ?? new Date().toISOString();

  if (action === "revise") {
    const revision = copyFrameForRevision(frame, now);
    await store.writeCandidateFrame(revision);
    return {
      frameId,
      previousStatus: frame.status,
      newStatus: frame.status, // original frame status unchanged
      successorFrameId: revision.id,
      sourceRefs: [makeSourceRef("character", frameId)],
    };
  }

  const previousStatus = frame.status;
  const newStatus = ACTION_TO_STATUS[action];

  const updateOpts: NonNullable<Parameters<CharacterFrameStorePort["updateFrameLifecycle"]>[2]> = {};
  if (action === "accept") {
    updateOpts.acceptedAt = now;
    if (frame.revisionOf) {
      // Accepting a revision supersedes the original frame it revises.
      await store.updateFrameLifecycle(frame.revisionOf, "superseded", {
        supersededBy: frameId,
        validUntil: now,
      });
    }
  }
  if (action === "reject" || action === "retire") {
    updateOpts.validUntil = now;
  }

  await store.updateFrameLifecycle(frameId, newStatus, updateOpts);

  return {
    frameId,
    previousStatus,
    newStatus,
    sourceRefs: [makeSourceRef("character", frameId)],
  };
}

export async function supersedeFrame(
  previousId: string,
  newFrameId: string,
  store: CharacterFrameStorePort,
  options: { now?: string } = {},
): Promise<CharacterContestResult> {
  const previous = await store.readFrameById(previousId);
  if (!previous) {
    throw new Error("character_frame_not_found");
  }
  if (previous.status !== "accepted") {
    throw new Error(`invalid_supersede_action:${previous.status}`);
  }
  const now = options.now ?? new Date().toISOString();
  await store.updateFrameLifecycle(previousId, "superseded", {
    supersededBy: newFrameId,
    validUntil: now,
  });
  return {
    frameId: previousId,
    previousStatus: previous.status,
    newStatus: "superseded",
    sourceRefs: [makeSourceRef("character", previousId)],
  };
}

// ───────────────────────────────────────────────────────────────
// Projection / pointer builders
// ───────────────────────────────────────────────────────────────

export function buildCharacterFramePointer(
  frame: CharacterFrame,
  opts: BuildProjectionOptions = {},
): CharacterFramePointer {
  return {
    frameId: frame.id,
    summary: buildFrameSummary(frame),
    contestPrompt: truncateToBytes(frame.contestPrompt, CONTEST_PROMPT_MAX_BYTES),
    sourceRefs: frame.sourceRefs,
    status: opts.pointerStatus ?? "active",
    newlyProposed: opts.newlyProposed,
  };
}

export function buildEmbodiedContextProjection(
  frame: CharacterFrame,
  opts: BuildProjectionOptions = {},
): EmbodiedContextCharacterProjection {
  const text = serializeFrameText(frame);
  return {
    frameId: frame.id,
    text,
    contestPrompt: truncateToBytes(frame.contestPrompt, CONTEST_PROMPT_MAX_BYTES),
    sourceRefs: frame.sourceRefs,
    status: opts.pointerStatus === "deferred" || opts.pointerStatus === "contested"
      ? opts.pointerStatus
      : "active",
    newlyProposed: opts.newlyProposed,
  };
}

export function buildCharacterProjectionPair(
  frame: CharacterFrame,
  opts: BuildProjectionOptions = {},
): ProjectionWithPointer {
  return {
    pointer: buildCharacterFramePointer(frame, opts),
    projection: buildEmbodiedContextProjection(frame, opts),
  };
}

// ───────────────────────────────────────────────────────────────
// Active frame loader
// ───────────────────────────────────────────────────────────────

export interface LoadActiveCharacterFrameResult {
  frame?: CharacterFrame;
  pointer?: CharacterFramePointer;
  projection?: EmbodiedContextCharacterProjection;
  reason?: string;
}

export async function loadActiveCharacterFrame(
  store: CharacterFrameStorePort,
  options: { now?: string; isFirstInjection?: boolean; contestedFrameId?: string } = {},
): Promise<LoadActiveCharacterFrameResult> {
  const latest = await store.readLatestAcceptedFrame();
  if (!latest || latest.status !== "accepted") {
    return { reason: "character_frame_deferred" };
  }

  if (latest.id === options.contestedFrameId) {
    const pair = buildCharacterProjectionPair(latest, {
      pointerStatus: "contested",
      newlyProposed: false,
    });
    return { frame: latest, pointer: pair.pointer, projection: pair.projection, reason: "character_frame_contested" };
  }

  const pendingRevision = await store.readPendingRevisionFor(latest.id);
  if (pendingRevision) {
    const pair = buildCharacterProjectionPair(latest, {
      pointerStatus: "contested",
      newlyProposed: false,
    });
    return {
      frame: latest,
      pointer: pair.pointer,
      projection: pair.projection,
      reason: "character_frame_revision_pending",
    };
  }

  const newlyProposed = options.isFirstInjection ?? !hasFirstInjectionMarker(latest);
  const pair = buildCharacterProjectionPair(latest, {
    pointerStatus: "active",
    newlyProposed,
  });

  return {
    frame: latest,
    pointer: pair.pointer,
    projection: pair.projection,
  };
}

export async function markFirstInjectionSeen(
  store: CharacterFrameStorePort,
  frameId: string,
  now = new Date().toISOString(),
): Promise<void> {
  const frame = await store.readFrameById(frameId);
  if (!frame) return;
  await store.updateFrameLifecycle(frameId, frame.status, {
    payloadJson: markFirstSeenPayload(now),
  });
}
