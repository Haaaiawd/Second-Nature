import type { StateDatabase } from "../db/index.js";
export interface SourceRef {
    sourceId: string;
    kind: string;
    url?: string;
    snippet?: string;
}
export interface TopicAffinity {
    topic: string;
    affinity: number;
}
export interface RelationshipMemory {
    relationshipId: string;
    revision: number;
    tonePreference: "casual" | "direct" | "quiet" | "unknown";
    averageReplyDelayMinutes?: number;
    noReplyCount: number;
    topicAffinities: TopicAffinity[];
    lastInteractionAt?: string;
    sourceRefs: SourceRef[];
    updatedAt: string;
}
export interface RelationshipMemoryUpdate {
    relationshipId: string;
    revision: number;
    tonePreference: "casual" | "direct" | "quiet" | "unknown";
    averageReplyDelayMinutes?: number;
    noReplyCount: number;
    topicAffinities: TopicAffinity[];
    lastInteractionAt?: string;
    sourceRefs: SourceRef[];
    updatedAt: string;
}
export interface RelationshipMemoryWriteAck {
    relationshipId: string;
    status: "acknowledged" | "degraded";
}
export interface RelationshipMemoryStore {
    upsertRelationshipMemory(input: RelationshipMemoryUpdate): Promise<RelationshipMemoryWriteAck>;
    loadRelationshipMemory(relationshipId?: string): Promise<RelationshipMemory | null>;
}
export declare function createRelationshipMemoryStore(database: StateDatabase): RelationshipMemoryStore;
