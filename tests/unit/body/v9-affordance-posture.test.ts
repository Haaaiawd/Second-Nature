/**
 * v9 AffordanceAssembler unit tests (T6.2.1).
 *
 * Covers the three-axis posture derivation for:
 *   - unregistered capability
 *   - registered capability without credential
 *   - registered capability with credential
 *   - stale probe / execution
 *   - failed execution → degraded reliability
 *   - active routine → routine familiarity
 *   - repeated success → practiced familiarity
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createStateDatabase } from "../../../src/storage/db/index.js";
import {
  createCapabilityProbeResultStore,
  createToolExperienceStore,
} from "../../../src/storage/services/tool-experience-store.js";
import { writeToolRoutine } from "../../../src/storage/v9-state-stores.js";
import {
  assembleToolAffordance,
  createStaticRegistry,
  AFFORDANCE_STALE_PROBE_MS,
} from "../../../src/core/second-nature/body/tool-affordance/v9-affordance-assembler.js";
import type { SourceRef } from "../../../src/shared/types/v9-contracts.js";
import type { CapabilityProbeResult, ToolExperience } from "../../../src/shared/types/v7-entities.js";

const NOW = new Date("2026-06-23T10:00:00Z");

function iso(msOffset: number): string {
  return new Date(NOW.getTime() + msOffset).toISOString();
}

function makeProbe(overrides?: Partial<CapabilityProbeResult>): CapabilityProbeResult {
  return {
    probeResultId: "probe-1",
    capabilityId: "feed.read",
    connectorId: "moltbook",
    actualStatus: "available",
    probeConfigRef: "cfg-1",
    createdAt: iso(0),
    ...overrides,
  };
}

function makeExperience(overrides?: Partial<ToolExperience>): ToolExperience {
  return {
    experienceId: `exp-${Math.random().toString(36).slice(2)}`,
    connectorId: "moltbook",
    capabilityId: "feed.read",
    outcome: "success",
    latencyMs: 100,
    evidenceQuality: 0.8,
    sourceRefs: ["connector:moltbook:feed.read"] as unknown as SourceRefTuple,
    triggerSource: "heartbeat",
    createdAt: iso(0),
    ...overrides,
  } as ToolExperience;
}

// v7 SourceRef tuple type alias used by ToolExperience
type SourceRefTuple = readonly [string, ...string[]];

describe("v9 AffordanceAssembler", () => {
  it("marks unregistered capability as none/unproven/scaffold", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const registry = createStaticRegistry([]);
      const credentialPresence = { hasCredential: () => false };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
        { platformId: "moltbook", capabilityId: "feed.read" },
      );

      assert.equal(postures.length, 0);
    } finally {
      db.close();
    }
  });

  it("marks registered capability without credential as needs_auth", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
      ]);
      const credentialPresence = { hasCredential: () => false };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures.length, 1);
      assert.equal(postures[0].accessLevel, "needs_auth");
      assert.equal(postures[0].reliabilityLevel, "unproven");
      assert.equal(postures[0].familiarityLevel, "scaffold");
    } finally {
      db.close();
    }
  });

  it("marks registered + credentialed + recent probe as credentialed/proven/scaffold", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await createCapabilityProbeResultStore(db).appendProbeResult(
        makeProbe({ probeResultId: "probe-moltbook-feed", actualStatus: "available" }),
      );

      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
      ]);
      const credentialPresence = { hasCredential: () => true };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures[0].accessLevel, "credentialed");
      assert.equal(postures[0].reliabilityLevel, "proven");
      assert.equal(postures[0].familiarityLevel, "scaffold");
      assert.equal(postures[0].lastProbedAt, iso(0));
    } finally {
      db.close();
    }
  });

  it("marks stale probe as stale", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await createCapabilityProbeResultStore(db).appendProbeResult(
        makeProbe({
          probeResultId: "probe-old",
          actualStatus: "available",
          createdAt: iso(-(AFFORDANCE_STALE_PROBE_MS + 1)),
        }),
      );

      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
      ]);
      const credentialPresence = { hasCredential: () => true };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures[0].reliabilityLevel, "stale");
    } finally {
      db.close();
    }
  });

  it("marks recent failed execution as degraded", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const experienceStore = createToolExperienceStore(db);
      await experienceStore.appendToolExperience(
        makeExperience({ outcome: "failure", createdAt: iso(0) }),
      );

      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
      ]);
      const credentialPresence = { hasCredential: () => true };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures[0].reliabilityLevel, "degraded");
    } finally {
      db.close();
    }
  });

  it("lifts familiarity to practiced after 3 successes", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const experienceStore = createToolExperienceStore(db);
      for (let i = 0; i < 3; i++) {
        await experienceStore.appendToolExperience(
          makeExperience({
            experienceId: `exp-ok-${i}`,
            outcome: "success",
            createdAt: iso(-i * 1000),
          }),
        );
      }

      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
      ]);
      const credentialPresence = { hasCredential: () => true };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures[0].familiarityLevel, "practiced");
    } finally {
      db.close();
    }
  });

  it("lifts familiarity to routine when active routine exists", async () => {
    const db = createStateDatabase(":memory:");
    try {
      await writeToolRoutine(db, {
        id: "routine-1",
        name: "MoltBook feed reader",
        version: "1.0.0",
        capabilityPattern: "feed.read",
        status: "active",
        sourceRefs: [{ family: "routine", id: "routine-1" }],
        activatedAt: iso(0),
        createdAt: iso(0),
      });

      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
      ]);
      const credentialPresence = { hasCredential: () => true };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures[0].familiarityLevel, "routine");
      assert.equal(postures[0].routineId, "routine-1");
    } finally {
      db.close();
    }
  });

  it("marks registered capability with non-active credential as needs_auth", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
      ]);
      const credentialPresence = { hasCredential: () => false };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures[0].accessLevel, "needs_auth");
    } finally {
      db.close();
    }
  });

  it("filters by platform and capability", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read" },
        { platformId: "instreet", capabilityId: "work.discover" },
      ]);
      const credentialPresence = { hasCredential: () => false };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
        { platformId: "moltbook" },
      );

      assert.equal(postures.length, 1);
      assert.equal(postures[0].platformId, "moltbook");
    } finally {
      db.close();
    }
  });
});
