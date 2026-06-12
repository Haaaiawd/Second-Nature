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
import {
  readConnectorCooldownState,
  writeConnectorCooldownState,
} from "../../storage/v8-state-stores.js";
import type { CooldownPort } from "../base/policy-layer.js";
import type { CapabilityIntent } from "../base/contract.js";
import type { FailureClass } from "../base/failure-taxonomy.js";

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const TERMINAL_FAILURE_THRESHOLD = 2;

const RETRYABLE_FAILURE_CLASSES: ReadonlySet<FailureClass> = new Set([
  "transport_failure",
  "rate_limited",
  "timeout",
  "concurrency_conflict",
]);

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function makeCooldownId(platformId: string, capabilityId: string): string {
  return `cooldown_${platformId}_${capabilityId}`;
}

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function isAfter(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function createConnectorCooldownPort(db: StateDatabase): CooldownPort {
  return {
    async isBlocked(platformId: string, intent: CapabilityIntent) {
      const read = await readConnectorCooldownState(db, platformId, intent);
      if (read.degraded) {
        // Fail-closed: if we cannot read cooldown state, prevent replay to avoid hammering
        return {
          blocked: true,
          reason: "cooldown_state_unreadable",
        };
      }
      if (!read.row) {
        return { blocked: false };
      }
      const now = new Date().toISOString();
      const blocked = isAfter(read.row.blockedUntil, now);
      return {
        blocked,
        retryAfterMs: blocked
          ? Math.max(0, new Date(read.row.blockedUntil).getTime() - new Date(now).getTime())
          : undefined,
      };
    },

    async markFailure(
      platformId: string,
      intent: CapabilityIntent,
      failureClass: FailureClass,
      retryAfterMs?: number,
    ) {
      const id = makeCooldownId(platformId, intent);
      const now = new Date().toISOString();
      const existing = await readConnectorCooldownState(db, platformId, intent);

      const isRetryable = RETRYABLE_FAILURE_CLASSES.has(failureClass);

      let failureCount = 1;
      let terminalCount = isRetryable ? 0 : 1;
      let blockedUntil = now;

      if (!existing.degraded && existing.row) {
        failureCount = existing.row.failureCount + 1;
        terminalCount = (existing.row.terminalCount ?? 0) + (isRetryable ? 0 : 1);
        // Extend blocked window if already blocked
        if (isAfter(existing.row.blockedUntil, now)) {
          blockedUntil = existing.row.blockedUntil;
        }
      }

      if (retryAfterMs && retryAfterMs > 0) {
        // Rate-limit or explicit retry-after takes precedence
        blockedUntil = addMs(now, retryAfterMs);
      } else if (!isRetryable && terminalCount >= TERMINAL_FAILURE_THRESHOLD) {
        // Repeated terminal failures enter bounded cooldown
        blockedUntil = addMs(now, DEFAULT_COOLDOWN_MS);
      } else if (isRetryable) {
        // Retryable failures do not accumulate terminal cooldown
        blockedUntil = now;
      }

      await writeConnectorCooldownState(db, {
        id,
        platformId,
        capabilityId: intent,
        failureClass,
        retryAfterMs: retryAfterMs ?? null,
        blockedUntil,
        failureCount,
        terminalCount,
        sourceRefs: [
          {
            uri: `sn://cooldown/${platformId}/${intent}`,
            family: "audit",
            id,
            redactionClass: "none",
            resolveStatus: "resolvable",
          },
        ],
        payloadJson: JSON.stringify({ markedAt: now, failureCount, terminalCount, isRetryable }),
        createdAt: existing.row?.createdAt ?? now,
        updatedAt: now,
        redactionClass: "none",
      });
    },
  };
}
