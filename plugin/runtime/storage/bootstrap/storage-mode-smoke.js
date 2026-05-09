/**
 * Storage driver mode smoke report (T4.1.4 / state-system §12.1.1).
 *
 * Actual runtime: `createStateDatabase` uses sql.js — no WAL; persistence via export + explicit flush on close.
 * Native SQLite (better-sqlite3) is probed separately; switching drivers is out of scope — report stays honest.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { appendLifeEvidence } from "../life-evidence/append-life-evidence.js";
import { createStateDatabase } from "../db/index.js";
import { lifeEvidenceIndex } from "../db/schema/life-evidence-index.js";
import { repairStateIndexes } from "./repair-gate.js";
import { probeNativeSqliteLoad } from "./native-sqlite-probe.js";
const SEMANTICS = {
    sqlJs: {
        walAssumed: false,
        journalConcurrencyNotes: "sql.js (WASM) has no host SQLite WAL; treat writes as a single-writer/single connection path with explicit export() flush on close (design: single-writer queue + atomic artifact write + explicit flush) — do not assume POSIX WAL or multi-writer journal semantics.",
        backupNotes: "Backup for sql.js mode: export DB binary via sqlite.export(), pair with workspace artifact manifest; avoid copying a live in-memory DB without explicit flush/export.",
        repairNotes: "Index rebuild uses canonical filesystem evidence artifacts under .second-nature/evidence — repairStateIndexes can repopulate life_evidence_index without WAL replay.",
    },
    nativeSqliteWhenAvailable: {
        journalConcurrencyNotes: "Native better-sqlite3 may enable WAL where supported + busy timeout — applicable only if a future native-backed StateDatabase is wired.",
        backupNotes: "Preferred: SQLite Backup API / VACUUM INTO plus artifact manifest — only when native driver owns the DB file.",
    },
};
async function runRepairFixture(workspaceRoot) {
    const state = createStateDatabase(":memory:");
    await appendLifeEvidence(state, workspaceRoot, {
        timestamp: new Date().toISOString(),
        evidenceType: "platform_browse",
        summary: "storage-mode-smoke fixture",
        sourceRefs: [{ id: "smoke-ref", kind: "platform_item", uri: "platform://storage-smoke" }],
        sensitivity: "public",
        producer: "state-system",
    });
    const rows = await state.db.select().from(lifeEvidenceIndex);
    const evidenceId = rows[0]?.id;
    if (!evidenceId) {
        state.close();
        return {
            ran: true,
            workspaceRoot,
            repairStatus: "repair_required",
            repairNotes: ["fixture_failed_no_index_after_append"],
        };
    }
    await state.db.delete(lifeEvidenceIndex).where(eq(lifeEvidenceIndex.id, evidenceId));
    const repair = await repairStateIndexes(state, { startupGate: true, workspaceRoot });
    state.close();
    return {
        ran: true,
        workspaceRoot,
        repairStatus: repair.status,
        repairedEvidenceIndexRows: repair.repairedEvidenceIndexRows,
        repairNotes: repair.repairNotes,
    };
}
export async function runStorageModeSmoke(options = {}) {
    const nativeSqliteProbe = probeNativeSqliteLoad();
    let repairFromArtifactsFixture;
    if (options.runRepairFixture) {
        const ws = options.workspaceRoot ??
            fs.mkdtempSync(path.join(os.tmpdir(), "sn-storage-smoke-"));
        try {
            repairFromArtifactsFixture = await runRepairFixture(ws);
        }
        finally {
            if (!options.workspaceRoot) {
                fs.rmSync(ws, { recursive: true, force: true });
            }
        }
    }
    return {
        generatedAt: new Date().toISOString(),
        runtimeIndexDriver: "sql_js",
        nativeSqliteProbe: {
            ...nativeSqliteProbe,
            runtimeUsesNativeDriver: false,
        },
        semantics: SEMANTICS,
        repairFromArtifactsFixture,
    };
}
