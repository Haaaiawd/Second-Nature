import path from "node:path";

import { readText, resolveAnchorPath } from "../memory/workspace/paths.js";
import type { PersonaCandidate, SceneContext } from "../../guidance/types.js";

export interface PersonaCandidateLoader {
  loadPersonaCandidates(sceneContext: SceneContext): Promise<PersonaCandidate[]>;
}

const ANCHOR_ASSET_SOURCES = [
  { source: "SOUL", fileName: "SOUL.md" },
  { source: "USER", fileName: "USER.md" },
  { source: "IDENTITY", fileName: "IDENTITY.md" },
  { source: "MEMORY", fileName: "MEMORY.md" },
] as const;

function toTags(sceneContext: SceneContext, fileName: string): string[] {
  const base = path.basename(fileName, ".md").toLowerCase();
  return [sceneContext.sceneType, sceneContext.mode, base];
}

function toSnippetCandidates(input: {
  sceneContext: SceneContext;
  source: PersonaCandidate["source"];
  fileName: string;
  content: string;
}): PersonaCandidate[] {
  const normalized = input.content
    .split(/\r?\n{2,}/)
    .map((chunk) => chunk.replace(/^#+\s+/gm, "").replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length > 0)
    .slice(0, 6);

  return normalized.map((text, index) => ({
    id: `${input.source.toLowerCase()}-${index + 1}`,
    source: input.source,
    text,
    tags: toTags(input.sceneContext, input.fileName),
  }));
}

export function createPersonaCandidateLoader(): PersonaCandidateLoader {
  return {
    async loadPersonaCandidates(sceneContext: SceneContext): Promise<PersonaCandidate[]> {
      const loaded = await Promise.all(
        ANCHOR_ASSET_SOURCES.map(async ({ source, fileName }) => {
          const content = await readText(resolveAnchorPath(fileName));
          return toSnippetCandidates({
            sceneContext,
            source,
            fileName,
            content,
          });
        })
      );

      return loaded.flat();
    },
  };
}
