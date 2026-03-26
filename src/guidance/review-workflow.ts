import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TemplateReviewStatus } from "./types.js";

export interface GuidanceTemplateReviewItem {
  templateId: string;
  relativePath: string;
  scope: string;
  scene?: string;
  reviewRequired: boolean;
  reviewStatus: TemplateReviewStatus;
  nextAction: "human_review_required" | "ready_for_runtime_use" | "revise_template";
}

export interface GuidanceReviewChecklist {
  generatedAt: string;
  items: GuidanceTemplateReviewItem[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..", "..");
const templatesRoot = path.join(projectRoot, "src", "guidance", "templates");

const TEMPLATE_MANIFEST = [
  { templateId: "atmosphere.baseline", relativePath: path.join("atmosphere", "baseline.md") },
  { templateId: "impulse.social", relativePath: path.join("impulses", "social.md") },
  { templateId: "impulse.reply", relativePath: path.join("impulses", "reply.md") },
  { templateId: "impulse.outreach", relativePath: path.join("impulses", "outreach.md") },
  { templateId: "impulse.quiet", relativePath: path.join("impulses", "quiet.md") },
  { templateId: "persona.selection", relativePath: "persona-selection-policy.md" },
] as const;

function parseFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes(":"))
    .reduce<Record<string, string>>((acc, line) => {
      const [key, ...rest] = line.split(":");
      acc[key.trim()] = rest.join(":").trim();
      return acc;
    }, {});
}

function toNextAction(status: TemplateReviewStatus): GuidanceTemplateReviewItem["nextAction"] {
  if (status === "approved") {
    return "ready_for_runtime_use";
  }
  if (status === "rejected") {
    return "revise_template";
  }
  return "human_review_required";
}

export async function collectGuidanceReviewChecklist(): Promise<GuidanceReviewChecklist> {
  const items = await Promise.all(
    TEMPLATE_MANIFEST.map(async (template) => {
      const fullPath = path.join(templatesRoot, template.relativePath);
      const markdown = await readFile(fullPath, "utf8");
      const metadata = parseFrontmatter(markdown);
      const reviewStatus = (metadata.review_status ?? "pending_human_review") as TemplateReviewStatus;

      return {
        templateId: template.templateId,
        relativePath: path.join("src", "guidance", "templates", template.relativePath).replace(/\\/g, "/"),
        scope: metadata.scope ?? "unknown",
        scene: metadata.scene,
        reviewRequired: metadata.review_required === "true",
        reviewStatus,
        nextAction: toNextAction(reviewStatus),
      } satisfies GuidanceTemplateReviewItem;
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    items,
  };
}
