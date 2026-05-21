/**
 * T4.2.1 — Owner reply ingestion and RelationshipMemory feedback loop.
 *
 * When an owner replies to an outreach, this function:
 * 1. Appends a `SessionChronicle` entry with the reply context.
 * 2. Loads the current `RelationshipMemory`.
 * 3. Infers tone/timing/topic from the reply text and updates the memory.
 * 4. Persists the updated `RelationshipMemory` with source refs pointing to the chronicle entry.
 *
 * Boundaries:
 * - Does NOT generate outreach drafts; that is the guidance layer's job.
 * - Does NOT execute connectors; this is a pure state update path.
 * - Errors in relationship update must not break chronicle write (chronicle is source of truth).
 */
import type { StateDatabase } from "../../../storage/db/index.js";
import { type OwnerReplySignal } from "../../../storage/chronicle/session-chronicle-store.js";
import { type RelationshipMemory, type TopicAffinity } from "../../../storage/relationship/relationship-memory-store.js";
export interface ReplyInferenceConfig {
    positiveKeywords?: string[];
    negativeKeywords?: string[];
    busyKeywords?: string[];
    topicPatterns?: Record<string, string[]>;
}
export declare function inferTone(text: string, config?: ReplyInferenceConfig): "casual" | "direct" | "quiet" | "unknown";
export declare function inferTiming(text: string, config?: ReplyInferenceConfig): "responsive" | "busy" | undefined;
export declare function inferTopics(text: string, config?: ReplyInferenceConfig): string[];
export declare function mergeTopicAffinities(existing: TopicAffinity[], newTopics: string[]): TopicAffinity[];
export interface ProcessOwnerReplyInput {
    /** The raw reply text from the owner. */
    replyText: string;
    /** The decisionId of the outreach this reply is responding to. */
    relatedDecisionId: string;
    /** Optional explicit owner signal (parsed by host or explicit UI). */
    explicitSignal?: OwnerReplySignal;
}
export interface ProcessOwnerReplyResult {
    chronicleEntryId: string;
    relationshipUpdated: boolean;
    priorMemory?: RelationshipMemory;
    updatedMemory?: RelationshipMemory;
    relationshipUpdateError?: string;
}
/**
 * Process an owner reply: write chronicle, update RelationshipMemory.
 */
export declare function processOwnerReply(input: ProcessOwnerReplyInput, state: StateDatabase): Promise<ProcessOwnerReplyResult>;
