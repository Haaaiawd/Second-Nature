import type { StateDatabase } from "../db/index.js";
export type ChronicleEventKind = "heartbeat" | "connector_action" | "outreach" | "owner_reply" | "dream_run" | "maintenance";
export interface SourceRef {
    sourceId: string;
    kind: string;
    url?: string;
    snippet?: string;
}
export interface OwnerReplySignal {
    tone?: string;
    delayMinutes?: number;
    topics?: string[];
    explicitPreference?: string;
}
export interface SessionChronicleEntry {
    entryId: string;
    eventKind: ChronicleEventKind;
    actor: "agent" | "owner" | "system";
    occurredAt: string;
    summary: string;
    result: "succeeded" | "failed" | "skipped" | "no_reply" | "partial";
    sourceRefs: SourceRef[];
    relatedDecisionId?: string;
    relatedDreamRunId?: string;
    ownerReply?: OwnerReplySignal;
}
export interface ChronicleQuery {
    eventKinds?: ChronicleEventKind[];
    from?: string;
    to?: string;
    actor?: "agent" | "owner" | "system";
    limit?: number;
}
export interface ChronicleWriteAck {
    entryId: string;
    status: "acknowledged" | "degraded";
}
export interface SessionChronicleStore {
    appendSessionChronicle(entry: SessionChronicleEntry): Promise<ChronicleWriteAck>;
    loadSessionChronicle(query: ChronicleQuery): Promise<SessionChronicleEntry[]>;
}
export declare function createSessionChronicleStore(database: StateDatabase): SessionChronicleStore;
