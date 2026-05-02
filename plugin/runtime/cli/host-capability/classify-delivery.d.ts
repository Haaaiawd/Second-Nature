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
export declare function classifyDeliveryCapability(input: ClassifyDeliveryCapabilityInput): DeliveryCapabilityStatus;
