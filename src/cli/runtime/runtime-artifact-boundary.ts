/**
 * Packaged runtime artifact boundary (cli-system / ADR-006).
 *
 * Core logic: resolve plugin-local `runtime/` layout produced by build-plugin-package;
 * forbid dev-only imports that reach repo `src/` from published surfaces.
 *
 * Boundaries: filesystem checks only; does not execute host loaders.
 *
 * Test coverage: tests/unit/cli/runtime-artifact-boundary.test.ts
 */
import fs from "node:fs";
import path from "node:path";

export type SurfaceMode = "host_safe_carrier" | "workspace_full_runtime" | "capability_probe";

export type RuntimeArtifactModule =
  | "runtime_registration"
  | "ops_router"
  | "heartbeat_bridge_adapter"
  | "host_capability_adapter"
  | "probe_runner"
  | "read_model_adapter"
  | "fallback_shell";

export interface RuntimeArtifactBoundary {
  surfaceMode: SurfaceMode;
  includes: RuntimeArtifactModule[];
  fallbackAllowed: boolean;
  sourcePathDependencyAllowed: false;
}

export type ResolvePackagedRuntimeResult =
  | {
      ok: true;
      runtimeRoot: string;
      boundary: RuntimeArtifactBoundary;
      resolvedModules: Partial<Record<RuntimeArtifactModule, string>>;
    }
  | {
      ok: false;
      code: "runtime_artifact_missing" | "runtime_layout_incomplete";
      message: string;
      runtimeRoot: string;
      missingPaths: string[];
    };

/** Relative paths under `plugin/runtime/` that the packaging script must copy. */
export const PACKAGED_RUNTIME_REQUIRED_ENTRIES: readonly string[] = [
  "cli/index.js",
  "storage/index.js",
  "observability/index.js",
  "core/second-nature/index.js",
  "core/second-nature/runtime/service-entry.js",
  "guidance/index.js",
  "connectors/index.js",
  "shared/types/index.js",
];

const DEFAULT_INCLUDES: RuntimeArtifactModule[] = [
  "runtime_registration",
  "ops_router",
  "heartbeat_bridge_adapter",
  "read_model_adapter",
  "fallback_shell",
];

const SOURCE_REPO_PATH_PATTERN =
  /(?:from\s+["']|import\s+["']|require\s*\(\s*["'])(?:\.\.\/)+src\//i;

export function detectForbiddenSourcePathDependencies(sourceText: string): string[] {
  const hits: string[] = [];
  const lines = sourceText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (SOURCE_REPO_PATH_PATTERN.test(line)) {
      hits.push(`line ${i + 1}: ${line.trim()}`);
    }
  }
  return hits;
}

export function defaultRuntimeArtifactBoundary(surfaceMode: SurfaceMode = "workspace_full_runtime"): RuntimeArtifactBoundary {
  return {
    surfaceMode,
    includes: [...DEFAULT_INCLUDES],
    fallbackAllowed: true,
    sourcePathDependencyAllowed: false,
  };
}

/**
 * Verify packaged plugin `runtime/` tree and entrypoints required for ADR-006 closure.
 */
export function resolvePackagedRuntime(packageRoot: string): ResolvePackagedRuntimeResult {
  const runtimeRoot = path.join(packageRoot, "runtime");
  if (!fs.existsSync(runtimeRoot) || !fs.statSync(runtimeRoot).isDirectory()) {
    return {
      ok: false,
      code: "runtime_artifact_missing",
      message: `runtime directory missing under ${packageRoot}`,
      runtimeRoot,
      missingPaths: [runtimeRoot],
    };
  }

  const missingPaths: string[] = [];
  for (const rel of PACKAGED_RUNTIME_REQUIRED_ENTRIES) {
    const abs = path.join(runtimeRoot, rel);
    if (!fs.existsSync(abs)) {
      missingPaths.push(abs);
    }
  }

  if (missingPaths.length > 0) {
    return {
      ok: false,
      code: "runtime_layout_incomplete",
      message: "packaged runtime is missing one or more required compiled modules",
      runtimeRoot,
      missingPaths,
    };
  }

  const resolvedModules: Partial<Record<RuntimeArtifactModule, string>> = {
    ops_router: path.join(runtimeRoot, "cli/index.js"),
    runtime_registration: path.join(runtimeRoot, "core/second-nature/runtime/service-entry.js"),
    heartbeat_bridge_adapter: path.join(runtimeRoot, "core/second-nature/heartbeat/index.js"),
    read_model_adapter: path.join(runtimeRoot, "cli/read-models/index.js"),
    fallback_shell: path.join(runtimeRoot, "cli/index.js"),
  };

  return {
    ok: true,
    runtimeRoot,
    boundary: defaultRuntimeArtifactBoundary(),
    resolvedModules,
  };
}
