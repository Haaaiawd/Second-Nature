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
      if (read.degraded || !read.row) {
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

      let failureCount = 1;
      let blockedUntil = now;

      if (!existing.degraded && existing.row) {
        failureCount = existing.row.failureCount + 1;
        // Extend blocked window if already blocked
        if (isAfter(existing.row.blockedUntil, now)) {
          blockedUntil = existing.row.blockedUntil;
        }
      }

      const isRetryable = RETRYABLE_FAILURE_CLASSES.has(failureClass);

      if (retryAfterMs && retryAfterMs > 0) {
        // Rate-limit or explicit retry-after takes precedence
        blockedUntil = addMs(now, retryAfterMs);
      } else if (!isRetryable && failureCount >= TERMINAL_FAILURE_THRESHOLD) {
        // Repeated terminal failures enter bounded cooldown
        blockedUntil = addMs(now, DEFAULT_COOLDOWN_MS);
      } else if (isRetryable) {
        // Retryable failures do not accumulate terminal cooldown unless threshold somehow met
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
        sourceRefs: [
          {
            uri: `sn://cooldown/${platformId}/${intent}`,
            family: "audit",
            id,
            redactionClass: "none",
            resolveStatus: "resolvable",
          },
        ],
        payloadJson: JSON.stringify({ markedAt: now, failureCount, isRetryable }),
        createdAt: existing.row?.createdAt ?? now,
        updatedAt: now,
        redactionClass: "none",
      });
    },
  };
}
