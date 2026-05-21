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
    if (prefix === "fallback") {
        return { kind: "fallback", id };
    }
    if (prefix === "probe") {
        return { kind: "probe", id };
    }
    if (prefix === "report") {
        return { kind: "report", id };
    }
    if (prefix === "delivery") {
        return { kind: "delivery", id };
    }
    if (prefix === "source" || prefix === "source_ref") {
        return { kind: "source_ref", id };
    }
    if (prefix === "relationship") {
        return { kind: "relationship", id };
    }
    throw new Error("explain_subject_unsupported");
}
