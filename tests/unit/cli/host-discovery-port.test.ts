import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultHostDiscoveryPort,
  probeHostDiscovery,
  type HostCapabilityDiscoveryPort,
  type HostToolDiscoveryResult,
  type HostSkillDiscoveryResult,
} from "../../../src/cli/host-capability/host-discovery-port.js";

describe("host-discovery-port", () => {
  it("default adapter reports unsupported with explicit reasons", async () => {
    const port = createDefaultHostDiscoveryPort();
    const tools = await port.listHostTools();
    const skills = (await port.listHostSkills?.())!;
    assert.equal(tools.status, "unsupported");
    assert.equal(tools.reason, "host_probe_unsupported");
    assert.equal(skills.status, "unsupported");
    assert.equal(skills.reason, "skill_probe_unsupported");

    const report = await probeHostDiscovery({ port });
    assert.equal(report.setupComplete, false);
    assert.equal(report.evidenceLevel, "carrier_ack");
    assert.equal(report.reason, "host_probe_unsupported");
  });

  it("probe marks setup incomplete when tool is missing", async () => {
    const port: HostCapabilityDiscoveryPort = {
      async listHostTools() {
        return {
          status: "available",
          tools: ["some_other_tool"],
          observedAt: new Date().toISOString(),
        };
      },
      async listHostSkills() {
        return {
          status: "available",
          skills: ["second-nature"],
          observedAt: new Date().toISOString(),
        };
      },
    };
    const report = await probeHostDiscovery({ port });
    assert.equal(report.setupComplete, false);
    assert.equal(report.evidenceLevel, "state_present");
    assert.equal(report.reason, "host_tool_unavailable");
  });

  it("probe marks setup incomplete when skill is missing", async () => {
    const port: HostCapabilityDiscoveryPort = {
      async listHostTools() {
        return {
          status: "available",
          tools: ["second_nature_ops"],
          observedAt: new Date().toISOString(),
        };
      },
      async listHostSkills() {
        return {
          status: "available",
          skills: [],
          observedAt: new Date().toISOString(),
        };
      },
    };
    const report = await probeHostDiscovery({ port });
    assert.equal(report.setupComplete, false);
    assert.equal(report.evidenceLevel, "state_present");
    assert.equal(report.reason, "skill_projection_unavailable");
  });

  it("probe marks setup complete when both tool and skill are present", async () => {
    const port: HostCapabilityDiscoveryPort = {
      async listHostTools() {
        return {
          status: "available",
          tools: ["second_nature_ops"],
          hostName: "openclaw",
          hostVersion: "2026.5.12",
          observedAt: new Date().toISOString(),
        };
      },
      async listHostSkills() {
        return {
          status: "available",
          skills: ["second-nature"],
          observedAt: new Date().toISOString(),
        };
      },
    };
    const report = await probeHostDiscovery({ port, hostName: "openclaw" });
    assert.equal(report.setupComplete, true);
    assert.equal(report.evidenceLevel, "state_present");
    assert.equal(report.toolDiscovery.hostName, "openclaw");
    assert.equal(report.nextStep, "setup_verified_by_host_discovery");
  });
});
