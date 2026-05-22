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
import type {
  ToolExperience,
  ToolExperienceTriggerSource,
} from "../../../../shared/types/v7-entities.js";
import { validateWritePayload } from "../../../../storage/services/write-validation-gate.js";
import * as crypto from "node:crypto";

export interface ExperienceRecordInput {
  connectorId: string;
  capabilityId: string;
  result: ConnectorResult<unknown>;
  triggerSource: ToolExperienceTriggerSource;
}

export interface ExperienceWriter {
  recordExperience(input: ExperienceRecordInput): Promise<void>;
}

function outcomeFromConnectorStatus(
  status: ConnectorResult<unknown>["status"],
): ToolExperience["outcome"] {
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

export function createExperienceWriter(
  store: ToolExperienceStore,
): ExperienceWriter {
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
        throw new Error(
          `ExperienceWriter rejected by gate: ${gate.reason}`,
        );
      }

      const experience: ToolExperience = {
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
