import type { StateDatabase } from "../db/index.js";
import type { DeliveryAttemptRecord } from "./types.js";
export declare function listDeliveryAttemptsByDecisionId(state: StateDatabase, decisionId: string): Promise<DeliveryAttemptRecord[]>;
