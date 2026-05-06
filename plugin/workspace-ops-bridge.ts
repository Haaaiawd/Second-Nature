/**
 * T1.1.4 — Lazy workspace full-ops bridge (OpenClaw plugin).
 *
 * Core logic: dynamic-import packaged `runtime/` + open workspace `data/*.db` with the same
 * `createCliRuntimeDeps` + `createOpsRouter` + `createCliCommands` path as the workspace CLI.
 * `process.chdir(workspaceRoot)` during dispatch so `memory/workspace` paths match CLI cwd semantics.
 *
 * Boundaries: no static imports from `./runtime/*` (sql.js top-level await stays out of register() graph).
 * VM safety: do not read `import.meta.url` at module scope — some OpenClaw loaders evaluate this file in contexts
 * where top-level `import.meta` breaks before `register()` runs; compute package root only inside `openWorkspaceOpsBridge`.
 *
 * Plan B (CH-11-01): if the host VM blocks dynamic import + sql.js, fall back to a subprocess invoking
 * the workspace `second-nature` CLI — not implemented here; bridge failures surface as explicit errors.
 *
 * Test coverage: tests/integration/cli/plugin-workspace-ops-bridge.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type WorkspaceOpsBridgeOpenResult =
  | {
      ok: true;
      workspaceRoot: string;
      dispatch(command: string, input?: Record<string, unknown>): Promise<Record<string, unknown>>;
      close(): void;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        nextStep: string;
        requiredUserInput?: string[];
      };
    };

export async function openWorkspaceOpsBridge(workspaceRoot: string): Promise<WorkspaceOpsBridgeOpenResult> {
  const resolvedRoot = path.resolve(workspaceRoot);
  try {
    const pluginPackageRoot = path.dirname(fileURLToPath(import.meta.url));
    interface PackagedCliModule {
      createCliRuntimeDeps: (overrides?: Record<string, unknown>) => {
        readModels: unknown;
        actionBridge: unknown;
        stateDb: { close: () => void };
        observabilityDb: { close: () => void };
      };
      closeCliRuntimeDeps: (deps: { stateDb: { close: () => void }; observabilityDb: { close: () => void } }) => void;
      createOpsRouter: (opts: { runtimeAvailable: boolean; readModels?: unknown }) => {
        dispatch: (command: string, input?: Record<string, unknown>) => unknown;
      };
    }
    interface CommandsModule {
      createCliCommands: (deps: {
        readModels: unknown;
        actionBridge: unknown;
        opsRouter: { dispatch: (command: string, input?: Record<string, unknown>) => unknown };
      }) => Array<{ name: string; execute: (input?: Record<string, unknown>) => Promise<Record<string, unknown>> }>;
    }
    // Packaged `plugin/runtime` is emitted JS without sibling `.d.ts` in this repo layout.
    // @ts-expect-error TS7016 — intentional dynamic import of artifact bundle
    const cliIndex = (await import("./runtime/cli/index.js")) as unknown as PackagedCliModule;
    const commandsMod = (await import("./runtime/cli/commands/index.js")) as unknown as CommandsModule;
    const storageDb = (await import("./runtime/storage/db/index.js")) as unknown as {
      createStateDatabase: (filename: string) => { close: () => void };
    };
    const obsDb = (await import("./runtime/observability/db/index.js")) as unknown as {
      createObservabilityDatabase: (filename: string) => { close: () => void };
    };
    const boundary = (await import("./runtime/cli/runtime/runtime-artifact-boundary.js")) as unknown as {
      resolvePackagedRuntime: (packageRoot: string) => { ok: boolean };
    };

    const dataDir = path.join(resolvedRoot, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const statePath = path.join(dataDir, "state.db");
    const obsPath = path.join(dataDir, "observability.db");

    const stateDb = storageDb.createStateDatabase(statePath);
    const observabilityDb = obsDb.createObservabilityDatabase(obsPath);

    const deps = cliIndex.createCliRuntimeDeps({ stateDb, observabilityDb });
    const runtimeResolved = boundary.resolvePackagedRuntime(pluginPackageRoot);
    const opsRouter = cliIndex.createOpsRouter({
      runtimeAvailable: runtimeResolved.ok,
      readModels: deps.readModels,
    });
    const commands = commandsMod.createCliCommands({
      readModels: deps.readModels,
      actionBridge: deps.actionBridge,
      opsRouter,
    });

    const dispatch = async (command: string, input?: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const def = commands.find((c) => c.name === command);
      if (!def) {
        return {
          ok: false,
          error: { code: "unknown_command", message: `Unknown Second Nature command: ${command}` },
        };
      }
      const prevCwd = process.cwd();
      try {
        process.chdir(resolvedRoot);
        return await def.execute(input);
      } finally {
        process.chdir(prevCwd);
      }
    };

    const close = () => {
      cliIndex.closeCliRuntimeDeps(deps);
    };

    return { ok: true, workspaceRoot: resolvedRoot, dispatch, close };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_FULL_OPS_BRIDGE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        nextStep:
          "Confirm the packaged plugin includes plugin/runtime and that the host allows dynamic import of sql.js. If the VM forbids it, use a subprocess workspace CLI (Plan B) or run outside the sandbox.",
      },
    };
  }
}
