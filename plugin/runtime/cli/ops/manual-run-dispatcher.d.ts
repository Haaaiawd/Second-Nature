/**
 * ManualRunDispatcher — T-ROS.C.3 (DR-038)
 *
 * Core logic: Isolated entry points for manual connector execution, wet probe,
 * and heartbeat probe. All paths enforce:
 *   - triggerSource: "manual_run" on downstream records
 *   - affectsHeartbeatCadence: false (does not advance cron cadence)
 *
 * Writes are serialized through the same WriteQueue as cron heartbeat,
 * preventing concurrent DB conflicts without blocking either path.
 *
 * Dependencies:
 *   - ConnectorExecutor (from connector-system)
 *   - ExperienceWriter (from body-tool-system)
 *   - WetProbeRunner (from connector-system)
 *   - heartbeatCheck (from heartbeat-surface)
 *
 * Boundary:
 *   - Does NOT implement connector adapters; delegates to ConnectorExecutor.
 *   - Does NOT persist raw payloads; redacted samples only.
 *   - Caller provides all ports; no module-scope state.
 *
 * Test coverage: tests/unit/ops/manual-run-dispatcher.test.ts
 */
import type { ConnectorExecutor, ConnectorResult } from "../../connectors/base/contract.js";
import type { ExperienceWriter } from "../../core/second-nature/body/tool-experience/experience-writer.js";
import type { WetProbeRunner } from "../../connectors/base/wet-probe-runner.js";
import type { CapabilityContractRegistryV7 } from "../../connectors/base/manifest-v7.js";
import type { AppendOnlyAuditStore } from "../../observability/audit/append-only-audit-store.js";
import { type HeartbeatCheckInput, type HeartbeatSurfaceResult } from "./heartbeat-surface.js";
import type { RuntimeOpsEnvelope } from "./ops-router.js";
import type { StateDatabase } from "../../storage/db/index.js";
export interface ManualTriggerContext {
    triggerSource: "manual_run";
    affectsHeartbeatCadence: false;
    caller?: string;
    reason?: string;
}
export interface ConnectorRunInput {
    platformId: string;
    capabilityId: string;
    payload?: Record<string, unknown>;
    caller?: string;
    reason?: string;
}
export interface ConnectorRunResult {
    connectorResult: ConnectorResult<unknown>;
    experienceId: string;
    triggerSource: "manual_run";
    affectsHeartbeatCadence: false;
    evidence?: {
        v7EvidenceId?: string;
        v8EvidenceIds: string[];
        emptyReason?: string;
    };
}
export interface WetProbeRunInput {
    platformId: string;
    capabilityId: string;
}
export interface WetProbeManualResult {
    probeResultId: string;
    platformId: string;
    capabilityId: string;
    actualStatus: string;
    httpStatus: number;
    triggerSource: "manual_run";
    affectsHeartbeatCadence: false;
}
export interface HeartbeatProbeInput {
    deps: HeartbeatCheckInput;
    caller?: string;
    reason?: string;
}
export interface ManualRunDispatcher {
    runConnector(input: ConnectorRunInput): Promise<RuntimeOpsEnvelope<ConnectorRunResult>>;
    runWetProbe(input: WetProbeRunInput): Promise<RuntimeOpsEnvelope<WetProbeManualResult>>;
    runHeartbeatProbe(input: HeartbeatProbeInput): Promise<HeartbeatSurfaceResult & ManualTriggerContext>;
}
export interface ManualRunDispatcherDeps {
    connectorExecutor: ConnectorExecutor;
    experienceWriter: ExperienceWriter;
    wetProbeRunner: WetProbeRunner;
    registryV7: CapabilityContractRegistryV7;
    auditStore?: AppendOnlyAuditStore;
    /** Workspace state database for evidence persistence (v7 life_evidence + v8 EvidenceItem). */
    state?: StateDatabase;
    /** Workspace root required for v7 life evidence JSON artifacts. */
    workspaceRoot?: string;
}
export declare function createManualRunDispatcher(deps: ManualRunDispatcherDeps): ManualRunDispatcher;
