function splitSubject(raw) {
    const [prefix, ...rest] = raw.split(":");
    return {
        prefix: (prefix ?? "").trim(),
        id: rest.join(":").trim(),
    };
}
export function resolveExplainSubject(raw) {
    const { prefix, id } = splitSubject(raw);
    if (!id) {
        throw new Error("explain_subject_requires_id");
    }
    if (prefix === "decision") {
        return { kind: "decision", id };
    }
    if (prefix === "platform") {
        return { kind: "platform-selection", id };
    }
    if (prefix === "outreach") {
        return { kind: "outreach", id };
    }
    if (prefix === "soul") {
        return { kind: "soul-change", id };
    }
    throw new Error("explain_subject_unsupported");
}
