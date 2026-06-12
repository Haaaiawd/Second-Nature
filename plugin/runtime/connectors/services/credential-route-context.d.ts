/**
 * Bridge CredentialVault → RouteContextPort for connector route planning.
 *
 * Loads decrypted credentials from state DB and maps them to the
 * CredentialContext shape expected by ConnectorRoutePlanner.
 * Cooldown state is loaded from connector_cooldown_state table.
 */
import type { RouteContextPort } from "../base/contract.js";
import type { CredentialVault } from "../../storage/services/credential-vault.js";
import type { StateDatabase } from "../../storage/db/index.js";
export declare function createCredentialRouteContextPort(vault: CredentialVault, db: StateDatabase): RouteContextPort;
