import type { CapabilityIntent, ChannelType } from "./contract.js";
export interface ChannelHealthSnapshot {
    platformId: string;
    channel: ChannelType;
    healthy: boolean;
    degraded: boolean;
    lastFailureAt?: string;
    failureClass?: string;
    retryAfterMs?: number;
    updatedAt: string;
}
export interface AttemptContext {
    traceId: string;
    platformId: string;
    intent: CapabilityIntent;
    channel: ChannelType;
    startedAt: string;
    idempotencyKey?: string;
}
export declare class ChannelHealthStore {
    private readonly byKey;
    private readonly attempts;
    upsert(snapshot: ChannelHealthSnapshot): void;
    get(platformId: string, channel: ChannelType): ChannelHealthSnapshot | undefined;
    markAttempt(context: AttemptContext): void;
    getAttempt(traceId: string): AttemptContext | undefined;
    clearAttempt(traceId: string): void;
    private key;
}
