export type EffectClass = "external_platform_action" | "connector_action" | "memory_curation" | "narrative_reflection" | "user_outreach" | "maintenance" | "no_effect";
export interface LeaseHandle {
    id: string;
    granted: boolean;
    scope: string;
    release(): Promise<void>;
}
export declare class LeaseManager {
    private readonly ttlMs;
    private readonly leases;
    constructor(ttlMs?: number);
    acquire(effectClass: EffectClass, scopeHint?: string): Promise<LeaseHandle>;
    private resolveScope;
}
