import { resolveExplainSubject } from "./resolve-subject.js";
export async function explainSurfaceSubject(subjectRaw, readModels) {
    const trimmed = subjectRaw.trim();
    if (!trimmed) {
        throw new Error("explain_subject_requires_id");
    }
    const subject = resolveExplainSubject(trimmed);
    return readModels.explain(subject);
}
