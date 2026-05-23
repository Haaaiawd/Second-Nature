/**
 * v7-003 Circuit Breaker migration — adds circuit_breaker_state table.
 *
 * Dependencies: v7-002 (effect_commit_ledger already exists).
 */
export const V7_003_CIRCUIT_BREAKER = {
    version: 3,
    label: "v7-circuit-breaker-state",
    sql: `
    CREATE TABLE IF NOT EXISTS circuit_breaker_state (
      platform_id TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'closed',
      failure_count INTEGER NOT NULL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_failure_at TEXT,
      opened_at TEXT,
      last_probe_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (platform_id, capability_id)
    );
    CREATE INDEX IF NOT EXISTS circuit_breaker_state_open_idx
      ON circuit_breaker_state(state)
      WHERE state = 'open';
  `,
};
