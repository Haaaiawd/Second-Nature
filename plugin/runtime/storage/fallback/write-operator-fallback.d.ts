import type { StateDatabase } from "../db/index.js";
import type { OperatorFallbackWrite } from "./operator-fallback-types.js";
export interface OperatorFallbackAck {
    fallbackRef: string;
}
export declare function writeOperatorFallback(state: StateDatabase, input: OperatorFallbackWrite): Promise<OperatorFallbackAck>;
