import { probeNativeSqliteLoad } from "./native-sqlite-probe.js";
export interface StorageModeSmokeSemantics {
    sqlJs: {
        walAssumed: false;
        journalConcurrencyNotes: string;
        backupNotes: string;
        repairNotes: string;
    };
    nativeSqliteWhenAvailable: {
        journalConcurrencyNotes: string;
        backupNotes: string;
    };
}
export interface StorageModeSmokeRepairFixtureResult {
    ran: boolean;
    workspaceRoot?: string;
    repairStatus?: "ok" | "repair_required";
    repairedEvidenceIndexRows?: number;
    repairNotes?: string[];
}
export interface StorageModeSmokeReport {
    generatedAt: string;
    /** Implementation backing `createStateDatabase` today — wasm sql.js, not native WAL */
    runtimeIndexDriver: "sql_js";
    nativeSqliteProbe: ReturnType<typeof probeNativeSqliteLoad> & {
        /** Current code path does not use native driver even when load succeeds */
        runtimeUsesNativeDriver: false;
    };
    semantics: StorageModeSmokeSemantics;
    repairFromArtifactsFixture?: StorageModeSmokeRepairFixtureResult;
}
export interface RunStorageModeSmokeOptions {
    /** Required when runRepairFixture is true — temp dir created if omitted */
    workspaceRoot?: string;
    /** Run artifact→index backfill smoke (sql.js path); uses temp workspace when workspaceRoot unset */
    runRepairFixture?: boolean;
}
export declare function runStorageModeSmoke(options?: RunStorageModeSmokeOptions): Promise<StorageModeSmokeReport>;
