/**
 * Persists delivery attempts with state-system validation (T4.3.1).
 */
import type { StateDatabase } from "../db/index.js";
import type { DeliveryAttemptAck, DeliveryAttemptWrite } from "./types.js";
export declare function writeDeliveryAttempt(state: StateDatabase, attempt: DeliveryAttemptWrite): Promise<DeliveryAttemptAck>;
