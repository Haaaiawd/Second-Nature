export type SurfaceMode = "host_safe_carrier" | "workspace_full_runtime" | "capability_probe";
export type RuntimeArtifactModule = "runtime_registration" | "ops_router" | "heartbeat_bridge_adapter" | "host_capability_adapter" | "probe_runner" | "read_model_adapter" | "fallback_shell";
export interface RuntimeArtifactBoundary {
    surfaceMode: SurfaceMode;
    includes: RuntimeArtifactModule[];
    fallbackAllowed: boolean;
    sourcePathDependencyAllowed: false;
}
export type ResolvePackagedRuntimeResult = {
    ok: true;
    runtimeRoot: string;
    boundary: RuntimeArtifactBoundary;
    resolvedModules: Partial<Record<RuntimeArtifactModule, string>>;
} | {
    ok: false;
    code: "runtime_artifact_missing" | "runtime_layout_incomplete";
    message: string;
    runtimeRoot: string;
    missingPaths: string[];
};
/** Relative paths under `plugin/runtime/` that the packaging script must copy. */
export declare const PACKAGED_RUNTIME_REQUIRED_ENTRIES: readonly string[];
export declare function detectForbiddenSourcePathDependencies(sourceText: string): string[];
export declare function defaultRuntimeArtifactBoundary(surfaceMode?: SurfaceMode): RuntimeArtifactBoundary;
/**
 * Verify packaged plugin `runtime/` tree and entrypoints required for ADR-006 closure.
 */
export declare function resolvePackagedRuntime(packageRoot: string): ResolvePackagedRuntimeResult;
