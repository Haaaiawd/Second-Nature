/**
 * FrameSourceValidator — Check CharacterFrame text for forbidden identity-lock,
 * emotion-claim, personality-score and hard-control patterns.
 *
 * Core logic: scan serialized frame text for scoped rule violations while
 * allowing safe counterexamples (security policy wording, context-reader labels).
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §3.4`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §3.6`
 *
 * Dependencies: `src/shared/types/v9-contracts.js`
 *
 * Boundary:
 * - Returns rule IDs, not boolean; each violation carries location path.
 * - Checks every posture + contestPrompt + habit/tension text.
 * - Does not rewrite text; caller decides deferred/allowed.
 *
 * Test coverage: tests/unit/character/v9-character-frame-builder.test.ts
 */

import type {
  CharacterFrame,
  ConflictNote,
  EmergentHabit,
  ExpressionPosture,
  GrowthTension,
  RelationshipPosture,
  SourceRef,
  ValuePosture,
} from "../../../shared/types/v9-contracts.js";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type FrameSourceRule =
  | "emotion_assertion"
  | "personality_score"
  | "personality_label"
  | "hard_control_rule"
  | "empty_source_posture"
  | "source_count_below_minimum"
  | "contest_prompt_contains_assertion";

export interface FrameSourceViolation {
  rule: FrameSourceRule;
  matchedText: string;
  location: string;
}

export interface FrameValidationResult {
  ok: boolean;
  violations: FrameSourceViolation[];
}

interface FlattenedText {
  path: string;
  text: string;
  sourceRefs: SourceRef[];
}

// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────

export const MIN_SOURCE_REFS_PER_POSTURE = 1;

// Scoped forbidden patterns with rule IDs. Each rule has English and Chinese
// examples; safe counterexamples are left to tests.
const FORBIDDEN_PATTERNS: ReadonlyArray<{ rule: FrameSourceRule; regex: RegExp }> =
  [
    {
      rule: "emotion_assertion",
      regex: /\byou feel\s+(sad|angry|abandoned|happy|afraid|fearful|lonely|guilty|ashamed)\b/i,
    },
    {
      rule: "emotion_assertion",
      regex: /\byour (true )?emotion is\b/i,
    },
    {
      rule: "emotion_assertion",
      regex: /\byou are feeling\s+(sad|angry|abandoned|happy|afraid|fearful|lonely|guilty|ashamed)\b/i,
    },
    {
      rule: "personality_score",
      regex: /\bscore\s*[:=]?\s*\d+(\.\d+)?\b/i,
    },
    {
      rule: "personality_score",
      regex: /\btrait\s+score\b/i,
    },
    {
      rule: "personality_label",
      regex: /\b(big five|five factor|mbti|enfp|intj|infj|entp)\b/i,
    },
    {
      rule: "personality_label",
      regex: /\byou are (a|the) .* kind of person\b/i,
    },
    {
      rule: "emotion_assertion",
      regex: /你(正在)?(感到|感觉|觉得)(悲伤|愤怒|被抛下|开心|害怕|孤独|内疚|羞愧)/i,
    },
    {
      rule: "emotion_assertion",
      regex: /你的(真实)?情绪(是|为)/i,
    },
    {
      rule: "emotion_assertion",
      regex: /你内心(其实)?(感到|是|在)/i,
    },
    {
      rule: "personality_score",
      regex: /人格(分数|评分|得分)\s*[:：]?\s*\d+(\.\d+)?/i,
    },
    {
      rule: "personality_label",
      regex: /你的性格是/i,
    },
    {
      rule: "personality_label",
      regex: /你(就是|永远是|本质上是).*(人|人格|性格)/i,
    },
    {
      rule: "personality_label",
      regex: /你是.*(型人格|人格类型)/i,
    },
    {
      rule: "hard_control_rule",
      regex: /\byou must\b/i,
    },
    {
      rule: "hard_control_rule",
      regex: /\byou should always\b/i,
    },
    {
      rule: "hard_control_rule",
      regex: /\bnever (disagree|question|change|refuse)\b/i,
    },
    {
      rule: "hard_control_rule",
      regex: /你必须/i,
    },
    {
      rule: "hard_control_rule",
      regex: /你应该永远/i,
    },
    {
      rule: "hard_control_rule",
      regex: /永远不要(质疑|拒绝|改变|反驳)/i,
    },
  ];

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function* flattenFrameText(frame: CharacterFrame): Generator<FlattenedText> {
  const habits: EmergentHabit[] = frame.emergentHabits ?? [];
  for (let i = 0; i < habits.length; i++) {
    yield {
      path: `emergentHabits[${i}]`,
      text: habits[i].description,
      sourceRefs: habits[i].sourceRefs,
    };
  }

  if (frame.valuePosture) {
    const value: ValuePosture = frame.valuePosture;
    yield {
      path: "valuePosture.ordering",
      text: value.ordering.join("; "),
      sourceRefs: value.sourceRefs,
    };
    if (value.note) {
      yield {
        path: "valuePosture.note",
        text: value.note,
        sourceRefs: value.sourceRefs,
      };
    }
  }

  if (frame.relationshipPosture) {
    const rel: RelationshipPosture = frame.relationshipPosture;
    yield {
      path: "relationshipPosture.toward",
      text: rel.toward,
      sourceRefs: rel.sourceRefs,
    };
    yield {
      path: "relationshipPosture.stance",
      text: rel.stance,
      sourceRefs: rel.sourceRefs,
    };
  }

  if (frame.expressionPosture) {
    const expr: ExpressionPosture = frame.expressionPosture;
    for (let i = 0; i < expr.styleNotes.length; i++) {
      yield {
        path: `expressionPosture.styleNotes[${i}]`,
        text: expr.styleNotes[i],
        sourceRefs: expr.sourceRefs,
      };
    }
    if (expr.boundaryConstraints) {
      for (let i = 0; i < expr.boundaryConstraints.length; i++) {
        yield {
          path: `expressionPosture.boundaryConstraints[${i}]`,
          text: expr.boundaryConstraints[i],
          sourceRefs: expr.sourceRefs,
        };
      }
    }
  }

  const tensions: GrowthTension[] = frame.growthTensions ?? [];
  for (let i = 0; i < tensions.length; i++) {
    yield {
      path: `growthTensions[${i}]`,
      text: tensions[i].tension,
      sourceRefs: tensions[i].sourceRefs,
    };
  }

  const conflictNotes: ConflictNote[] = frame.conflictNotes ?? [];
  for (let i = 0; i < conflictNotes.length; i++) {
    yield {
      path: `conflictNotes[${i}]`,
      text: conflictNotes[i].note,
      sourceRefs: conflictNotes[i].conflictingSourceRefs,
    };
  }
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export class FrameSourceValidator {
  validate(frame: CharacterFrame): FrameValidationResult {
    const violations: FrameSourceViolation[] = [];

    if (frame.sourceRefs.length === 0) {
      violations.push({
        rule: "empty_source_posture",
        matchedText: "frame.sourceRefs",
        location: "frame.sourceRefs",
      });
    }

    for (const section of flattenFrameText(frame)) {
      if (section.sourceRefs.length < MIN_SOURCE_REFS_PER_POSTURE) {
        violations.push({
          rule: "source_count_below_minimum",
          matchedText: section.path,
          location: section.path,
        });
      }

      for (const { rule, regex } of FORBIDDEN_PATTERNS) {
        const match = section.text.match(regex);
        if (match) {
          violations.push({
            rule,
            matchedText: match[0],
            location: section.path,
          });
        }
      }
    }

    for (const { rule, regex } of FORBIDDEN_PATTERNS) {
      const match = frame.contestPrompt.match(regex);
      if (match) {
        violations.push({
          rule,
          matchedText: match[0],
          location: "contestPrompt",
        });
      }
    }

    return {
      ok: violations.length === 0,
      violations,
    };
  }
}
