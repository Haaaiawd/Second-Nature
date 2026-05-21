import type { StateDatabase } from "../db/index.js";
export interface SourceRef {
    sourceId: string;
    kind: string;
    url?: string;
    snippet?: string;
}
export interface NarrativeState {
    narrativeId: string;
    revision: number;
    focus: string;
    progress: string[];
    nextIntent: string;
    confidence: number;
    sourceRefs: SourceRef[];
    unsupportedClaims: string[];
    status: "active" | "insufficient_sources" | "awaiting_sources";
    updatedAt: string;
}
export interface NarrativeStateUpdate {
    narrativeId: string;
    revision: number;
    focus: string;
    progress: string[];
    nextIntent: string;
    confidence: number;
    sourceRefs: SourceRef[];
    unsupportedClaims: string[];
    status: "active" | "insufficient_sources" | "awaiting_sources";
    updatedAt: string;
}
export interface NarrativeStateWriteAck {
    narrativeId: string;
    status: "acknowledged" | "degraded";
}
export interface NarrativeStateStore {
    updateNarrativeState(input: NarrativeStateUpdate): Promise<NarrativeStateWriteAck>;
    loadNarrativeState(narrativeId?: string): Promise<NarrativeState | null>;
}
export declare function createNarrativeStateStore(database: StateDatabase): NarrativeStateStore;
