/**
 * v9-001 Self Continuity, Character & Procedural Evolution migration.
 *
 * Adds v9 entity tables and extends evidence_item / action_closure_record
 * with v9 identity and linkage columns.
 *
 * Dependencies: v8-005 (single-status schema cleanup).
 */
export const V9_001_SELF_CONTINUITY = {
    version: 10,
    label: "v9-self-continuity-character-procedural",
    sql: `
    ALTER TABLE evidence_item ADD COLUMN external_id TEXT;
    ALTER TABLE evidence_item ADD COLUMN stable_identity_key TEXT NOT NULL DEFAULT '';
    ALTER TABLE evidence_item ADD COLUMN first_observed_at TEXT;
    ALTER TABLE evidence_item ADD COLUMN last_observed_at TEXT;
    ALTER TABLE evidence_item ADD COLUMN seen_count INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE evidence_item ADD COLUMN row_identity_status TEXT NOT NULL DEFAULT 'stable';
    CREATE INDEX IF NOT EXISTS evidence_item_stable_identity_idx ON evidence_item(stable_identity_key);
    CREATE INDEX IF NOT EXISTS evidence_item_last_observed_status_idx ON evidence_item(last_observed_at, row_identity_status);

    ALTER TABLE action_closure_record ADD COLUMN routine_id TEXT;
    ALTER TABLE action_closure_record ADD COLUMN activity_thread_id TEXT;
    ALTER TABLE action_closure_record ADD COLUMN activity_step_id TEXT;

    CREATE TABLE IF NOT EXISTS attention_signal (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      cycle_id TEXT NOT NULL,
      evidence_refs_json TEXT,
      novelty REAL NOT NULL DEFAULT 0,
      relevance REAL NOT NULL DEFAULT 0,
      repetition TEXT NOT NULL,
      risk_flags_json TEXT,
      possible_actions_json TEXT,
      source_refs_json TEXT NOT NULL,
      status TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      activity_thread_id TEXT,
      thread_suggestion TEXT
    );
    CREATE INDEX IF NOT EXISTS attention_signal_cycle_id_idx ON attention_signal(cycle_id);
    CREATE INDEX IF NOT EXISTS attention_signal_thread_idx ON attention_signal(activity_thread_id);

    CREATE TABLE IF NOT EXISTS activity_thread (
      id TEXT PRIMARY KEY,
      origin_attention_signal_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_focus TEXT NOT NULL,
      associations_json TEXT,
      next_possible_moves_json TEXT,
      completed_step_count INTEGER NOT NULL DEFAULT 0,
      last_step_kind TEXT,
      blocker_reason TEXT,
      stop_condition TEXT NOT NULL,
      last_heartbeat_sequence INTEGER NOT NULL,
      source_refs_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activity_thread_status_updated_at_idx ON activity_thread(status, updated_at);
    CREATE INDEX IF NOT EXISTS activity_thread_origin_attention_idx ON activity_thread(origin_attention_signal_id);
    CREATE INDEX IF NOT EXISTS activity_thread_heartbeat_seq_idx ON activity_thread(last_heartbeat_sequence);

    CREATE TABLE IF NOT EXISTS activity_step (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      cycle_id TEXT NOT NULL,
      step_kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      source_refs_json TEXT NOT NULL,
      closure_ref_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activity_step_thread_created_at_idx ON activity_step(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS activity_step_cycle_id_idx ON activity_step(cycle_id);

    CREATE TABLE IF NOT EXISTS procedural_projection (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      capability_pattern TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      source_refs_json TEXT NOT NULL,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS procedural_projection_capability_status_idx ON procedural_projection(capability_pattern, status);

    CREATE TABLE IF NOT EXISTS tool_routine (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      capability_pattern TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      source_refs_json TEXT NOT NULL,
      rollback_ref TEXT,
      guard_refs_json TEXT,
      ledger_ref TEXT,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT,
      activated_at TEXT,
      retired_at TEXT
    );
    CREATE INDEX IF NOT EXISTS tool_routine_status_idx ON tool_routine(status);
    CREATE INDEX IF NOT EXISTS tool_routine_capability_idx ON tool_routine(capability_pattern);

    CREATE TABLE IF NOT EXISTS self_continuity_card (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      card_text TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      source_refs_json TEXT NOT NULL,
      character_frame_pointer_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS self_continuity_card_status_idx ON self_continuity_card(status);

    CREATE TABLE IF NOT EXISTS character_frame (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      sections_json TEXT NOT NULL,
      contest_prompt TEXT NOT NULL,
      source_refs_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      superseded_by TEXT,
      revision_of TEXT,
      accepted_at TEXT,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS character_frame_status_idx ON character_frame(status);

    CREATE TABLE IF NOT EXISTS connector_evolution_plan (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposed',
      gate_results_json TEXT,
      previous_stable_ref TEXT,
      rollback_command_hint TEXT,
      source_refs_json TEXT NOT NULL,
      ledger_ref TEXT,
      redaction_class TEXT NOT NULL DEFAULT 'none',
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS connector_evolution_plan_platform_status_idx ON connector_evolution_plan(platform_id, status);

    CREATE TABLE IF NOT EXISTS connector_version (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      sequence INTEGER,
      asset_paths_json TEXT,
      declared_capabilities_json TEXT,
      status TEXT NOT NULL DEFAULT 'candidate',
      previous_stable_ref TEXT,
      rollback_ref TEXT,
      rollback_command_hint TEXT,
      source_refs_json TEXT NOT NULL,
      payload_json TEXT,
      activated_at TEXT,
      rolled_back_at TEXT
    );
    CREATE INDEX IF NOT EXISTS connector_version_platform_version_idx ON connector_version(platform_id, version_id);
    CREATE INDEX IF NOT EXISTS connector_version_status_idx ON connector_version(status);

    CREATE TABLE IF NOT EXISTS autonomous_change_ledger (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      workspace_root TEXT NOT NULL,
      change_kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      previous_stable_ref TEXT,
      status TEXT NOT NULL DEFAULT 'proposed',
      gate_results_json TEXT,
      rollback_ref TEXT,
      rollback_command_hint TEXT,
      source_refs_json TEXT NOT NULL,
      redacted_payload_json TEXT,
      activated_at TEXT,
      rolled_back_at TEXT
    );
    CREATE INDEX IF NOT EXISTS autonomous_change_ledger_target_status_idx ON autonomous_change_ledger(target_id, status);
    CREATE INDEX IF NOT EXISTS autonomous_change_ledger_change_kind_idx ON autonomous_change_ledger(change_kind);

    CREATE TABLE IF NOT EXISTS routine_execution_trace (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      routine_id TEXT NOT NULL,
      cycle_id TEXT NOT NULL,
      status TEXT NOT NULL,
      source_refs_json TEXT NOT NULL,
      proof_refs_json TEXT,
      trace_refs_json TEXT,
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS routine_execution_trace_routine_idx ON routine_execution_trace(routine_id);
    CREATE INDEX IF NOT EXISTS routine_execution_trace_cycle_idx ON routine_execution_trace(cycle_id);
  `,
};
