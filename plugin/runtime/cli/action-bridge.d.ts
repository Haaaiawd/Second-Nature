import type { StateAPI } from "../storage/state-api.js";
export interface PolicyWriteInput {
    platformId: string;
    socialDailyLimit: number;
    quietEnabled: boolean;
}
export interface ActionBridge {
    savePolicy(input: PolicyWriteInput): Promise<void>;
    verifyCredential(platformId: string, answer: string): Promise<void>;
}
export declare function createActionBridge(stateApi: StateAPI): ActionBridge;
