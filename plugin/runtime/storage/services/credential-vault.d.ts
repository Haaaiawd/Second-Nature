import type { StateDatabase } from "../db/index.js";
import type { CredentialContextWrite, CredentialContext, CredentialState } from "../../shared/types/index.js";
export interface CredentialVault {
    saveCredentialContext(input: CredentialContextWrite): Promise<void>;
    loadCredentialContext(platformId: string): Promise<CredentialContext | null>;
    getCredentialState(platformId: string): Promise<CredentialState>;
}
export declare function createCredentialVault(db: StateDatabase["db"]): CredentialVault;
