/**
 * EvidenceLevelClassifier unit tests (T-OBS.R.7)
 *
 * Coverage:
 * - classifyEvidenceLevel maps proof flags to canonical levels.
 * - capEvidenceLevel prevents carrier/smoke from masquerading as real runtime.
 * - minEvidenceLevel aggregates stage levels by weakest link.
 * - promoteEvidenceLevel is monotonic and requires proof.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  classifyEvidenceLevel,
  capEvidenceLevel,
  minEvidenceLevel,
  promoteEvidenceLevel,
  EVIDENCE_LEVEL_ORDER,
  evidenceLevelDescription,
} from "../../../src/shared/evidence-level-classifier.js";
import type { EvidenceLevel } from "../../../src/shared/types/v8-contracts.js";

describe("EVIDENCE_LEVEL_ORDER", () => {
  it("orders levels from carrier_ack to durable_verified", () => {
    assert.strictEqual(EVIDENCE_LEVEL_ORDER.carrier_ack, 0);
    assert.strictEqual(EVIDENCE_LEVEL_ORDER.contract_smoke, 1);
    assert.strictEqual(EVIDENCE_LEVEL_ORDER.state_present, 2);
    assert.strictEqual(EVIDENCE_LEVEL_ORDER.real_runtime, 3);
    assert.strictEqual(EVIDENCE_LEVEL_ORDER.durable_verified, 4);
  });
});

describe("classifyEvidenceLevel", () => {
  it("returns carrier_ack for an envelope-only proof", () => {
    assert.strictEqual(
      classifyEvidenceLevel({ hasCarrierEnvelope: true }),
      "carrier_ack",
    );
  });

  it("returns contract_smoke when contract smoke proof exists", () => {
    assert.strictEqual(
      classifyEvidenceLevel({ hasCarrierEnvelope: true, hasContractSmoke: true }),
      "contract_smoke",
    );
  });

  it("returns state_present when durable state exists but no live cycle", () => {
    assert.strictEqual(
      classifyEvidenceLevel({
        hasCarrierEnvelope: true,
        hasContractSmoke: true,
        hasStatePresent: true,
      }),
      "state_present",
    );
  });

  it("returns real_runtime when a cycle executed and produced closure", () => {
    assert.strictEqual(
      classifyEvidenceLevel({
        hasCarrierEnvelope: true,
        hasContractSmoke: true,
        hasStatePresent: true,
        hasCycleExecution: true,
      }),
      "real_runtime",
    );
  });

  it("returns durable_verified only when readback proof also exists", () => {
    assert.strictEqual(
      classifyEvidenceLevel({
        hasCarrierEnvelope: true,
        hasContractSmoke: true,
        hasStatePresent: true,
        hasCycleExecution: true,
        hasReadbackVerification: true,
      }),
      "durable_verified",
    );
  });

  it("defaults to carrier_ack when no proof flags are set", () => {
    assert.strictEqual(classifyEvidenceLevel({}), "carrier_ack");
  });
});

describe("capEvidenceLevel", () => {
  it("keeps level when it is at or below the cap", () => {
    assert.strictEqual(capEvidenceLevel("carrier_ack", "contract_smoke"), "carrier_ack");
    assert.strictEqual(capEvidenceLevel("contract_smoke", "contract_smoke"), "contract_smoke");
    assert.strictEqual(capEvidenceLevel("state_present", "real_runtime"), "state_present");
  });

  it("caps real_runtime down to contract_smoke", () => {
    assert.strictEqual(capEvidenceLevel("real_runtime", "contract_smoke"), "contract_smoke");
  });

  it("caps durable_verified down to state_present", () => {
    assert.strictEqual(capEvidenceLevel("durable_verified", "state_present"), "state_present");
  });
});

describe("minEvidenceLevel", () => {
  it("returns carrier_ack for empty input", () => {
    assert.strictEqual(minEvidenceLevel([]), "carrier_ack");
  });

  it("returns the weakest level among stages", () => {
    const levels: EvidenceLevel[] = [
      "real_runtime",
      "state_present",
      "contract_smoke",
    ];
    assert.strictEqual(minEvidenceLevel(levels), "contract_smoke");
  });
});

describe("promoteEvidenceLevel", () => {
  it("promotes when target proof is available", () => {
    assert.strictEqual(
      promoteEvidenceLevel("contract_smoke", "real_runtime", {
        hasCycleExecution: true,
      }),
      "real_runtime",
    );
  });

  it("does not promote when target proof is missing", () => {
    assert.strictEqual(
      promoteEvidenceLevel("contract_smoke", "real_runtime", {}),
      "contract_smoke",
    );
  });

  it("does not demote even when proof flags are weak", () => {
    assert.strictEqual(
      promoteEvidenceLevel("real_runtime", "contract_smoke", {}),
      "real_runtime",
    );
  });
});

describe("evidenceLevelDescription", () => {
  it("returns a non-empty description for every level", () => {
    const levels: EvidenceLevel[] = [
      "carrier_ack",
      "contract_smoke",
      "state_present",
      "real_runtime",
      "durable_verified",
    ];
    for (const level of levels) {
      assert.ok(evidenceLevelDescription(level).length > 0);
    }
  });
});
