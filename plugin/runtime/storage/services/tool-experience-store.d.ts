/**
 * ToolExperienceStore + CapabilityProbeResultStore — T-SMS.C.5
 *
 * Core logic: Append-only ToolExperience rows (outcome/failureClass/latencyMs/
 * evidenceQuality/sourceRefs/triggerSource). Raw payload rejected by gate.
 * CapabilityProbeResult stored with capabilityId/actualStatus/httpStatus.
 * DR-007: failureClass directly from ConnectorResult.
 * DR-010: triggerSource mandatory.
 */
import type { StateDatabase } from "../db/index.js";
import type { ToolExperience, CapabilityProbeResult } from "../../shared/types/v7-entities.js";
export interface ToolExperienceStore {
    appendToolExperience(exp: ToolExperience): Promise<void>;
    listToolExperience(query: {
        connectorId?: string;
        capabilityId?: string;
        limit?: number;
    }): Promise<ToolExperience[]>;
}
export interface CapabilityProbeResultStore {
    appendProbeResult(result: CapabilityProbeResult): Promise<void>;
    listProbeResults(connectorId: string, limit?: number): Promise<CapabilityProbeResult[]>;
}
export declare function createToolExperienceStore(database: StateDatabase): ToolExperienceStore;
export declare function createCapabilityProbeResultStore(database: StateDatabase): CapabilityProbeResultStore;
