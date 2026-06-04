/**
 * v8-001 Living Perception Loop migration — adds v8 entity tables.
 *
 * Dependencies: v7-004 (behavior_promotion already exists).
 */
export const V8_001_LIVING_PERCEPTION_LOOP = {
    version: 5,
    label: "v8-living-perception-loop",
    sql: `
    CREATE TABLE IF NOT EXISTS evidence_item (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      sensitivity_hint TEXT,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS perception_card (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      cycle_id TEXT NOT NULL,
      topic TEXT,
      entities_json TEXT,
      novelty TEXT,
      relevance REAL,
      summary TEXT,
      risk_flags_json TEXT,
      confidence REAL,
      review_priority TEXT,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS judgment_verdict (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      cycle_id TEXT NOT NULL,
      perception_card_id TEXT NOT NULL,
      action_kind TEXT NOT NULL,
      confidence REAL,
      reason TEXT,
      risk_posture TEXT,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS action_closure_record (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      cycle_id TEXT NOT NULL,
      proposal_id TEXT,
      decision_id TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      next_state TEXT,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'closed'
    );
    CREATE TABLE IF NOT EXISTS quiet_daily_review (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      day TEXT NOT NULL,
      closure_count INTEGER NOT NULL DEFAULT 0,
      memory_candidate_count INTEGER NOT NULL DEFAULT 0,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS dream_consolidation_run (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      quiet_review_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS long_term_memory_projection (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      topic_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'candidate'
    );
    CREATE TABLE IF NOT EXISTS heartbeat_cycle_trace (
      id TEXT PRIMARY KEY,
      cycle_sequence INTEGER NOT NULL,
      heartbeat_started_at TEXT NOT NULL,
      heartbeat_completed_at TEXT,
      input_count INTEGER NOT NULL DEFAULT 0,
      output_count INTEGER NOT NULL DEFAULT 0,
      expected_downstream_by_cycle INTEGER,
      status TEXT NOT NULL,
      source_refs_json TEXT,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'started'
    );
    CREATE TABLE IF NOT EXISTS loop_stage_event (
      id TEXT PRIMARY KEY,
      cycle_id TEXT NOT NULL,
      cycle_sequence INTEGER NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      occurred_at TEXT NOT NULL,
      expected_downstream_by_cycle INTEGER,
      payload_json TEXT,
      lifecycle_status TEXT NOT NULL DEFAULT 'started'
    );
  `,
};
