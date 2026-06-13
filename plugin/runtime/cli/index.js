import { createObservabilityDatabase, } from "../observability/db/index.js";
import { createStateAPI, createStateDatabase, } from "../storage/index.js";
import path from "node:path";
import { createActionBridge } from "./action-bridge.js";
import { createCliCommands, } from "./commands/index.js";
import { createOpsRouter } from "./ops/ops-router.js";
import { createCliReadModels, } from "./read-models/index.js";
import { AppendOnlyAuditStore } from "../observability/audit/append-only-audit-store.js";
import { resolvePackagedRuntime } from "./runtime/runtime-artifact-boundary.js";
import { createRestoreSnapshotStore, } from "../storage/services/restore-snapshot-store.js";
import { createRuntimeDecisionRecorder, } from "../observability/services/runtime-decision-recorder.js";
import { createConnectorExecutorAdapter, } from "../connectors/services/connector-executor-adapter.js";
import { CapabilityContractRegistry } from "../connectors/base/manifest.js";
import { CapabilityContractRegistryV7 } from "../connectors/base/manifest-v7.js";
import { moltbookManifest } from "../connectors/social-community/moltbook/manifest.js";
import { evomapManifest } from "../connectors/agent-network/evomap/manifest.js";
import { agentWorldManifest } from "../connectors/agent-network/agent-world/manifest.js";
import { instreetManifest } from "../connectors/social-community/instreet/manifest.js";
import { createAffordanceAssembler, } from "../core/second-nature/body/tool-affordance/affordance-assembler.js";
import { createHistoryDigestStore, } from "../storage/services/history-digest-store.js";
import { probeCredentialHealth, } from "../storage/services/credential-vault.js";
import { DynamicConnectorRegistry, createRegistrySnapshotStore, } from "../connectors/registry/index.js";
/** Built-in connector manifests for DynamicConnectorRegistry. */
const BUILT_IN_CONNECTOR_MANIFESTS = [
    {
        schemaVersion: "sn.connector.v1",
        platformId: "moltbook",
        displayName: "Moltbook",
        family: "social_community",
        capabilities: [
            { id: "feed.read" },
            { id: "post.publish" },
            { id: "comment.reply" },
        ],
        runner: { kind: "declarative_http" },
        credentials: [{ type: "api_key", required: true }],
        sourceRefPolicy: { minSourceRefs: 1 },
    },
    {
        schemaVersion: "sn.connector.v1",
        platformId: "evomap",
        displayName: "EvoMap",
        family: "agent_network",
        capabilities: [
            { id: "agent.register" },
            { id: "work.discover" },
        ],
        runner: { kind: "declarative_http" },
        credentials: [{ type: "api_key", required: true }],
        sourceRefPolicy: { minSourceRefs: 1 },
    },
    {
        schemaVersion: "sn.connector.v1",
        platformId: "agent-world",
        displayName: "Agent World",
        family: "agent_network",
        capabilities: [
            { id: "feed.read" },
            { id: "work.discover" },
            { id: "task.claim" },
        ],
        runner: { kind: "declarative_http" },
        credentials: [{ type: "api_key", required: true }],
        sourceRefPolicy: { minSourceRefs: 1 },
    },
];
const BUILT_IN_CAPABILITY_MANIFESTS = [
    moltbookManifest,
    evomapManifest,
    agentWorldManifest,
    instreetManifest,
];
function idempotencyClassForCapability(capabilityId) {
    return capabilityId.includes("read") ||
        capabilityId.includes("discover") ||
        capabilityId.includes("list") ||
        capabilityId.includes("heartbeat")
        ? "read_only"
        : "idempotent_write";
}
function createCapabilityRegistry() {
    const registry = new CapabilityContractRegistry();
    for (const manifest of BUILT_IN_CAPABILITY_MANIFESTS) {
        registry.register(manifest);
    }
    return registry;
}
function createAffordanceRegistry(registry, workspaceRoot) {
    registry.reloadConnectors(workspaceRoot);
    const v7 = new CapabilityContractRegistryV7();
    for (const entry of registry.listConnectors()) {
        v7.register({
            platformId: entry.platformId,
            capabilities: entry.capabilities.map((capabilityId) => ({
                capabilityId,
                intent: capabilityId,
                probeConfig: {
                    safeEndpoint: `connector://${entry.platformId}/${capabilityId}`,
                    idempotencyClass: idempotencyClassForCapability(capabilityId),
                },
            })),
            channelPriority: ["api_rest"],
            credentialTypes: ["api_key"],
            sourceRefPolicy: { minSourceRefs: 1 },
        });
    }
    return v7;
}
function createWorkspaceAffordanceAssembler(registry, workspaceRoot) {
    return createAffordanceAssembler({
        registry: createAffordanceRegistry(registry, workspaceRoot),
        probeReader: {
            getLatestProbeResult() {
                return undefined;
            },
        },
        // W80: built-in connectors without probe history should posture as
        // "needs_auth" (guard allows) rather than "unavailable" (guard defers).
        credentialRequired: (platformId) => {
            const builtInPlatforms = new Set(["moltbook", "evomap", "agent-world", "instreet"]);
            return builtInPlatforms.has(platformId);
        },
    });
}
function stringifyDeltaField(delta, key) {
    const value = delta[key];
    if (value === undefined || value === null)
        return undefined;
    return typeof value === "string" ? value : JSON.stringify(value);
}
function asStringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
}
function createNarrativeTimelineDeps(stateDb) {
    const historyStore = createHistoryDigestStore(stateDb);
    return {
        stateMemoryPort: {
            async listNarrativeTimeline(from, to, opts) {
                const rows = await historyStore.listNarrativeTimeline({
                    limit: Math.max(opts?.limit ?? 100, 100),
                });
                return rows
                    .filter((row) => row.createdAt >= from && row.createdAt <= to)
                    .filter((row) => opts?.afterTimestamp ? row.createdAt > opts.afterTimestamp : true)
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                    .slice(0, opts?.limit ?? rows.length)
                    .map((row) => ({
                    version: row.timelineId,
                    createdAt: row.createdAt,
                    triggerKind: row.entryType === "restore.applied" ||
                        row.entryType === "goal.transition" ||
                        row.entryType === "dream.projection" ||
                        row.entryType === "owner.override"
                        ? row.entryType
                        : "heartbeat.decision",
                    sourceRefs: asStringArray(row.delta.sourceRefs),
                    reasonCode: stringifyDeltaField(row.delta, "reasonCode"),
                    summaryText: stringifyDeltaField(row.delta, "summaryText") ??
                        `${row.entryType}:${row.subjectId}`,
                }));
            },
            async getNarrativeSnapshot(version) {
                const rows = await historyStore.listNarrativeTimeline({ limit: 500 });
                const row = rows.find((candidate) => candidate.timelineId === version || candidate.subjectId === version);
                if (!row)
                    return null;
                const delta = row.delta;
                return {
                    version,
                    focus: delta.focus,
                    progress: delta.progress,
                    nextIntent: delta.nextIntent,
                    toneSignal: delta.toneSignal,
                    acceptedGoalId: delta.acceptedGoalId,
                    sourceRefs: asStringArray(delta.sourceRefs),
                    lastChangeReasonCode: stringifyDeltaField(delta, "reasonCode"),
                };
            },
        },
    };
}
function createSecretAnchorDeps(stateDb) {
    return {
        runtimeOpsPort: {
            getEncryptionKeyPath: () => "SECOND_NATURE_ENCRYPTION_KEY",
            checkKeyPathExists: async () => {
                const key = process.env.SECOND_NATURE_ENCRYPTION_KEY?.trim();
                return Boolean(key && key.length >= 32);
            },
        },
        credentialPort: {
            verifySampleDecrypt: async () => {
                const result = stateDb.sqlite.exec(`SELECT platform_id, encrypted_value
           FROM credential_records
           WHERE encrypted_value IS NOT NULL AND encrypted_value != ''
           LIMIT 3`);
                if (result.length === 0 || result[0].values.length === 0) {
                    return { status: "ok", checkedIds: [] };
                }
                const checkedIds = [];
                for (const row of result[0].values) {
                    const platformId = String(row[0] ?? "unknown");
                    const encryptedValue = typeof row[1] === "string" ? row[1] : "";
                    checkedIds.push(platformId);
                    const probe = probeCredentialHealth(platformId, encryptedValue, undefined);
                    if (probe.keyHealth === "wrong_key") {
                        return { status: "wrong_key", checkedIds };
                    }
                    if (probe.keyHealth !== "ok") {
                        return { status: "error", checkedIds };
                    }
                }
                return { status: "ok", checkedIds };
            },
        },
    };
}
export function createCliRuntimeDeps(overrides = {}) {
    const workspaceRoot = overrides.workspaceRoot ?? process.cwd();
    const stateDb = overrides.stateDb ?? createStateDatabase();
    const observabilityDb = overrides.observabilityDb ?? createObservabilityDatabase();
    const stateApi = overrides.stateApi ?? createStateAPI(stateDb);
    const auditStore = overrides.auditStore ?? overrides.livedExperienceAuditStore ?? new AppendOnlyAuditStore();
    const readModels = overrides.readModels ??
        createCliReadModels({
            stateDb,
            observabilityDb,
            workspaceRoot,
            livedExperienceAuditStore: auditStore,
        });
    const actionBridge = overrides.actionBridge ?? createActionBridge(stateApi);
    const runtimeRecorder = overrides.runtimeRecorder ?? createRuntimeDecisionRecorder(observabilityDb);
    const connectorExecutor = overrides.connectorExecutor ??
        createConnectorExecutorAdapter({
            stateDb,
            observabilityDb,
            workspaceRoot,
        });
    const registry = overrides.registry ??
        new DynamicConnectorRegistry({
            builtInManifests: BUILT_IN_CONNECTOR_MANIFESTS,
            snapshotStore: createRegistrySnapshotStore(),
        });
    const capabilityRegistry = overrides.capabilityRegistry ?? createCapabilityRegistry();
    const affordanceAssembler = overrides.affordanceAssembler ??
        createWorkspaceAffordanceAssembler(registry, workspaceRoot);
    const narrativeTimelineDeps = overrides.narrativeTimelineDeps ?? createNarrativeTimelineDeps(stateDb);
    const secretAnchorDeps = overrides.secretAnchorDeps ?? createSecretAnchorDeps(stateDb);
    const restoreSnapshotStore = overrides.restoreSnapshotStore ?? createRestoreSnapshotStore(stateDb);
    return {
        stateDb,
        observabilityDb,
        stateApi,
        readModels,
        actionBridge,
        runtimeRecorder,
        connectorExecutor,
        capabilityRegistry,
        registry,
        affordanceAssembler,
        narrativeTimelineDeps,
        secretAnchorDeps,
        restoreSnapshotStore,
        auditStore,
    };
}
export function createCommandRouter(options = {}) {
    const workspaceRoot = process.cwd();
    const runtime = createCliRuntimeDeps(options.deps);
    const pluginRoot = path.join(process.cwd(), "plugin");
    const opsRouter = createOpsRouter({
        runtimeAvailable: resolvePackagedRuntime(pluginRoot).ok,
        readModels: runtime.readModels,
        runtimeRecorder: runtime.runtimeRecorder,
        state: runtime.stateDb,
        workspaceRoot,
        observabilityDb: runtime.observabilityDb,
        connectorExecutor: runtime.connectorExecutor,
        connectorRegistry: runtime.capabilityRegistry,
        registry: runtime.registry,
        toolAffordancePort: runtime.affordanceAssembler,
        narrativeTimelineDeps: runtime.narrativeTimelineDeps,
        secretAnchorDeps: runtime.secretAnchorDeps,
        restoreSnapshotStore: runtime.restoreSnapshotStore,
        auditStore: runtime.auditStore,
    });
    const commands = createCliCommands({
        readModels: runtime.readModels,
        actionBridge: runtime.actionBridge,
        opsRouter,
        stateDb: runtime.stateDb,
        observabilityDb: runtime.observabilityDb,
    });
    return {
        commands,
        resolve(name) {
            return commands.find((command) => command.name === name);
        },
    };
}
export function closeCliRuntimeDeps(deps) {
    deps.stateDb.close();
    deps.observabilityDb.close();
}
export { createOpsRouter, } from "./ops/ops-router.js";
export { heartbeatCheck, } from "./ops/heartbeat-surface.js";
export * from "./host-capability/types.js";
export { classifyDeliveryCapability, } from "./host-capability/classify-delivery.js";
export { probeHostCapability } from "./host-capability/probe-host-capability.js";
export { recordHostCapability } from "./host-capability/record-host-capability.js";
export { runHostSmoke } from "./host-smoke/run-host-smoke.js";
export { explainSurfaceSubject } from "./explain/explain-surface-subject.js";
export { showOperatorFallback, OperatorFallbackNotFoundError, } from "./ops/show-operator-fallback.js";
