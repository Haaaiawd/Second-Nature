/**
 * v7-004 Behavior Promotion migration — adds behavior_promotion table.
 *
 * Dependencies: v7-003 (circuit_breaker_state already exists).
 */
export const V7_004_BEHAVIOR_PROMOTION = {
    version: 4,
    label: "v7-behavior-promotion",
    sql: `
    CREATE TABLE IF NOT EXISTS behavior_promotion (
      promotion_id TEXT PRIMARY KEY,
      behavior_kind TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      operator_id TEXT,
      reject_reason TEXT,
      submitted_at TEXT NOT NULL,
      decided_at TEXT,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS behavior_promotion_status_idx
      ON behavior_promotion(status);
    CREATE INDEX IF NOT EXISTS behavior_promotion_expires_idx
      ON behavior_promotion(expires_at);
  `,
};
