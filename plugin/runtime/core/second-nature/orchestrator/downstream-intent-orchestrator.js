export function createDownstreamIntentOrchestrator() {
    return {
        orchestrate(intent) {
            switch (intent.effectClass) {
                case "connector_action":
                case "external_platform_action":
                    return {
                        kind: "connector_intent",
                        platformId: intent.platformId ?? "unknown",
                        capabilityId: intent.capabilityIntent,
                        payload: {
                            sourceRefs: intent.sourceRefs.map((r) => r.id),
                            summary: intent.summary,
                        },
                    };
                case "user_outreach":
                    return {
                        kind: "guidance_draft",
                        targetChannel: intent.platformId,
                        evidenceRefs: intent.sourceRefs.map((r) => r.id),
                    };
                case "narrative_reflection":
                    return { kind: "quiet_run", reason: "narrative_reflection" };
                case "maintenance":
                case "no_effect":
                    return {
                        kind: "none",
                        reason: "no_downstream_for_maintenance",
                    };
                case "memory_curation":
                    return {
                        kind: "dream_schedule",
                        reason: "memory_curation",
                    };
                default:
                    return {
                        kind: "none",
                        reason: `unhandled_effect_class:${intent.effectClass}`,
                    };
            }
        },
    };
}
