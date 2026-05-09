/**
 * Stable operator explain entry matching cli-system.detail §3.8 (T1.2.1).
 *
 * Core logic: parse subject string via resolveExplainSubject, delegate to read models.
 */
import type { CliReadModels } from "../read-models/index.js";
import type { ExplainReadModel } from "../read-models/types.js";
import { resolveExplainSubject } from "./resolve-subject.js";

export async function explainSurfaceSubject(subjectRaw: string, readModels: CliReadModels): Promise<ExplainReadModel> {
  const trimmed = subjectRaw.trim();
  if (!trimmed) {
    throw new Error("explain_subject_requires_id");
  }
  const subject = resolveExplainSubject(trimmed);
  return readModels.explain(subject);
}
