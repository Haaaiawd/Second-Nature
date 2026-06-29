/**
 * ContextSerializer — T2.2.1
 *
 * Core logic: Render `EmbodiedContext` into a Claw-facing prompt slice with
 * contestable-projection markers and Agent-boundary forbidden-pattern checks.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.md §5.1 §9.3`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §3.10`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3.6`
 * - ADR-006: Character Continuity as Emergent Projection
 *
 * Boundary:
 * - Slices are rendered in separate sections; never merged into a single
 *   "you must act" system command.
 * - Character projection is prefixed with a contestable marker.
 * - Newly proposed frames are explicitly labeled as candidates.
 * - Forbidden patterns are detected per section. When a section contains a
 *   hard-control / emotion-claim / identity-lock pattern, that section is
 *   replaced with a `[blocked: <ruleId>]` marker in the output text.
 * - Does NOT redact credentials; input slices are assumed already redacted.
 *
 * Test coverage:
 * - `tests/unit/control-plane/v9-embodied-context.test.ts`
 * - `tests/integration/v9/context-continuity-injection.test.ts`
 */

import type { EmbodiedContext } from "../../../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────

const CONTESTABLE_MARKER = "[Contestable projection]";
const NEWLY_PROPOSED_MARKER = "[Newly proposed — accept, reject, revise, or retire]";
const DEFERRED_MARKER = "[Deferred projection]";
const CONTESTED_MARKER = "[Agent contested — not used as fact]";

export type ForbiddenRuleId = "emotion_claim" | "identity_lock" | "hard_control";

interface ForbiddenRule {
  id: ForbiddenRuleId;
  patterns: RegExp[];
}

// Scoped rule IDs aligned with shared-v9-contracts.md §3.6
const FORBIDDEN_RULES: ForbiddenRule[] = [
  {
    id: "emotion_claim",
    patterns: [
      /\byou\s+feel\s+/i,
      /\byour\s+true\s+emotion\s+is\b/i,
      /\b你\s*(?:感到|觉得)\s*/,
      /\b你的真实情绪是\b/,
    ],
  },
  {
    id: "identity_lock",
    patterns: [
      /\byou\s+are\s+a\s+(?:loyal|kind|selfless|anxious|controlling|toxic|people[-\s]?pleasing)\s+person\b/i,
      /\byou\s+are\s+the\s+kind\s+of\s+person\s+who\s+never\s+changes\b/i,
      /你就是这样的人/,
      /你是(?:讨好型人格|忠诚的人|不会改变的人)/,
    ],
  },
  {
    id: "hard_control",
    patterns: [
      /\byou\s+must\b/i,
      /\byou\s+should\s+always\b/i,
      /\bnever\s+(?:disagree|question|change|refuse)\b/i,
      /你必须/,
      /你应该永远/,
      /永远不要(?:质疑|拒绝|改变|反驳)/,
    ],
  },
];

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export interface SerializedContext {
  text: string;
  sections: string[];
  forbiddenPatternWarnings: ForbiddenPatternWarning[];
  isBlocked: boolean;
  blockedReasons: ForbiddenRuleId[];
}

export interface ForbiddenPatternWarning {
  section: string;
  ruleId: ForbiddenRuleId;
  snippet: string;
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function serializeEmbodiedContext(context: EmbodiedContext): SerializedContext {
  const renderedSections: RenderedSection[] = [];

  pushSection(renderedSections, "assembledAt", context.assembledAt);

  // v8-compatible slices
  pushSliceSection(renderedSections, "identity", context.identity, renderIdentity);
  pushSliceSection(renderedSections, "goals", context.goals, renderGoals);
  pushSliceSection(renderedSections, "recentInteractions", context.recentInteractions, renderArrayLength);
  pushSliceSection(renderedSections, "toolExperience", context.toolExperience, renderArrayLength);
  pushSliceSection(renderedSections, "acceptedDream", context.acceptedDream, renderArrayLength);
  pushSliceSection(renderedSections, "affordanceMap", context.affordanceMap, renderAffordanceMap);
  pushSliceSection(renderedSections, "selfHealth", context.selfHealth, renderSelfHealth);

  // v9 continuity slices
  pushSliceSection(renderedSections, "selfContinuityCard", context.selfContinuityCard, renderSelfContinuityCard);
  pushSliceSection(renderedSections, "characterFramePointer", context.characterFramePointer, renderCharacterFramePointer);
  pushSliceSection(
    renderedSections,
    "characterFrameProjection",
    context.characterFrameProjection,
    renderCharacterFrameProjection,
  );
  pushSliceSection(renderedSections, "activeMemoryProjections", context.activeMemoryProjections, renderArrayLength);
  pushSliceSection(renderedSections, "activeProceduralProjections", context.activeProceduralProjections, renderArrayLength);
  pushSliceSection(renderedSections, "routineList", context.routineList, renderRoutineList);
  pushSliceSection(renderedSections, "activityThreads", context.activityThreads, renderActivityThreads);

  const warnings: ForbiddenPatternWarning[] = [];
  const blockedReasons = new Set<ForbiddenRuleId>();
  let isBlocked = false;

  for (const section of renderedSections) {
    for (const rule of FORBIDDEN_RULES) {
      for (const pattern of rule.patterns) {
        const match = section.body.match(pattern);
        if (match) {
          warnings.push({
            section: section.name,
            ruleId: rule.id,
            snippet: section.body.slice(Math.max(0, match.index! - 20), match.index! + match[0].length + 20),
          });
          blockedReasons.add(rule.id);
          section.blocked = true;
          section.blockReason = rule.id;
          isBlocked = true;
        }
      }
    }
  }

  const finalSections: string[] = renderedSections.map((s) => {
    if (s.blocked) {
      return `## ${s.name}\n[blocked: ${s.blockReason}]`;
    }
    return s.original;
  });

  return {
    text: finalSections.join("\n\n"),
    sections: finalSections,
    forbiddenPatternWarnings: warnings,
    isBlocked,
    blockedReasons: Array.from(blockedReasons),
  };
}

// ───────────────────────────────────────────────────────────────
// Section renderers
// ───────────────────────────────────────────────────────────────

interface RenderedSection {
  name: string;
  original: string;
  body: string;
  blocked?: boolean;
  blockReason?: ForbiddenRuleId;
}

function pushSection(sections: RenderedSection[], name: string, content: string): void {
  const body = content;
  sections.push({ name, original: `## ${name}\n${body}`, body });
}

function pushSliceSection<T>(
  sections: RenderedSection[],
  name: string,
  slice: { status: string; data: T; reason?: string },
  render: (data: T) => string,
): void {
  const statusLine = `status: ${slice.status}${slice.reason ? ` (${slice.reason})` : ""}`;
  const body = slice.status === "loaded" ? render(slice.data) : "[unavailable]";
  const original = `## ${name}\n${statusLine}\n${body}`;
  sections.push({ name, original, body });
}

function renderIdentity(data: unknown): string {
  if (data === null || typeof data !== "object") return "[empty]";
  const keys = Object.keys(data as Record<string, unknown>);
  return keys.length === 0 ? "[empty]" : `identity fields: ${keys.join(", ")}`;
}

function renderAffordanceMap(data: unknown): string {
  if (data === null || typeof data !== "object") return "[empty]";
  const keys = Object.keys(data as Record<string, unknown>);
  return keys.length === 0 ? "[empty]" : `platforms: ${keys.join(", ")}`;
}

function renderSelfHealth(data: unknown): string {
  const snapshot = data as { snapshotId?: string; checkedAt?: string } | undefined;
  return `snapshotId: ${snapshot?.snapshotId ?? "unknown"}, checkedAt: ${snapshot?.checkedAt ?? "unknown"}`;
}

function renderSelfContinuityCard(data: unknown): string {
  const card = data as { summary?: string; acceptedAt?: string } | undefined;
  return `summary: ${card?.summary ?? "[none]"}\nacceptedAt: ${card?.acceptedAt ?? "unknown"}`;
}

function renderCharacterFramePointer(data: unknown): string {
  const pointer = data as { frameId: string; summary: string; status: string } | undefined;
  return `frameId: ${pointer?.frameId ?? "unknown"}\nstatus: ${pointer?.status ?? "unknown"}\nsummary: ${pointer?.summary ?? ""}`;
}

function renderCharacterFrameProjection(data: unknown): string {
  const projection = data as { frameId: string; text: string; status: string; newlyProposed?: boolean } | undefined;
  const markers: string[] = [CONTESTABLE_MARKER];
  if (projection?.newlyProposed) markers.push(NEWLY_PROPOSED_MARKER);
  if (projection?.status === "deferred") markers.push(DEFERRED_MARKER);
  if (projection?.status === "contested") markers.push(CONTESTED_MARKER);
  return `${markers.join(" ")}\nframeId: ${projection?.frameId ?? "unknown"}\nstatus: ${projection?.status ?? "unknown"}\n${projection?.text ?? ""}`;
}

function renderGoals(data: unknown): string {
  return `active goals: ${Array.isArray(data) ? data.length : 0}`;
}

function renderArrayLength(data: unknown): string {
  return `items: ${Array.isArray(data) ? data.length : 0}`;
}

function renderRoutineList(data: unknown): string {
  return `routines: ${Array.isArray(data) ? data.length : 0}`;
}

function renderActivityThreads(data: unknown): string {
  return `threads: ${Array.isArray(data) ? data.length : 0}`;
}
