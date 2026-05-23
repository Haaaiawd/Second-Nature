/**
 * Tests for SelfHealthSnapshot — T-OBS.C.2
 *
 * Covers:
 * - Minimum required dimensions present when all healthy → overall=healthy
 * - Per-probe timeout (DR-036): individual timeout marks dimension unknown, others unaffected
 * - DR-032: state_memory degraded → narrative_timeline + digest degraded, env/cron/delivery unaffected
 * - All probes timeout → overall=unknown, reason=all_probes_timed_out
 * - Dynamic probe registration
 * - SelfHealthSnapshot schema: generatedAt, dimensions, diagnosticReasonCodes, degradedDimensions
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  getSelfHealthSnapshot,
  registerHealthProbe,
  clearHealthProbeRegistry,
  ensureMinimumProbes,
  MINIMUM_REQUIRED_DIMENSIONS,
  type DimensionHealth,
  type HealthStatus,
} from "../../../src/observability/services/self-health-snapshot.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHealthyProbe(dimensionId: string, timeoutMs = 200) {
  registerHealthProbe({
    dimensionId,
    timeoutMs,
    probe: async (): Promise<DimensionHealth> => ({
      status: "healthy",
      checkedAt: new Date().toISOString(),
    }),
  });
}

function makeDegradedProbe(dimensionId: string, reason: string, timeoutMs = 200) {
  registerHealthProbe({
    dimensionId,
    timeoutMs,
    probe: async (): Promise<DimensionHealth> => ({
      status: "degraded",
      reason,
      checkedAt: new Date().toISOString(),
    }),
  });
}

function makeSlowProbe(dimensionId: string, delayMs: number, probeTimeoutMs: number) {
  registerHealthProbe({
    dimensionId,
    timeoutMs: probeTimeoutMs,
    probe: (): Promise<DimensionHealth> =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({ status: "healthy", checkedAt: new Date().toISOString() });
        }, delayMs);
      }),
  });
}

beforeEach(() => {
  clearHealthProbeRegistry();
});

// ─── Minimum dimensions + healthy ────────────────────────────────────────────

describe("getSelfHealthSnapshot — minimum dimensions + healthy", () => {
  it("returns overall=healthy when all minimum probes return healthy", async () => {
    ensureMinimumProbes(); // registers defaults for all minimum dimensions
    const snapshot = await getSelfHealthSnapshot();
    assert.equal(snapshot.overall, "healthy" satisfies HealthStatus);
    assert.ok(snapshot.generatedAt.length > 0);
  });

  it("snapshot dimensions include all minimum required dimensions", async () => {
    ensureMinimumProbes();
    const snapshot = await getSelfHealthSnapshot();
    for (const dim of MINIMUM_REQUIRED_DIMENSIONS) {
      assert.ok(
        dim in snapshot.dimensions,
        `Missing dimension: ${dim}. dimensions: ${JSON.stringify(Object.keys(snapshot.dimensions))}`,
      );
    }
  });

  it("P95 < 1s for healthy probe set (no real delay probes)", async () => {
    ensureMinimumProbes();
    const start = Date.now();
    const snapshot = await getSelfHealthSnapshot();
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 1000, `getSelfHealthSnapshot took ${elapsed}ms (expected < 1000ms)`);
    assert.equal(snapshot.overall, "healthy");
  });

  it("SelfHealthView includes dimensions map with per-dimension status", async () => {
    ensureMinimumProbes();
    const snapshot = await getSelfHealthSnapshot();
    // Each dimension should have status + checkedAt
    for (const [, dimHealth] of Object.entries(snapshot.dimensions)) {
      assert.ok(["healthy", "degraded", "unknown"].includes(dimHealth.status));
      assert.ok(dimHealth.checkedAt.length > 0);
    }
  });
});

// ─── Per-probe timeout (DR-036) ───────────────────────────────────────────────

describe("getSelfHealthSnapshot — per-probe timeout (DR-036)", () => {
  it("probe timeout marks that dimension unknown, other dimensions unaffected", async () => {
    // Register healthy probes for most dimensions
    for (const dim of MINIMUM_REQUIRED_DIMENSIONS.filter((d) => d !== "secret")) {
      makeHealthyProbe(dim);
    }
    // secret probe: intentionally slow (2s), timeout is 1000ms → should time out
    makeSlowProbe("secret", 2000, 1000);

    const snapshot = await getSelfHealthSnapshot();

    assert.equal(snapshot.dimensions["secret"]?.status, "unknown");
    assert.ok(snapshot.dimensions["secret"]?.reason?.includes("probe_timeout:secret"));

    // env should still be healthy
    assert.equal(snapshot.dimensions["env"]?.status, "healthy");
    // delivery should still be healthy
    assert.equal(snapshot.dimensions["delivery"]?.status, "healthy");
  });

  it("timed-out dimension reason contains probe_timeout:{dimensionId}", async () => {
    makeSlowProbe("env", 500, 200); // 500ms delay but 200ms timeout
    makeHealthyProbe("storage");

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "storage"] });

    assert.ok(snapshot.dimensions["env"]?.reason?.includes("probe_timeout:env"));
    assert.equal(snapshot.dimensions["storage"]?.status, "healthy");
  });

  it("overall is degraded (not healthy) when any probe times out", async () => {
    makeHealthyProbe("env");
    makeSlowProbe("storage", 500, 200);

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "storage"] });
    assert.notEqual(snapshot.overall, "healthy");
  });
});

// ─── DR-032: state_memory degraded ───────────────────────────────────────────

describe("getSelfHealthSnapshot — DR-032 state_memory degraded cascade", () => {
  it("state_memory degraded marks narrative_timeline as degraded", async () => {
    for (const dim of MINIMUM_REQUIRED_DIMENSIONS.filter((d) => d !== "state_memory")) {
      makeHealthyProbe(dim);
    }
    makeDegradedProbe("state_memory", "db_connection_failed");
    makeHealthyProbe("narrative_timeline", 500);

    const snapshot = await getSelfHealthSnapshot();

    assert.equal(snapshot.dimensions["state_memory"]?.status, "degraded");
    assert.equal(snapshot.dimensions["narrative_timeline"]?.status, "degraded");
    assert.ok(
      snapshot.dimensions["narrative_timeline"]?.reason?.includes("state_memory_unavailable"),
    );
  });

  it("state_memory degraded does not affect env/cron/delivery dimensions", async () => {
    for (const dim of MINIMUM_REQUIRED_DIMENSIONS.filter((d) => d !== "state_memory")) {
      makeHealthyProbe(dim);
    }
    makeDegradedProbe("state_memory", "storage_unavailable");

    const snapshot = await getSelfHealthSnapshot();

    assert.equal(snapshot.dimensions["env"]?.status, "healthy");
    assert.equal(snapshot.dimensions["cron"]?.status, "healthy");
    assert.equal(snapshot.dimensions["delivery"]?.status, "healthy");
  });

  it("state_memory degraded allows circuit_breaker to remain healthy", async () => {
    for (const dim of MINIMUM_REQUIRED_DIMENSIONS) {
      if (dim === "state_memory") {
        makeDegradedProbe(dim, "db_unavailable");
      } else {
        makeHealthyProbe(dim);
      }
    }

    const snapshot = await getSelfHealthSnapshot();
    assert.equal(snapshot.dimensions["circuit_breaker"]?.status, "healthy");
  });
});

// ─── All probes timeout ───────────────────────────────────────────────────────

describe("getSelfHealthSnapshot — all probes timeout", () => {
  it("returns overall=unknown and reason=all_probes_timed_out when all timeout", async () => {
    // Register probes that all take longer than their individual timeouts
    for (const dim of ["env", "storage"]) {
      makeSlowProbe(dim, 500, 200);
    }

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "storage"] });

    assert.equal(snapshot.overall, "unknown");
    assert.equal(snapshot.reason, "all_probes_timed_out");
  });

  it("lastKnownAt is preserved when all probes timeout", async () => {
    makeSlowProbe("env", 500, 200);
    const lastKnown = "2026-05-23T10:00:00.000Z";

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env"] }, lastKnown);

    assert.equal(snapshot.overall, "unknown");
    assert.equal(snapshot.lastKnownAt, lastKnown);
  });
});

// ─── Dynamic probe registration ───────────────────────────────────────────────

describe("getSelfHealthSnapshot — dynamic dimension registration", () => {
  it("dynamically registered probe is included in snapshot", async () => {
    makeHealthyProbe("custom_db_probe");

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["custom_db_probe"] });

    assert.ok("custom_db_probe" in snapshot.dimensions);
    assert.equal(snapshot.dimensions["custom_db_probe"]?.status, "healthy");
  });

  it("probe registered after another still appears in results", async () => {
    makeHealthyProbe("env");
    makeHealthyProbe("extra_metric");

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "extra_metric"] });

    assert.equal(snapshot.dimensions["env"]?.status, "healthy");
    assert.equal(snapshot.dimensions["extra_metric"]?.status, "healthy");
  });
});

// ─── Scoped health check ──────────────────────────────────────────────────────

describe("getSelfHealthSnapshot — scope filtering", () => {
  it("scope.dimensions filters to only requested probes", async () => {
    makeHealthyProbe("env");
    makeHealthyProbe("cron");
    makeHealthyProbe("secret");

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "secret"] });

    assert.ok("env" in snapshot.dimensions);
    assert.ok("secret" in snapshot.dimensions);
    assert.ok(!("cron" in snapshot.dimensions));
  });
});

// ─── diagnosticReasonCodes + degradedDimensions ───────────────────────────────

describe("getSelfHealthSnapshot — diagnosticReasonCodes + degradedDimensions", () => {
  it("degradedDimensions lists all non-healthy dimensions", async () => {
    makeHealthyProbe("env");
    makeDegradedProbe("storage", "disk_full");
    makeDegradedProbe("cron", "timer_drift");

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "storage", "cron"] });

    assert.ok(snapshot.degradedDimensions.includes("storage"));
    assert.ok(snapshot.degradedDimensions.includes("cron"));
    assert.ok(!snapshot.degradedDimensions.includes("env"));
  });

  it("diagnosticReasonCodes contains reasons from degraded dimensions", async () => {
    makeHealthyProbe("env");
    makeDegradedProbe("storage", "disk_full");

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "storage"] });

    assert.ok(snapshot.diagnosticReasonCodes.includes("disk_full"));
  });

  it("healthy snapshot has empty degradedDimensions and diagnosticReasonCodes", async () => {
    makeHealthyProbe("env");
    makeHealthyProbe("storage");

    const snapshot = await getSelfHealthSnapshot({ dimensions: ["env", "storage"] });

    assert.deepEqual(snapshot.degradedDimensions, []);
    assert.deepEqual(snapshot.diagnosticReasonCodes, []);
    assert.equal(snapshot.overall, "healthy");
  });
});
