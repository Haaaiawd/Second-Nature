import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as schema from "./schema/index.js";
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
    applyStateSchemaMigrations(sqlite);
}
function applyStateSchemaMigrations(sqlite) {
    const migrations = [
        "ALTER TABLE policy_records ADD COLUMN outreach_daily_budget INTEGER NOT NULL DEFAULT 2",
    ];
    for (const sql of migrations) {
        try {
            sqlite.exec(sql);
        }
        catch {
            /* duplicate column / already migrated */
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
        close() {
            if (!isMemory) {
                const data = sqlite.export();
                fs.writeFileSync(dbPath, Buffer.from(data));
            }
            sqlite.close();
        },
    };
}
