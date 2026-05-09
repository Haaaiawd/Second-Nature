/**
 * Stable operator explain entry matching cli-system.detail §3.8 (T1.2.1).
 *
 * Core logic: parse subject string via resolveExplainSubject, delegate to read models.
 */
import type { CliReadModels } from "../read-models/index.js";
import type { ExplainReadModel } from "../read-models/types.js";
export declare function explainSurfaceSubject(subjectRaw: string, readModels: CliReadModels): Promise<ExplainReadModel>;
