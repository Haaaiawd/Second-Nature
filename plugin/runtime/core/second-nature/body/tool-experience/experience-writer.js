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
import { validateWritePayload } from "../../../../storage/services/write-validation-gate.js";
import * as crypto from "node:crypto";
function outcomeFromConnectorStatus(status) {
    switch (status) {
        case "success":
            return "success";
        case "retryable_failure":
        case "terminal_failure":
            return "failure";
        default:
            return "failure";
    }
}
export function createExperienceWriter(store) {
    return {
        async recordExperience(input) {
            const { result, connectorId, capabilityId, triggerSource } = input;
            const payload = {
                connectorId,
                capabilityId,
                status: result.status,
                failureClass: result.failureClass,
                latencyMs: result.metadata.latencyMs,
                triggerSource,
                sourceRefs: ["experience:record"],
            };
            const gate = validateWritePayload(payload);
            if (!gate.ok) {
                throw new Error(`ExperienceWriter rejected by gate: ${gate.reason}`);
            }
            const experience = {
                experienceId: crypto.randomUUID(),
                connectorId,
                capabilityId,
                outcome: outcomeFromConnectorStatus(result.status),
                failureClass: result.failureClass,
                latencyMs: result.metadata.latencyMs,
                evidenceQuality: result.status === "success" ? 1.0 : 0.0,
                sourceRefs: ["experience:record"],
                triggerSource,
                createdAt: new Date().toISOString(),
            };
            await store.appendToolExperience(experience);
        },
    };
}
