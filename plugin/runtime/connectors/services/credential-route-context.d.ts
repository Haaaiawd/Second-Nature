/**
 * Bridge CredentialVault → RouteContextPort for connector route planning.
 *
 * Loads decrypted credentials from state DB and maps them to the
 * CredentialContext shape expected by ConnectorRoutePlanner.
 * Cooldown is stubbed (always unblocked) until a cooldown ledger is modeled.
 */
import type { RouteContextPort } from "../base/contract.js";
import type { CredentialVault } from "../../storage/services/credential-vault.js";
export declare function createCredentialRouteContextPort(vault: CredentialVault): RouteContextPort;
