/**
 * Normalizes host-reported delivery signals into DeliveryCapabilityStatus (cli-system).
 */
import type { DeliveryCapabilityStatus } from "./types.js";

export interface ClassifyDeliveryCapabilityInput {
  /** Host-reported delivery channel / target hint */
  rawTarget?: string | null;
  channel?: string | null;
  /** When false, host API for delivery is not reachable */
  apiAvailable?: boolean;
  /** When true, host explicitly reports unsupported delivery surface */
  hostUnsupported?: boolean;
}

export function classifyDeliveryCapability(input: ClassifyDeliveryCapabilityInput): DeliveryCapabilityStatus {
  if (input.hostUnsupported) {
    return "host_unsupported";
  }
  if (input.apiAvailable === false) {
    return "host_api_unavailable";
  }
  const target = (input.rawTarget ?? "").trim().toLowerCase();
  if (target === "none" || target === "") {
    return "target_none";
  }
  const ch = (input.channel ?? "").trim();
  if (!ch) {
    return "channel_missing";
  }
  if (target === "unknown" || target === "unspecified") {
    return "unknown";
  }
  return "target_available";
}
