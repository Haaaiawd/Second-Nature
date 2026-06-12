/**
 * ConnectorCooldownPort — Durable cooldown ledger for repeated terminal failures.
 *
 * Core logic: Track terminal failures per platform/capability and block replay
 * for a bounded window after repeated failures. Successful recovery is allowed
 * to bypass stale cooldown.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/connector-system.md §6`
 * - `.anws/v8/04_SYSTEM_DESIGN/body-tool-system.md §4`
 *
 * Dependencies:
 * - `src/storage/v8-state-stores.js` (read/write connector cooldown state)
 * - `src/connectors/base/failure-taxonomy.js` (FailureClass, retryable lookup)
 *
 * Boundary:
 * - Does not execute connectors; only records/read cooldown state.
 * - Does not permanently blacklist platforms; cooldown expires.
 */
import type { StateDatabase } from "../../storage/db/index.js";
import type { CooldownPort } from "../base/policy-layer.js";
export declare function createConnectorCooldownPort(db: StateDatabase): CooldownPort;
