/**
 * ExperienceWriter — T-BTS.C.4
 *
 * Core logic: Records connector execution results as ToolExperience rows.
 * - triggerSource is mandatory (DR-010)
 * - failureClass directly transcribed from ConnectorResult (DR-007)
 * - WriteValidationGate rejects raw payload before append
 * - outcome mapping: success → "success", retryable_failure → "failure",
 *   terminal_failure → "failure"
 *
 * Dependencies:
 * - `ToolExperienceStore` from `../../../../storage/services/tool-experience-store.js`
 * - `validateWritePayload` from `../../../../storage/services/write-validation-gate.js`
 * - `ConnectorResult` type from `../../../../connectors/base/contract.js`
 *
 * Boundary:
 * - Does NOT probe; only records completed attempts.
 * - Caller supplies triggerSource explicitly (no default).
 *
 * Test coverage: tests/unit/body/experience-writer.test.ts
 */
import type { ToolExperienceStore } from "../../../../storage/services/tool-experience-store.js";
import type { ConnectorResult } from "../../../../connectors/base/contract.js";
import type { ToolExperienceTriggerSource } from "../../../../shared/types/v7-entities.js";
export interface ExperienceRecordInput {
    connectorId: string;
    capabilityId: string;
    result: ConnectorResult<unknown>;
    triggerSource: ToolExperienceTriggerSource;
}
export interface ExperienceWriter {
    recordExperience(input: ExperienceRecordInput): Promise<void>;
}
export declare function createExperienceWriter(store: ToolExperienceStore): ExperienceWriter;
