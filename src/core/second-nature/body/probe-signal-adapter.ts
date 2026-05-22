/**
 * ProbeSignalAdapter — T-BTS.C.4
 *
 * Core logic: Bridge between WetProbeRunner and state-memory.
 * 1. Runs a wet probe for a capability.
 * 2. Persists the CapabilityProbeResult to state-memory.
 * 3. If the probe indicates degradation/unavailability, records a
 *    corresponding ToolExperience row with triggerSource="probe".
 *
 * Dependencies:
 * - `WetProbeRunner` from `../../../connectors/base/wet-probe-runner.js`
 * - `CapabilityContractRegistryV7` from `../../../connectors/base/manifest-v7.js`
 * - `CapabilityProbeResultStore` from `../../../storage/services/tool-experience-store.js`
 * - `ToolExperienceStore` from `../../../storage/services/tool-experience-store.js`
 * - `ExperienceWriter` from `./tool-experience/experience-writer.js`
 *
 * Boundary:
 * - Does NOT modify breaker state — caller (CircuitBreakerManager) decides.
 * - probePolicyDenied is treated as a valid result, not an error.
 *
 * Test coverage: tests/unit/body/probe-signal-adapter.test.ts
 */

import type { WetProbeRunner } from "../../../connectors/base/wet-probe-runner.js";
import type { CapabilityContractRegistryV7 } from "../../../connectors/base/manifest-v7.js";
import type {
  CapabilityProbeResultStore,
  ToolExperienceStore,
} from "../../../storage/services/tool-experience-store.js";
import { createExperienceWriter } from "./tool-experience/experience-writer.js";
import type { ConnectorResult } from "../../../connectors/base/contract.js";

export interface ProbeSignalAdapter {
  runAndRecordProbe(
    platformId: string,
    capabilityId: string,
    registry: CapabilityContractRegistryV7,
  ): Promise<{
    actualStatus: string;
    httpStatus: number;
    recorded: boolean;
    experienceRecorded: boolean;
  }>;
}

export function createProbeSignalAdapter(deps: {
  wetProbeRunner: WetProbeRunner;
  probeResultStore: CapabilityProbeResultStore;
  toolExperienceStore: ToolExperienceStore;
}): ProbeSignalAdapter {
  const { wetProbeRunner, probeResultStore, toolExperienceStore } = deps;
  const experienceWriter = createExperienceWriter(toolExperienceStore);

  return {
    async runAndRecordProbe(platformId, capabilityId, registry) {
      const result = await wetProbeRunner.runWetProbe(
        platformId,
        capabilityId,
        registry,
      );

      // Persist probe result
      await probeResultStore.appendProbeResult(result.probeResult);

      // Record experience for non-success probes
      let experienceRecorded = false;
      if (result.probeResult.actualStatus !== "available") {
        const mockResult: ConnectorResult<unknown> = {
          status: "terminal_failure",
          failureClass: "transport_failure",
          metadata: {
            platformId,
            channel: "api_rest",
            latencyMs: 0,
          },
        };
        await experienceWriter.recordExperience({
          connectorId: platformId,
          capabilityId,
          result: mockResult,
          triggerSource: "probe",
        });
        experienceRecorded = true;
      }

      return {
        actualStatus: result.probeResult.actualStatus,
        httpStatus: result.httpStatus,
        recorded: true,
        experienceRecorded,
      };
    },
  };
}
