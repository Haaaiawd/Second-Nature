import type { ActionBridge } from "../action-bridge.js";
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
export declare function policySet(bridge: ActionBridge, input?: Record<string, unknown>): Promise<Record<string, unknown>>;
