import type { ActionBridge, PolicyWriteInput } from "../action-bridge.js";

export interface CliResult<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requiredUserInput?: string[];
    nextStep?: string;
  };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function policySet(
  bridge: ActionBridge,
  input?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const platformId = typeof input?.platformId === "string" ? input.platformId.trim() : "";
  const socialDailyLimit = toNumber(input?.socialDailyLimit);
  const quietEnabled = typeof input?.quietEnabled === "boolean" ? input.quietEnabled : undefined;

  const requiredUserInput: string[] = [];
  if (!platformId) requiredUserInput.push("platform_id");
  if (socialDailyLimit === undefined) requiredUserInput.push("social_daily_limit");
  if (quietEnabled === undefined) requiredUserInput.push("quiet_enabled");

  if (requiredUserInput.length > 0) {
    return {
      ok: false,
      error: {
        code: "MISSING_POLICY_FIELDS",
        message: "policy set requires complete non-interactive fields",
        requiredUserInput,
        nextStep: "reinvoke_policy_set_with_required_fields",
      },
    };
  }

  const payload: PolicyWriteInput = {
    platformId,
    socialDailyLimit: socialDailyLimit as number,
    quietEnabled: quietEnabled as boolean,
  };

  await bridge.savePolicy(payload);
  return {
    ok: true,
    data: { platformId },
  };
}
