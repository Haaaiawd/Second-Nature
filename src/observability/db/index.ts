import initSqlJs, { type Database } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import * as schema from "./schema/index.js";

// Pre-initialize sql.js WASM at module load time
const SQL = await initSqlJs();

const OBSERVABILITY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS decision_ledger (
    id TEXT PRIMARY KEY,
    tick_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    intent_id TEXT,
    platform_id TEXT,
    verdict TEXT NOT NULL,
    mode TEXT NOT NULL,
    reasons TEXT NOT NULL,
    reason_codes TEXT NOT NULL,
    decision_basis TEXT NOT NULL,
    evidence_refs TEXT NOT NULL,
    model_eval_ref TEXT,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS decision_trace_idx ON decision_ledger(trace_id);
  CREATE INDEX IF NOT EXISTS decision_tick_idx ON decision_ledger(tick_id);
  CREATE TABLE IF NOT EXISTS execution_attempts (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    decision_id TEXT NOT NULL,
    intent_id TEXT NOT NULL,
    platform_id TEXT NOT NULL,
    capability TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    commit_state TEXT,
    failure_class TEXT,
    retry_policy TEXT,
    idempotency_key TEXT,
    started_at TEXT,
    finished_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS attempt_trace_idx ON execution_attempts(trace_id);
  CREATE INDEX IF NOT EXISTS attempt_decision_idx ON execution_attempts(decision_id);
  CREATE INDEX IF NOT EXISTS attempt_platform_idx ON execution_attempts(platform_id);
  CREATE TABLE IF NOT EXISTS governance_audit (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    proposal_id TEXT,
    target_asset_id TEXT,
    asset_path TEXT,
    status_from TEXT,
    status_to TEXT NOT NULL,
    before_hash TEXT,
    after_hash TEXT,
    supporting_sources TEXT,
    reason TEXT,
    verification_deadline TEXT,
    attempts_remaining INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_proposal_idx ON governance_audit(proposal_id);
  CREATE INDEX IF NOT EXISTS audit_asset_idx ON governance_audit(target_asset_id);
  CREATE INDEX IF NOT EXISTS audit_event_idx ON governance_audit(event_type);
  CREATE TABLE IF NOT EXISTS redaction_manifest (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    action TEXT NOT NULL,
    original_value_hash TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS redact_event_idx ON redaction_manifest(event_id);
  CREATE TABLE IF NOT EXISTS host_capability_reports (
    report_id TEXT PRIMARY KEY,
    generated_at TEXT NOT NULL,
    host_version TEXT,
    observed_version TEXT,
    doc_checked_at TEXT NOT NULL,
    doc_links_json TEXT NOT NULL,
    delivery_target TEXT NOT NULL,
    conflict_records_json TEXT NOT NULL,
    full_report_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS connector_inventory_audit (
    audit_id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL,
    scanned INTEGER NOT NULL,
    registered INTEGER NOT NULL,
    skipped INTEGER NOT NULL,
    conflicts_json TEXT NOT NULL,
    validation_errors_json TEXT NOT NULL,
    trust_summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS connector_inventory_snapshot_idx ON connector_inventory_audit(snapshot_id);
  CREATE INDEX IF NOT EXISTS connector_inventory_created_at_idx ON connector_inventory_audit(created_at);
`;

export interface ObservabilityDatabase {
  sqlite: Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
  schema: typeof schema;
  close(): void;
}

function resolveDbPath(filename: string): string {
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

function bootstrapObservabilitySchema(sqlite: Database): void {
  sqlite.exec(OBSERVABILITY_SCHEMA_SQL);
}

export function createObservabilityDatabase(filename = "observability.db"): ObservabilityDatabase {
  const dbPath = resolveDbPath(filename);
  const isMemory = filename === ":memory:";

  let dbBuffer: Uint8Array | undefined;
  if (!isMemory && fs.existsSync(dbPath)) {
    dbBuffer = fs.readFileSync(dbPath);
  }

  const sqlite = new SQL.Database(dbBuffer);
  bootstrapObservabilitySchema(sqlite);
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
