/**
 * v7-001 Foundation migration — adds v7 entity tables and _meta tracking.
 *
 * Tables added:
 * - identity_profile, tool_experience, daily_diary_index,
 *   dream_output_index, capability_probe_result, restore_snapshot,
 *   runtime_secret_anchor, heartbeat_digest, narrative_timeline
 * - agent_goal v7 extensions (scope, expires_at columns)
 *
 * All new columns use DEFAULT NULL for backward compatibility.
 */
export const V7_001_FOUNDATION = {
    version: 1,
    label: "v7-foundation-tables",
    sql: `
    -- identity_profile (ADR-007)
    CREATE TABLE IF NOT EXISTS identity_profile (
      profile_id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      canonical_avatar TEXT,
      canonical_bio TEXT,
      platform_handles_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    -- tool_experience (ADR-003)
    CREATE TABLE IF NOT EXISTS tool_experience (
      experience_id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      failure_class TEXT,
      latency_ms INTEGER NOT NULL,
      evidence_quality REAL NOT NULL DEFAULT 0,
      source_refs_json TEXT NOT NULL,
      trigger_source TEXT NOT NULL DEFAULT 'heartbeat',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tool_experience_connector_idx
      ON tool_experience(connector_id);
    CREATE INDEX IF NOT EXISTS tool_experience_outcome_idx
      ON tool_experience(outcome);
    CREATE INDEX IF NOT EXISTS tool_experience_created_at_idx
      ON tool_experience(created_at);

    -- daily_diary_index (ADR-005)
    CREATE TABLE IF NOT EXISTS daily_diary_index (
      diary_id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      observed_today_json TEXT NOT NULL DEFAULT '[]',
      notable_signals_json TEXT NOT NULL DEFAULT '[]',
      tomorrow_direction TEXT NOT NULL DEFAULT '',
      source_refs_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS daily_diary_index_day_idx
      ON daily_diary_index(day);

    -- dream_output_index (ADR-005)
    CREATE TABLE IF NOT EXISTS dream_output_index (
      output_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      canonical_entries_json TEXT NOT NULL DEFAULT '[]',
      insights_json TEXT NOT NULL DEFAULT '[]',
      narrative_update_json TEXT,
      relationship_update_json TEXT,
      validation_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS dream_output_index_run_idx
      ON dream_output_index(run_id);
    CREATE INDEX IF NOT EXISTS dream_output_index_status_idx
      ON dream_output_index(status);

    -- capability_probe_result (ADR-008)
    CREATE TABLE IF NOT EXISTS capability_probe_result (
      probe_result_id TEXT PRIMARY KEY,
      capability_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      actual_status TEXT NOT NULL,
      http_status INTEGER,
      sample_response_ref TEXT,
      probe_config_ref TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS capability_probe_result_connector_idx
      ON capability_probe_result(connector_id);

    -- restore_snapshot (ADR-007, DR-017)
    CREATE TABLE IF NOT EXISTS restore_snapshot (
      snapshot_id TEXT PRIMARY KEY,
      entity_whitelist_json TEXT NOT NULL,
      excluded_sensitive_kinds_json TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS restore_snapshot_captured_at_idx
      ON restore_snapshot(captured_at);

    -- runtime_secret_anchor (ADR-007)
    CREATE TABLE IF NOT EXISTS runtime_secret_anchor (
      anchor_id TEXT PRIMARY KEY,
      location_ref TEXT NOT NULL,
      health TEXT NOT NULL DEFAULT 'missing',
      rotation_policy_ref TEXT,
      updated_at TEXT NOT NULL
    );

    -- heartbeat_digest (ADR-006)
    CREATE TABLE IF NOT EXISTS heartbeat_digest (
      digest_id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      connector_summary_json TEXT NOT NULL DEFAULT '[]',
      goal_summary_json TEXT NOT NULL DEFAULT '[]',
      quiet_count INTEGER NOT NULL DEFAULT 0,
      dream_count INTEGER NOT NULL DEFAULT 0,
      breaker_summary_json TEXT NOT NULL DEFAULT '[]',
      health_status TEXT NOT NULL DEFAULT 'ok',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS heartbeat_digest_day_idx
      ON heartbeat_digest(day);

    -- narrative_timeline (ADR-007)
    CREATE TABLE IF NOT EXISTS narrative_timeline (
      timeline_id TEXT PRIMARY KEY,
      entry_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      delta_json TEXT NOT NULL DEFAULT '{}',
      previous_hash TEXT NOT NULL DEFAULT '',
      current_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS narrative_timeline_subject_idx
      ON narrative_timeline(subject_id);
    CREATE INDEX IF NOT EXISTS narrative_timeline_created_at_idx
      ON narrative_timeline(created_at);

    -- agent_goal v7 extensions: scope and expires_at
    ALTER TABLE agent_goal ADD COLUMN scope TEXT DEFAULT NULL;
    ALTER TABLE agent_goal ADD COLUMN expires_at TEXT DEFAULT NULL;
  `,
};
