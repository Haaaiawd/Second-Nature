import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as schema from "./schema/index.js";
import { runMigrations, getSchemaVersion, setSchemaVersion } from "./migration-runner.js";
import { ALL_MIGRATIONS } from "./migrations/index.js";
// Pre-initialize sql.js WASM at module load time
const SQL = await initSqlJs();
const STATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS credential_records (
    platform_id TEXT PRIMARY KEY,
    credential_type TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    status TEXT NOT NULL,
    verification_code TEXT,
    challenge_text TEXT,
    expires_at TEXT,
    attempts_remaining INTEGER,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS policy_records (
    platform_id TEXT PRIMARY KEY,
    social_daily_limit INTEGER NOT NULL,
    quiet_enabled INTEGER NOT NULL,
    outreach_daily_budget INTEGER NOT NULL DEFAULT 2,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS life_evidence_index (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    sensitivity TEXT NOT NULL,
    producer TEXT NOT NULL,
    artifact_path TEXT NOT NULL,
    platform_id TEXT,
    source_refs_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS asset_registry (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    layer TEXT NOT NULL,
    last_indexed_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS asset_registry_path_idx ON asset_registry(path);
  CREATE TABLE IF NOT EXISTS intent_commit_records (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    decision_id TEXT NOT NULL,
    checkpoint_id TEXT,
    state TEXT NOT NULL,
    outcome_ref TEXT,
    metadata_json TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS proposal_records (
    id TEXT PRIMARY KEY,
    target_asset_id TEXT NOT NULL,
    before_hash TEXT,
    after_hash TEXT,
    status TEXT NOT NULL,
    proposed_diff TEXT NOT NULL,
    reason TEXT NOT NULL,
    supporting_sources TEXT NOT NULL,
    confidence REAL NOT NULL,
    created_at TEXT NOT NULL,
    applied_at TEXT
  );
  CREATE TABLE IF NOT EXISTS provenance_edges (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS delivery_attempts (
    attempt_id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    target TEXT,
    channel TEXT,
    status TEXT NOT NULL,
    message_id TEXT,
    host_proof_ref_json TEXT,
    error_class TEXT,
    fallback_ref TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS delivery_attempt_decision_idx ON delivery_attempts(decision_id);
  CREATE TABLE IF NOT EXISTS operator_fallback_artifacts (
    fallback_ref TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    source_refs_json TEXT NOT NULL,
    candidate_message TEXT,
    next_step TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS operator_fallback_decision_idx ON operator_fallback_artifacts(decision_id);
  CREATE TABLE IF NOT EXISTS session_chronicle (
    entry_id TEXT PRIMARY KEY,
    event_kind TEXT NOT NULL,
    actor TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    result TEXT NOT NULL,
    source_refs_json TEXT NOT NULL,
    related_decision_id TEXT,
    related_dream_run_id TEXT,
    owner_reply_json TEXT
  );
  CREATE INDEX IF NOT EXISTS session_chronicle_event_kind_idx ON session_chronicle(event_kind);
  CREATE INDEX IF NOT EXISTS session_chronicle_occurred_at_idx ON session_chronicle(occurred_at);
  CREATE INDEX IF NOT EXISTS session_chronicle_actor_idx ON session_chronicle(actor);
  CREATE INDEX IF NOT EXISTS session_chronicle_decision_idx ON session_chronicle(related_decision_id);
  CREATE TABLE IF NOT EXISTS narrative_state (
    narrative_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 1,
    focus TEXT NOT NULL,
    progress_json TEXT NOT NULL,
    next_intent TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 0,
    source_refs_json TEXT NOT NULL,
    unsupported_claims_json TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS narrative_state_status_idx ON narrative_state(status);
  CREATE INDEX IF NOT EXISTS narrative_state_updated_at_idx ON narrative_state(updated_at);
  CREATE TABLE IF NOT EXISTS relationship_memory (
    relationship_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 1,
    tone_preference TEXT NOT NULL,
    average_reply_delay_minutes INTEGER,
    no_reply_count INTEGER NOT NULL DEFAULT 0,
    topic_affinities_json TEXT NOT NULL,
    last_interaction_at TEXT,
    source_refs_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS relationship_memory_updated_at_idx ON relationship_memory(updated_at);
  CREATE TABLE IF NOT EXISTS agent_goal (
    goal_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    origin TEXT NOT NULL,
    description TEXT NOT NULL,
    completion_criteria TEXT NOT NULL,
    risk TEXT NOT NULL,
    priority_hint INTEGER NOT NULL DEFAULT 0,
    source_refs_json TEXT NOT NULL,
    accepted_by TEXT,
    scope TEXT DEFAULT NULL,
    expires_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS agent_goal_status_idx ON agent_goal(status);
  CREATE INDEX IF NOT EXISTS agent_goal_origin_idx ON agent_goal(origin);
  CREATE INDEX IF NOT EXISTS agent_goal_updated_at_idx ON agent_goal(updated_at);

  -- v7 foundation tables (mirrors v7-001-foundation migration for fresh DBs)
  CREATE TABLE IF NOT EXISTS identity_profile (
    profile_id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    canonical_avatar TEXT,
    canonical_bio TEXT,
    platform_handles_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );
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
  CREATE INDEX IF NOT EXISTS tool_experience_connector_idx ON tool_experience(connector_id);
  CREATE INDEX IF NOT EXISTS tool_experience_outcome_idx ON tool_experience(outcome);
  CREATE INDEX IF NOT EXISTS tool_experience_created_at_idx ON tool_experience(created_at);
  CREATE TABLE IF NOT EXISTS daily_diary_index (
    diary_id TEXT PRIMARY KEY,
    day TEXT NOT NULL UNIQUE,
    observed_today_json TEXT NOT NULL DEFAULT '[]',
    notable_signals_json TEXT NOT NULL DEFAULT '[]',
    tomorrow_direction TEXT NOT NULL DEFAULT '',
    source_refs_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS daily_diary_index_day_idx ON daily_diary_index(day);
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
  CREATE INDEX IF NOT EXISTS dream_output_index_run_idx ON dream_output_index(run_id);
  CREATE INDEX IF NOT EXISTS dream_output_index_status_idx ON dream_output_index(status);
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
  CREATE INDEX IF NOT EXISTS capability_probe_result_connector_idx ON capability_probe_result(connector_id);
  CREATE TABLE IF NOT EXISTS restore_snapshot (
    snapshot_id TEXT PRIMARY KEY,
    entity_whitelist_json TEXT NOT NULL,
    excluded_sensitive_kinds_json TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS restore_snapshot_captured_at_idx ON restore_snapshot(captured_at);
  CREATE TABLE IF NOT EXISTS runtime_secret_anchor (
    anchor_id TEXT PRIMARY KEY,
    location_ref TEXT NOT NULL,
    health TEXT NOT NULL DEFAULT 'missing',
    rotation_policy_ref TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS heartbeat_digest (
    digest_id TEXT PRIMARY KEY,
    day TEXT NOT NULL UNIQUE,
    connector_summary_json TEXT NOT NULL DEFAULT '[]',
    goal_summary_json TEXT NOT NULL DEFAULT '[]',
    quiet_count INTEGER NOT NULL DEFAULT 0,
    dream_count INTEGER NOT NULL DEFAULT 0,
    breaker_summary_json TEXT NOT NULL DEFAULT '[]',
    health_status TEXT NOT NULL DEFAULT 'ok',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS heartbeat_digest_day_idx ON heartbeat_digest(day);
  CREATE TABLE IF NOT EXISTS narrative_timeline (
    timeline_id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    delta_json TEXT NOT NULL DEFAULT '{}',
    previous_hash TEXT NOT NULL DEFAULT '',
    current_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS narrative_timeline_subject_idx ON narrative_timeline(subject_id);
  CREATE INDEX IF NOT EXISTS narrative_timeline_created_at_idx ON narrative_timeline(created_at);

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
  CREATE INDEX IF NOT EXISTS behavior_promotion_status_idx ON behavior_promotion(status);
  CREATE INDEX IF NOT EXISTS behavior_promotion_expires_idx ON behavior_promotion(expires_at);

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
  CREATE INDEX IF NOT EXISTS effect_commit_ledger_idempotency_idx ON effect_commit_ledger(idempotency_key);
  CREATE INDEX IF NOT EXISTS effect_commit_ledger_decision_idx ON effect_commit_ledger(decision_id);

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
  CREATE INDEX IF NOT EXISTS circuit_breaker_state_open_idx ON circuit_breaker_state(state) WHERE state = 'open';

  CREATE TABLE IF NOT EXISTS memory_store (
    memory_store_id TEXT PRIMARY KEY,
    lifecycle_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    input_memory_store_id TEXT,
    dream_run_id TEXT,
    canonical_entries_json TEXT NOT NULL,
    insights_json TEXT NOT NULL,
    narrative_snapshot_json TEXT,
    relationship_snapshot_json TEXT,
    validation_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS memory_store_lifecycle_idx ON memory_store(lifecycle_status);
  CREATE INDEX IF NOT EXISTS memory_store_created_at_idx ON memory_store(created_at);
  CREATE INDEX IF NOT EXISTS memory_store_input_idx ON memory_store(input_memory_store_id);
  CREATE INDEX IF NOT EXISTS memory_store_dream_run_idx ON memory_store(dream_run_id);
  -- v8 Living Perception Loop entities
  CREATE TABLE IF NOT EXISTS evidence_item (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    platform_id TEXT NOT NULL,
    external_id TEXT,
    content_hash TEXT NOT NULL,
    stable_identity_key TEXT NOT NULL DEFAULT '',
    observed_at TEXT NOT NULL,
    first_observed_at TEXT,
    last_observed_at TEXT,
    seen_count INTEGER NOT NULL DEFAULT 1,
    row_identity_status TEXT NOT NULL DEFAULT 'stable',
    sensitivity_hint TEXT,
    source_refs_json TEXT NOT NULL,
    redaction_class TEXT NOT NULL DEFAULT 'none',
    payload_json TEXT,
    lifecycle_status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE UNIQUE INDEX IF NOT EXISTS evidence_item_platform_content_hash_idx ON evidence_item(platform_id, content_hash);
  -- Stable-identity indexes are created by applyStateSchemaMigrations after the
  -- columns are guaranteed to exist (fresh DBs have them in the table above;
  -- pre-existing DBs receive them via defensive ALTER TABLE).
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
    platform_id TEXT,
    capability_id TEXT,
    proposal_id TEXT,
    decision_id TEXT,
    status TEXT NOT NULL,
    reason TEXT,
    next_state TEXT,
    source_refs_json TEXT NOT NULL,
    proof_refs_json TEXT,
    trace_refs_json TEXT,
    redaction_class TEXT NOT NULL DEFAULT 'none',
    payload_json TEXT,
    routine_id TEXT,
    activity_thread_id TEXT,
    activity_step_id TEXT
  );
  CREATE TABLE IF NOT EXISTS quiet_daily_review (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    day TEXT NOT NULL,
    closure_count INTEGER NOT NULL DEFAULT 0,
    memory_candidate_count INTEGER NOT NULL DEFAULT 0,
    source_refs_json TEXT NOT NULL,
    closure_refs_json TEXT,
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
    payload_json TEXT
  );
  CREATE TABLE IF NOT EXISTS long_term_memory_projection (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    topic_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'candidate',
    source_refs_json TEXT NOT NULL,
    redaction_class TEXT NOT NULL DEFAULT 'none',
    payload_json TEXT
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
    payload_json TEXT
  );
  CREATE TABLE IF NOT EXISTS loop_stage_event (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    cycle_sequence INTEGER NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    source_refs_json TEXT NOT NULL,
    proof_refs_json TEXT,
    trace_refs_json TEXT,
    redaction_class TEXT NOT NULL DEFAULT 'none',
    occurred_at TEXT NOT NULL,
    expected_downstream_by_cycle INTEGER,
    payload_json TEXT
  );
  CREATE TABLE IF NOT EXISTS impulse_context_artifact (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    scene_type TEXT NOT NULL,
    capability_intent TEXT,
    platform_id TEXT,
    capability_class TEXT,
    impulse_source TEXT NOT NULL,
    impulse_text TEXT,
    atmosphere_text TEXT,
    expression_boundary_constraints_json TEXT,
    expression_boundary_style TEXT,
    freshness_version INTEGER NOT NULL DEFAULT 1,
    source_refs_json TEXT NOT NULL,
    redaction_class TEXT NOT NULL DEFAULT 'none',
    payload_json TEXT,
    lifecycle_status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS daily_rhythm_state (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    quiet_status TEXT NOT NULL DEFAULT 'not_due',
    dream_status TEXT NOT NULL DEFAULT 'not_due',
    quiet_reason TEXT,
    dream_reason TEXT,
    quiet_completed_at TEXT,
    dream_completed_at TEXT,
    source_refs_json TEXT NOT NULL,
    payload_json TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS connector_cooldown_state (
    id TEXT PRIMARY KEY,
    platform_id TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    failure_class TEXT NOT NULL,
    retry_after_ms INTEGER,
    blocked_until TEXT NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 1,
    terminal_count INTEGER NOT NULL DEFAULT 0,
    source_refs_json TEXT NOT NULL,
    redaction_class TEXT NOT NULL DEFAULT 'none',
    payload_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS connector_cooldown_state_platform_capability_idx ON connector_cooldown_state(platform_id, capability_id);
  -- v9 Self Continuity, Character & Procedural Evolution entities
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
`;
function resolveDbPath(filename) {
    if (path.isAbsolute(filename) || filename === ":memory:") {
        return filename;
    }
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pluginRoot = path.resolve(__dirname, "..", "..", "..");
    const dataDir = path.join(pluginRoot, "data");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, filename);
}
function bootstrapStateSchema(sqlite) {
    sqlite.exec(STATE_SCHEMA_SQL);
    // Fresh DBs receive the full bootstrap schema above; mark them at the latest
    // migration version so versioned migrations (which assume older schemas) are
    // skipped without failing on duplicate columns/tables.
    const currentVersion = getSchemaVersion(sqlite);
    if (currentVersion === 0) {
        const maxVersion = Math.max(...ALL_MIGRATIONS.map((m) => m.version));
        setSchemaVersion(sqlite, maxVersion);
    }
    applyStateSchemaMigrations(sqlite);
    runMigrations(sqlite, ALL_MIGRATIONS);
}
function applyStateSchemaMigrations(sqlite) {
    // Defensive column/index additions for DBs that were initialized before
    // v8-004-schema-closure. Fresh DBs already have these from bootstrap SQL.
    // Each statement is wrapped individually so duplicate-column errors are
    // harmless and do not block startup.
    const addColumnMigrations = [
        "ALTER TABLE policy_records ADD COLUMN outreach_daily_budget INTEGER NOT NULL DEFAULT 2",
        "ALTER TABLE action_closure_record ADD COLUMN platform_id TEXT",
        "ALTER TABLE action_closure_record ADD COLUMN capability_id TEXT",
        "ALTER TABLE quiet_daily_review ADD COLUMN closure_refs_json TEXT",
        "ALTER TABLE connector_cooldown_state ADD COLUMN terminal_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE loop_stage_event ADD COLUMN proof_refs_json TEXT",
        "ALTER TABLE loop_stage_event ADD COLUMN trace_refs_json TEXT",
        "ALTER TABLE action_closure_record ADD COLUMN proof_refs_json TEXT",
        "ALTER TABLE action_closure_record ADD COLUMN trace_refs_json TEXT",
        "ALTER TABLE perception_card ADD COLUMN relevance_class TEXT",
        "ALTER TABLE evidence_item ADD COLUMN external_id TEXT",
        "ALTER TABLE evidence_item ADD COLUMN stable_identity_key TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE evidence_item ADD COLUMN first_observed_at TEXT",
        "ALTER TABLE evidence_item ADD COLUMN last_observed_at TEXT",
        "ALTER TABLE evidence_item ADD COLUMN seen_count INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE evidence_item ADD COLUMN row_identity_status TEXT NOT NULL DEFAULT 'stable'",
        "ALTER TABLE action_closure_record ADD COLUMN routine_id TEXT",
        "ALTER TABLE action_closure_record ADD COLUMN activity_thread_id TEXT",
        "ALTER TABLE action_closure_record ADD COLUMN activity_step_id TEXT",
        "CREATE INDEX IF NOT EXISTS evidence_item_stable_identity_idx ON evidence_item(stable_identity_key)",
        "CREATE INDEX IF NOT EXISTS evidence_item_last_observed_status_idx ON evidence_item(last_observed_at, row_identity_status)",
        "CREATE INDEX IF NOT EXISTS connector_cooldown_state_platform_capability_idx ON connector_cooldown_state(platform_id, capability_id)",
    ];
    for (const sql of addColumnMigrations) {
        try {
            sqlite.exec(sql);
        }
        catch {
            /* duplicate column / already migrated */
        }
    }
    // DROP COLUMN requires SQLite ≥ 3.35.0. Guard against older native
    // bindings where the statement would silently fail (caught by try/catch)
    // yet leave lifecycle_status in place while the Drizzle schema no longer
    // declares it, masking an incomplete cleanup.
    const vResult = sqlite.exec("SELECT sqlite_version() AS ver");
    const ver = String(vResult[0]?.values[0]?.[0] ?? "0.0.0");
    const [major, minor] = ver.split(".").map(Number);
    const supportsDropColumn = major > 3 || (major === 3 && minor >= 35);
    const dropColumnTables = [
        "action_closure_record",
        "dream_consolidation_run",
        "long_term_memory_projection",
        "heartbeat_cycle_trace",
        "loop_stage_event",
    ];
    for (const table of dropColumnTables) {
        try {
            if (supportsDropColumn) {
                sqlite.exec(`ALTER TABLE ${table} DROP COLUMN lifecycle_status`);
            }
            else {
                // Rebuild the table without lifecycle_status for SQLite < 3.35.0.
                const info = sqlite.exec(`PRAGMA table_info(${table})`);
                if (!info[0])
                    continue;
                const nameIdx = info[0].columns.indexOf("name");
                const allNames = info[0].values.map((row) => String(row[nameIdx]));
                const kept = allNames.filter((n) => n !== "lifecycle_status");
                if (kept.length === allNames.length)
                    continue; // column already absent
                const colList = kept.join(", ");
                sqlite.exec(`CREATE TABLE ${table}_backup AS SELECT ${colList} FROM ${table}`);
                sqlite.exec(`DROP TABLE ${table}`);
                sqlite.exec(`ALTER TABLE ${table}_backup RENAME TO ${table}`);
            }
        }
        catch {
            /* column already removed or table missing */
        }
    }
}
export function createStateDatabase(filename = "state.db") {
    const dbPath = resolveDbPath(filename);
    const isMemory = filename === ":memory:";
    let dbBuffer;
    if (!isMemory && fs.existsSync(dbPath)) {
        dbBuffer = fs.readFileSync(dbPath);
    }
    const sqlite = new SQL.Database(dbBuffer);
    bootstrapStateSchema(sqlite);
    const db = drizzle(sqlite, { schema });
    return {
        sqlite,
        db,
        schema,
        flush() {
            if (!isMemory) {
                const data = sqlite.export();
                fs.writeFileSync(dbPath, Buffer.from(data));
            }
        },
        close() {
            if (!isMemory) {
                const data = sqlite.export();
                fs.writeFileSync(dbPath, Buffer.from(data));
            }
            sqlite.close();
        },
    };
}
