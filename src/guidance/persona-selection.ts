import type {
  GuidanceSceneType,
  PersonaCandidate,
  PersonaInjectionBudget,
  PersonaSelectionDecision,
  PersonaSnippet,
  PersonaSource,
  SceneContext,
} from "./types.js";

export interface PersonaSelectionPolicy {
  readonly sourcePriority: readonly PersonaSource[];
  readonly preferredTags: readonly string[];
  readonly budget: PersonaInjectionBudget;
}

const SCENE_POLICIES: Record<GuidanceSceneType, PersonaSelectionPolicy> = {
  social: {
    sourcePriority: ["SOUL", "IDENTITY", "MEMORY", "USER"],
    preferredTags: ["social", "public", "curiosity", "voice"],
    budget: { maxSnippets: 2, maxTotalCharacters: 360 },
  },
  reply: {
    sourcePriority: ["USER", "IDENTITY", "SOUL", "MEMORY"],
    preferredTags: ["reply", "conversation", "care", "clarity"],
    budget: { maxSnippets: 2, maxTotalCharacters: 320 },
  },
  outreach: {
    sourcePriority: ["USER", "SOUL", "MEMORY", "IDENTITY"],
    preferredTags: ["outreach", "user", "trust", "initiative"],
    budget: { maxSnippets: 2, maxTotalCharacters: 420 },
  },
  quiet: {
    sourcePriority: ["SOUL", "MEMORY", "IDENTITY", "USER"],
    preferredTags: ["quiet", "reflection", "memory", "meaning"],
    budget: { maxSnippets: 3, maxTotalCharacters: 640 },
  },
  heartbeat: {
    sourcePriority: ["IDENTITY", "SOUL", "MEMORY", "USER"],
    preferredTags: ["heartbeat", "continuity", "truthfulness", "runtime"],
    budget: { maxSnippets: 2, maxTotalCharacters: 360 },
  },
  explain: {
    sourcePriority: ["IDENTITY", "USER", "SOUL", "MEMORY"],
    preferredTags: ["explain", "principle", "context", "truthfulness"],
    budget: { maxSnippets: 2, maxTotalCharacters: 420 },
  },
  user_reply: {
    sourcePriority: ["SOUL", "IDENTITY", "USER", "MEMORY"],
    preferredTags: ["continuity", "tone", "conversation", "authenticity"],
    budget: { maxSnippets: 2, maxTotalCharacters: 280 },
  },
};

function tagScore(candidate: PersonaCandidate, preferredTags: readonly string[]): number {
  const normalized = new Set(candidate.tags.map((tag) => tag.toLowerCase()));
  return preferredTags.reduce((score, tag) => score + (normalized.has(tag.toLowerCase()) ? 2 : 0), 0);
}

function sourceScore(source: PersonaSource, policy: PersonaSelectionPolicy): number {
  const index = policy.sourcePriority.indexOf(source);
  return index === -1 ? 0 : policy.sourcePriority.length - index;
}

function truncateToBudget(text: string, remainingCharacters: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= remainingCharacters) {
    return normalized;
  }
  const ellipsis = remainingCharacters > 3 ? "..." : "";
  const contentBudget = Math.max(0, remainingCharacters - ellipsis.length);
  const clipped = normalized.slice(0, contentBudget).trimEnd();
  if (clipped.length === 0) {
    return "";
  }
  return `${clipped}${ellipsis}`;
}

function buildRationale(candidate: PersonaCandidate, sceneType: GuidanceSceneType): string {
  const tags = candidate.tags.slice(0, 3).join(", ");
  const tagPart = tags.length > 0 ? `，标签贴近 ${tags}` : "";
  return `${candidate.source} 片段更贴近 ${sceneType} 场景需要的内在取向${tagPart}`;
}

export function getPersonaSelectionPolicy(sceneType: GuidanceSceneType): PersonaSelectionPolicy {
  return SCENE_POLICIES[sceneType];
}

export function selectPersonaSnippets(input: {
  sceneContext: SceneContext;
  candidates: PersonaCandidate[];
}): PersonaSelectionDecision {
  const policy = getPersonaSelectionPolicy(input.sceneContext.sceneType);
  const rankedCandidates = [...input.candidates].sort((left, right) => {
    const scoreLeft = sourceScore(left.source, policy) * 10 + tagScore(left, policy.preferredTags);
    const scoreRight = sourceScore(right.source, policy) * 10 + tagScore(right, policy.preferredTags);
    return scoreRight - scoreLeft;
  });

  const snippets: PersonaSnippet[] = [];
  let remainingCharacters = policy.budget.maxTotalCharacters;

  for (const candidate of rankedCandidates) {
    if (snippets.length >= policy.budget.maxSnippets) {
      break;
    }

    if (remainingCharacters <= 0) {
      break;
    }

    const text = truncateToBudget(candidate.text, remainingCharacters);
    if (text.length === 0) {
      continue;
    }

    snippets.push({
      candidateId: candidate.id,
      source: candidate.source,
      text,
      rationale: buildRationale(candidate, input.sceneContext.sceneType),
    });
    remainingCharacters -= text.length;
  }

  return {
    sceneType: input.sceneContext.sceneType,
    budget: policy.budget,
    snippets,
  };
}
