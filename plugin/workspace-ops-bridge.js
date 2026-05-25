/**
 * T1.1.4 — Lazy workspace full-ops bridge (OpenClaw plugin).
 *
 * Core logic: dynamic-import packaged `runtime/` + open workspace `data/*.db` with the same
 * `createCliRuntimeDeps` + `createOpsRouter` + `createCliCommands` path as the workspace CLI.
 * `process.chdir(workspaceRoot)` during dispatch so `memory/workspace` paths match CLI cwd semantics.
 *
 * v7 additions (T-ROS.C.2): pass auditStore (AppendOnlyAuditStore) to createOpsRouter so that
 * heartbeat_digest, restore, and other v7 commands work through the bridge. The store is created
 * fresh per-bridge-open (in-memory; not persisted across restarts). secretAnchorDeps are not wired
 * here yet — runtime_secret_bootstrap will degrade gracefully until T-ROS.C.4 wires the real port.
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
export async function openWorkspaceOpsBridge(workspaceRoot) {
    const declaredRoot = typeof workspaceRoot === "string" ? workspaceRoot.trim() : "";
    if (!declaredRoot) {
        return {
            ok: false,
            error: {
                code: "WORKSPACE_ROOT_REQUIRED",
                message: "openWorkspaceOpsBridge requires a workspaceRoot path. Set SECOND_NATURE_WORKSPACE_ROOT or pass tool workspaceRoot.",
                nextStep: "reinvoke_with_workspaceRoot_or_set_SECOND_NATURE_WORKSPACE_ROOT",
                requiredUserInput: ["workspaceRoot"],
            },
        };
    }
    const resolvedRoot = path.resolve(declaredRoot);
    try {
        const pluginPackageRoot = path.dirname(fileURLToPath(import.meta.url));
        // Packaged `plugin/runtime` is emitted JS without sibling `.d.ts` in this repo layout.
        // Dynamic import of artifact bundle — typed via PackagedCliModule interface above.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore TS7016 — intentional: runtime artifact has no adjacent .d.ts in this layout
        const cliIndex = (await import("./runtime/cli/index.js"));
        const commandsMod = (await import("./runtime/cli/commands/index.js"));
        const storageDb = (await import("./runtime/storage/db/index.js"));
        const obsDb = (await import("./runtime/observability/db/index.js"));
        const boundary = (await import("./runtime/cli/runtime/runtime-artifact-boundary.js"));
        // v7 (T-ROS.C.2): in-memory audit store for v7 ops surface (heartbeat_digest, restore, etc.)
        const auditMod = (await import("./runtime/observability/audit/append-only-audit-store.js"));
        const auditStore = new auditMod.AppendOnlyAuditStore();
        const dataDir = path.join(resolvedRoot, "data");
        fs.mkdirSync(dataDir, { recursive: true });
        const statePath = path.join(dataDir, "state.db");
        const obsPath = path.join(dataDir, "observability.db");
        const stateDb = storageDb.createStateDatabase(statePath);
        const observabilityDb = obsDb.createObservabilityDatabase(obsPath);
        const deps = cliIndex.createCliRuntimeDeps({
            stateDb,
            observabilityDb,
            workspaceRoot: resolvedRoot,
        });
        const runtimeResolved = boundary.resolvePackagedRuntime(pluginPackageRoot);
        const opsRouter = cliIndex.createOpsRouter({
            runtimeAvailable: runtimeResolved.ok,
            readModels: deps.readModels,
            runtimeRecorder: deps.runtimeRecorder,
            // T1.2.8 (SN-CODE-03): pass observabilityDb so capability_probe can persist reports
            observabilityDb,
            state: stateDb,
            workspaceRoot: resolvedRoot,
            connectorExecutor: deps.connectorExecutor,
            connectorRegistry: deps.capabilityRegistry,
            registry: deps.registry,
            toolAffordancePort: deps.affordanceAssembler,
            // v7 (T-ROS.C.2): in-memory audit store for heartbeat_digest / restore / self_health
            auditStore,
            narrativeTimelineDeps: deps.narrativeTimelineDeps,
            secretAnchorDeps: deps.secretAnchorDeps,
            restoreSnapshotStore: deps.restoreSnapshotStore,
        });
        const commands = commandsMod.createCliCommands({
            readModels: deps.readModels,
            actionBridge: deps.actionBridge,
            opsRouter,
        });
        const dispatch = async (command, input) => {
            const def = commands.find((c) => c.name === command);
            if (!def) {
                return {
                    ok: false,
                    error: {
                        code: "unknown_command",
                        message: `Unknown Second Nature command: ${command}`,
                    },
                };
            }
            const prevCwd = process.cwd();
            try {
                process.chdir(resolvedRoot);
                return await def.execute(input);
            }
            finally {
                process.chdir(prevCwd);
            }
        };
        const close = () => {
            cliIndex.closeCliRuntimeDeps(deps);
        };
        return { ok: true, workspaceRoot: resolvedRoot, dispatch, close };
    }
    catch (error) {
        return {
            ok: false,
            error: {
                code: "WORKSPACE_FULL_OPS_BRIDGE_FAILED",
                message: error instanceof Error ? error.message : String(error),
                nextStep: "Confirm the packaged plugin includes plugin/runtime and that the host allows dynamic import of sql.js. If the VM forbids it, use a subprocess workspace CLI (Plan B) or run outside the sandbox.",
            },
        };
    }
}
