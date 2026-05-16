import type { StateDatabase } from "../db/index.js";
export interface SourceRef {
    sourceId: string;
    kind: string;
    url?: string;
    snippet?: string;
}
export interface CanonicalMemoryEntry {
    entryId: string;
    kind: string;
    summary: string;
    sourceRefs: SourceRef[];
    createdAt: string;
}
export interface DreamInsight {
    id: string;
    type: "pattern" | "learning" | "observation" | "conflict";
    summary: string;
    sourceRefs: string[];
    confidence: number;
}
export interface MemoryStoreValidation {
    passed: boolean;
    summary: string;
    checkedAt: string;
    unsupportedClaims?: string[];
    redactionIssues?: string[];
}
export interface MemoryStore {
    memoryStoreId: string;
    lifecycleStatus: "candidate" | "accepted" | "archived" | "partial" | "superseded";
    createdAt: string;
    inputMemoryStoreId?: string;
    dreamRunId?: string;
    canonicalEntries: CanonicalMemoryEntry[];
    insights: DreamInsight[];
    narrativeSnapshot?: Record<string, unknown>;
    relationshipSnapshot?: Record<string, unknown>;
    validation: MemoryStoreValidation;
}
export interface MemoryStoreWrite {
    memoryStoreId: string;
    lifecycleStatus: "candidate" | "accepted" | "archived" | "partial" | "superseded";
    createdAt: string;
    inputMemoryStoreId?: string;
    dreamRunId?: string;
    canonicalEntries: CanonicalMemoryEntry[];
    insights: DreamInsight[];
    narrativeSnapshot?: Record<string, unknown>;
    relationshipSnapshot?: Record<string, unknown>;
    validation: MemoryStoreValidation;
}
export interface MemoryStoreLifecycleTransition {
    memoryStoreId: string;
    newStatus: "candidate" | "accepted" | "archived" | "partial" | "superseded";
    validation?: MemoryStoreValidation;
    updatedAt: string;
}
export interface MemoryStoreAck {
    memoryStoreId: string;
    status: "acknowledged" | "degraded";
}
export interface MemoryStorePort {
    writeMemoryStore(output: MemoryStoreWrite): Promise<MemoryStoreAck>;
    loadMemoryStore(memoryStoreId: string): Promise<MemoryStore | null>;
    transitionMemoryStoreLifecycle(input: MemoryStoreLifecycleTransition): Promise<MemoryStoreAck>;
    loadAcceptedMemoryProjection(): Promise<MemoryStore | null>;
    listMemoryStoresByStatus(status: MemoryStore["lifecycleStatus"]): Promise<MemoryStore[]>;
}
export declare function createMemoryStoreLifecycle(database: StateDatabase): MemoryStorePort;
