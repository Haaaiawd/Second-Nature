export const FAILURE_CLASSES = [
  "transport_failure",
  "auth_failure",
  "credential_expired",
  "verification_required",
  "rate_limited",
  "cooldown_blocked",
  "parse_failure",
  "protocol_mismatch",
  "semantic_rejection",
  "idempotency_conflict",
  "concurrency_conflict",
  "permanent_input_error",
  "unknown_platform_change",
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

export interface FailureClassification {
  class: FailureClass;
  retryable: boolean;
  retryAfterMs?: number;
}

const RETRYABLE_BY_CLASS: Record<FailureClass, boolean> = {
  transport_failure: true,
  auth_failure: false,
  credential_expired: false,
  verification_required: false,
  rate_limited: true,
  cooldown_blocked: false,
  parse_failure: false,
  protocol_mismatch: false,
  semantic_rejection: false,
  idempotency_conflict: false,
  concurrency_conflict: true,
  permanent_input_error: false,
  unknown_platform_change: false,
};

export class ConnectorPolicyError extends Error {
  constructor(
    public readonly failureClass: FailureClass,
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "ConnectorPolicyError";
  }
}

function readRetryAfterMs(input: Record<string, unknown>): number | undefined {
  const retryAfterMs = input.retryAfterMs;
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return retryAfterMs;
  }

  const retryAfterSeconds = input.retryAfterSeconds;
  if (typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return undefined;
}

export function classifyFailure(error: unknown): FailureClassification {
  if (error instanceof ConnectorPolicyError) {
    return {
      class: error.failureClass,
      retryable: RETRYABLE_BY_CLASS[error.failureClass],
      retryAfterMs: error.retryAfterMs,
    };
  }

  if (error instanceof SyntaxError) {
    return { class: "parse_failure", retryable: false };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    const code = record.code;
    if (typeof code === "string") {
      if (code === "verification_required") return { class: "verification_required", retryable: RETRYABLE_BY_CLASS.verification_required };
      if (code === "credential_expired") return { class: "credential_expired", retryable: RETRYABLE_BY_CLASS.credential_expired };
      if (code === "cooldown_blocked") return { class: "cooldown_blocked", retryable: RETRYABLE_BY_CLASS.cooldown_blocked };
      if (code === "idempotency_conflict") return { class: "idempotency_conflict", retryable: RETRYABLE_BY_CLASS.idempotency_conflict };
      if (code === "concurrency_conflict") return { class: "concurrency_conflict", retryable: RETRYABLE_BY_CLASS.concurrency_conflict };
      if (code === "protocol_mismatch") return { class: "protocol_mismatch", retryable: RETRYABLE_BY_CLASS.protocol_mismatch };
      if (code === "semantic_rejection") return { class: "semantic_rejection", retryable: RETRYABLE_BY_CLASS.semantic_rejection };
      if (code === "transport_failure") return { class: "transport_failure", retryable: RETRYABLE_BY_CLASS.transport_failure };
      if (code === "permanent_input_error") return { class: "permanent_input_error", retryable: RETRYABLE_BY_CLASS.permanent_input_error };
    }

    const status = record.status;
    if (status === 429) {
      return {
        class: "rate_limited",
        retryable: RETRYABLE_BY_CLASS.rate_limited,
        retryAfterMs: readRetryAfterMs(record),
      };
    }
    if (status === 401 || status === 403) {
      return { class: "auth_failure", retryable: RETRYABLE_BY_CLASS.auth_failure };
    }
    if (status === 400 || status === 404 || status === 422) {
      return { class: "permanent_input_error", retryable: RETRYABLE_BY_CLASS.permanent_input_error };
    }
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      return { class: "transport_failure", retryable: RETRYABLE_BY_CLASS.transport_failure };
    }
  }

  return { class: "unknown_platform_change", retryable: RETRYABLE_BY_CLASS.unknown_platform_change };
}
