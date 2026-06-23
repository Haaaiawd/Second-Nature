/**
 * v9 real-hand affordance integration test (T6.2.1).
 *
 * Verifies that assembleToolAffordance integrates with state stores and derives
 * realistic postures for a workspace with multiple capabilities in different
 * states:
 *   - moltbook/feed.read: credentialed, proven, routine
 *   - moltbook/post.publish: credentialed, proven by its own probe, scaffold
 *   - instreet/work.discover: needs_auth
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
} from "../../../src/core/second-nature/body/tool-affordance/v9-affordance-assembler.js";
import type { CapabilityProbeResult, ToolExperience } from "../../../src/shared/types/v7-entities.js";

const NOW = new Date("2026-06-23T10:00:00Z");
const iso = (msOffset = 0) => new Date(NOW.getTime() + msOffset).toISOString();

type SourceRefTuple = readonly [string, ...string[]];

function probe(overrides?: Partial<CapabilityProbeResult>): CapabilityProbeResult {
  return {
    probeResultId: `probe-${overrides?.capabilityId ?? "feed.read"}`,
    capabilityId: "feed.read",
    connectorId: "moltbook",
    actualStatus: "available",
    probeConfigRef: "cfg-1",
    createdAt: iso(0),
    ...overrides,
  };
}

function experience(overrides?: Partial<ToolExperience>): ToolExperience {
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

describe("INT-T6.2.1 real-hand affordance", () => {
  it("assembles realistic postures across mixed capability states", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const probeStore = createCapabilityProbeResultStore(db);
      const expStore = createToolExperienceStore(db);

      // moltbook/feed.read: probe available + 3 successes + routine
      await probeStore.appendProbeResult(
        probe({ probeResultId: "probe-feed", capabilityId: "feed.read", actualStatus: "available" }),
      );
      for (let i = 0; i < 3; i++) {
        await expStore.appendToolExperience(
          experience({ experienceId: `exp-feed-${i}`, capabilityId: "feed.read", outcome: "success" }),
        );
      }
      await writeToolRoutine(db, {
        id: "routine-feed",
        name: "Read MoltBook feed",
        version: "1.0.0",
        capabilityPattern: "feed.read",
        status: "active",
        sourceRefs: [{ family: "routine", id: "routine-feed" }],
        activatedAt: iso(0),
        createdAt: iso(0),
      });

      // moltbook/post.publish: own probe success, but no execution history yet
      await probeStore.appendProbeResult(
        probe({ probeResultId: "probe-post", capabilityId: "post.publish", actualStatus: "available" }),
      );

      // instreet/work.discover: registered but no credential
      await probeStore.appendProbeResult(
        probe({
          probeResultId: "probe-work",
          connectorId: "instreet",
          capabilityId: "work.discover",
          actualStatus: "available",
        }),
      );

      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
        { platformId: "moltbook", capabilityId: "post.publish", intent: "post.publish" },
        { platformId: "instreet", capabilityId: "work.discover", intent: "work.discover" },
      ]);

      // Credential presence map
      const credentials = new Set(["moltbook"]);
      const credentialPresence = { hasCredential: (p: string) => credentials.has(p) };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      assert.equal(postures.length, 3);

      const feed = postures.find((p) => p.capabilityId === "feed.read");
      assert.ok(feed);
      assert.equal(feed.accessLevel, "credentialed");
      assert.equal(feed.reliabilityLevel, "proven");
      assert.equal(feed.familiarityLevel, "routine");
      assert.equal(feed.routineId, "routine-feed");
      assert.ok(feed.sourceRefs.length >= 2);

      const publish = postures.find((p) => p.capabilityId === "post.publish");
      assert.ok(publish);
      assert.equal(publish.accessLevel, "credentialed");
      // Own probe success proves the capability itself; read≠write isolation
      // means feed.read success would not prove post.publish.
      assert.equal(publish.reliabilityLevel, "proven");
      assert.equal(publish.familiarityLevel, "scaffold");

      const work = postures.find((p) => p.capabilityId === "work.discover");
      assert.ok(work);
      assert.equal(work.accessLevel, "needs_auth");
      // Probe succeeded when credential was present, but current credential is missing.
      assert.equal(work.reliabilityLevel, "proven");
      assert.equal(work.familiarityLevel, "scaffold");
    } finally {
      db.close();
    }
  });

  it("does not derive write reliability from read success of another capability", async () => {
    const db = createStateDatabase(":memory:");
    try {
      const expStore = createToolExperienceStore(db);
      // 5 read successes for feed.read
      for (let i = 0; i < 5; i++) {
        await expStore.appendToolExperience(
          experience({ experienceId: `exp-read-${i}`, capabilityId: "feed.read", outcome: "success" }),
        );
      }

      const registry = createStaticRegistry([
        { platformId: "moltbook", capabilityId: "feed.read", intent: "feed.read" },
        { platformId: "moltbook", capabilityId: "post.publish", intent: "post.publish" },
      ]);
      const credentialPresence = { hasCredential: () => true };

      const postures = await assembleToolAffordance(
        { db, registry, credentialPresence, now: iso(0) },
      );

      const feed = postures.find((p) => p.capabilityId === "feed.read");
      const publish = postures.find((p) => p.capabilityId === "post.publish");

      assert.equal(feed?.familiarityLevel, "practiced");
      assert.equal(feed?.reliabilityLevel, "proven");
      // post.publish has no own probe/execution → remains unproven
      assert.equal(publish?.reliabilityLevel, "unproven");
      assert.equal(publish?.familiarityLevel, "scaffold");
    } finally {
      db.close();
    }
  });
});
