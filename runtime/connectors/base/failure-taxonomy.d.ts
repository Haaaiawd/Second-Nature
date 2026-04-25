export declare const FAILURE_CLASSES: readonly ["transport_failure", "auth_failure", "credential_expired", "verification_required", "rate_limited", "cooldown_blocked", "parse_failure", "protocol_mismatch", "semantic_rejection", "idempotency_conflict", "concurrency_conflict", "permanent_input_error", "unknown_platform_change"];
export type FailureClass = (typeof FAILURE_CLASSES)[number];
export interface FailureClassification {
    class: FailureClass;
    retryable: boolean;
    retryAfterMs?: number;
}
export declare class ConnectorPolicyError extends Error {
    readonly failureClass: FailureClass;
    readonly retryAfterMs?: number | undefined;
    constructor(failureClass: FailureClass, message: string, retryAfterMs?: number | undefined);
}
export declare function classifyFailure(error: unknown): FailureClassification;
