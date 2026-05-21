/**
 * Bridge CredentialVault → RouteContextPort for connector route planning.
 *
 * Loads decrypted credentials from state DB and maps them to the
 * CredentialContext shape expected by ConnectorRoutePlanner.
 * Cooldown is stubbed (always unblocked) until a cooldown ledger is modeled.
 */
import type { RouteContextPort } from "../base/contract.js";
import type { CredentialVault } from "../../storage/services/credential-vault.js";
import type { CredentialContext } from "../../shared/types/credential.js";

export function createCredentialRouteContextPort(
  vault: CredentialVault,
): RouteContextPort {
  return {
    async loadCredentialState(platformId: string): Promise<CredentialContext> {
      const ctx = await vault.loadCredentialContext(platformId);
      // Defensive: some ORM findFirst variants return {} instead of null/undefined.
      if (!ctx || !ctx.platformId || !ctx.status) {
        return {
          platformId,
          status: "missing",
          credentialType: "api_key",
        };
      }
      return ctx;
    },
    async loadCooldownState() {
      return { blocked: false as const };
    },
  };
}
