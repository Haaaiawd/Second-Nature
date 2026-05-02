export interface NativeSqliteProbeResult {
    moduleLoadOk: boolean;
    /** package version when load succeeds */
    version?: string;
    errorMessage?: string;
}
export declare function probeNativeSqliteLoad(): NativeSqliteProbeResult;
