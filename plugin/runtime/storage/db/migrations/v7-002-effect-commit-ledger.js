/**
 * v7-002 Effect Commit Ledger migration — adds effect_commit_ledger table
 * for idempotency-backed side-effect persistence (T-CS.C.2).
 *
 * Dependencies: v7-001 (tables already exist).
 */
export const V7_002_EFFECT_COMMIT_LEDGER = {
    version: 2,
    label: "v7-effect-commit-ledger",
    sql: `
    CREATE TABLE IF NOT EXISTS effect_commit_ledger (
      commit_id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      decision_id TEXT NOT NULL,
      intent_id TEXT NOT NULL,
      effect_class TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      outcome_ref TEXT,
      created_at TEXT NOT NULL,
      committed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS effect_commit_ledger_idempotency_idx
      ON effect_commit_ledger(idempotency_key);
    CREATE INDEX IF NOT EXISTS effect_commit_ledger_decision_idx
      ON effect_commit_ledger(decision_id);
  `,
};
