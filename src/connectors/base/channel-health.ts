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

export class ChannelHealthStore {
  private readonly byKey = new Map<string, ChannelHealthSnapshot>();
  private readonly attempts = new Map<string, AttemptContext>();

  upsert(snapshot: ChannelHealthSnapshot): void {
    const key = this.key(snapshot.platformId, snapshot.channel);
    this.byKey.set(key, snapshot);
  }

  get(platformId: string, channel: ChannelType): ChannelHealthSnapshot | undefined {
    return this.byKey.get(this.key(platformId, channel));
  }

  markAttempt(context: AttemptContext): void {
    this.attempts.set(context.traceId, context);
  }

  getAttempt(traceId: string): AttemptContext | undefined {
    return this.attempts.get(traceId);
  }

  clearAttempt(traceId: string): void {
    this.attempts.delete(traceId);
  }

  private key(platformId: string, channel: ChannelType): string {
    return `${platformId}::${channel}`;
  }
}
