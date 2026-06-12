/**
 * Bridge CredentialVault → RouteContextPort for connector route planning.
 *
 * Loads decrypted credentials from state DB and maps them to the
 * CredentialContext shape expected by ConnectorRoutePlanner.
 * Cooldown state is loaded from connector_cooldown_state table.
 */
import type { RouteContextPort } from "../base/contract.js";
import type { CredentialVault } from "../../storage/services/credential-vault.js";
import type { CredentialContext } from "../../shared/types/credential.js";
import type { StateDatabase } from "../../storage/db/index.js";
import { readConnectorCooldownState } from "../../storage/v8-state-stores.js";

export function createCredentialRouteContextPort(
  vault: CredentialVault,
  db: StateDatabase,
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
    async loadCooldownState(platformId: string, intent: string) {
      const read = await readConnectorCooldownState(db, platformId, intent);
      if (read.degraded || !read.row) {
        return { blocked: false as const };
      }
      const now = new Date().toISOString();
      const blocked = new Date(read.row.blockedUntil).getTime() > new Date(now).getTime();
      return {
        blocked,
        retryAfterMs: blocked
          ? Math.max(0, new Date(read.row.blockedUntil).getTime() - new Date(now).getTime())
          : undefined,
      };
    },
  };
}
