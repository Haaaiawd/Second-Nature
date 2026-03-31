export const GUIDANCE_OWNER_BOUNDARIES = {
    "control-plane-system": {
        owner: "control-plane-system",
        owns: ["scene context", "guidance request timing", "minimal fallback invocation"],
        provides: ["scene context for guidance assembly"],
        mustNotOwn: ["persona canonical store", "output style guard definition", "template content"],
    },
    "behavioral-guidance-system": {
        owner: "behavioral-guidance-system",
        owns: ["guidance payload assembly", "runtime atmosphere", "behavioral impulses", "persona reinforcement selection", "output guard"],
        provides: ["guidance payload", "guidance unavailable result"],
        mustNotOwn: ["action allow or deny decisions", "platform execution", "persona canonical store writes"],
    },
    "state-system": {
        owner: "state-system",
        owns: ["persona source assets", "candidate loading"],
        provides: ["snippet-sized persona candidates"],
        mustNotOwn: ["guidance payload assembly", "output guard semantics", "template wording"],
    },
    "observability-system": {
        owner: "observability-system",
        owns: ["guidance participation record", "snippet rationale visibility"],
        provides: ["guidance audit trail"],
        mustNotOwn: ["guidance authoring", "hard safety veto", "persona source ownership"],
    },
    "hard-guard-layer": {
        owner: "hard-guard-layer",
        owns: ["action legality", "risk veto", "credential and policy enforcement"],
        provides: ["hard allow or deny decision"],
        mustNotOwn: ["runtime atmosphere", "behavioral impulses", "persona reinforcement"],
    },
};
export const GUIDANCE_HANDOFFS = {
    request: {
        from: "control-plane-system",
        to: "behavioral-guidance-system",
        payload: "scene_context",
    },
    personaCandidates: {
        from: "state-system",
        to: "behavioral-guidance-system",
        payload: "snippet_sized_persona_candidates",
    },
    guidanceResult: {
        from: "behavioral-guidance-system",
        to: "control-plane-system",
        payload: "guidance_payload_or_unavailable",
    },
    auditRecord: {
        from: "behavioral-guidance-system",
        to: "observability-system",
        payload: "guidance_participation_summary",
    },
};
