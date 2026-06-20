/**
 * Host Capability Discovery Port (T-ROS.R.7)
 *
 * Core logic: provide an explicit boundary for proving that the Second Nature
 * tool (`second_nature_ops`) and packaged skill are visible to the host.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md §3.1`
 *
 * Dependencies: none (plain contracts)
 * Boundary: pure interface + a default fail-closed adapter that reports
 * `host_probe_unsupported` rather than inventing a discovery proof.
 * Test coverage: tests/unit/cli/host-discovery-port.test.ts
 */

import fs from "node:fs";
import path from "node:path";

export type HostDiscoveryStatus =
  | "available"
  | "unavailable"
  | "unsupported"
  | "blocked";

export type HostToolUnavailableReason =
  | "host_tool_unavailable"
  | "host_probe_unsupported"
  | "host_policy_blocked"
  | "host_probe_timeout";

export type HostSkillUnavailableReason =
  | "skill_projection_unavailable"
  | "skill_probe_unsupported"
  | "host_policy_blocked"
  | "host_probe_timeout";

export interface HostToolDiscoveryResult {
  status: HostDiscoveryStatus;
  tools: string[];
  hostName?: string;
  hostVersion?: string;
  observedAt: string;
  reason?: HostToolUnavailableReason;
}

export interface HostSkillDiscoveryResult {
  status: HostDiscoveryStatus;
  skills: string[];
  observedAt: string;
  reason?: HostSkillUnavailableReason;
}

export interface HostCapabilityDiscoveryPort {
  /** Prove that `second_nature_ops` is visible in the current host session. */
  listHostTools(): Promise<HostToolDiscoveryResult>;
  /** Prove that the packaged skill is discoverable by the host skill registry. */
  listHostSkills?(): Promise<HostSkillDiscoveryResult>;
}

export interface HostDiscoveryProbeOptions {
  port: HostCapabilityDiscoveryPort;
  hostName?: string;
  hostVersion?: string;
}

export interface HostDiscoveryReport {
  toolDiscovery: HostToolDiscoveryResult;
  skillDiscovery: HostSkillDiscoveryResult;
  setupComplete: boolean;
  /** Evidence level for setup state after applying discovery truth. */
  evidenceLevel: "carrier_ack" | "contract_smoke" | "state_present";
  reason?: HostToolUnavailableReason | HostSkillUnavailableReason;
  nextStep: string;
}

const SECOND_NATURE_SKILL_ID = "second-nature";
const SECOND_NATURE_OPS_TOOL = "second_nature_ops";

/**
 * Default fail-closed adapter. It does not invent host API access;
 * it returns explicit `unsupported` diagnostics so callers cannot
 * promote setup to `real_runtime` without real host evidence.
 */
export function createDefaultHostDiscoveryPort(): HostCapabilityDiscoveryPort {
  return {
    async listHostTools(): Promise<HostToolDiscoveryResult> {
      return {
        status: "unsupported",
        tools: [],
        observedAt: new Date().toISOString(),
        reason: "host_probe_unsupported",
      };
    },
    async listHostSkills(): Promise<HostSkillDiscoveryResult> {
      return {
        status: "unsupported",
        skills: [],
        observedAt: new Date().toISOString(),
        reason: "skill_probe_unsupported",
      };
    },
  };
}

function capSetupEvidenceLevel(
  toolStatus: HostDiscoveryStatus,
  skillStatus: HostDiscoveryStatus,
): HostDiscoveryReport["evidenceLevel"] {
  if (toolStatus !== "available" || skillStatus !== "available") {
    return "carrier_ack";
  }
  return "state_present";
}

export async function probeHostDiscovery(
  options: HostDiscoveryProbeOptions,
): Promise<HostDiscoveryReport> {
  const { port, hostName, hostVersion } = options;
  const toolDiscovery = await port.listHostTools();
  const skillDiscovery = port.listHostSkills
    ? await port.listHostSkills()
    : {
        status: "unsupported" as HostDiscoveryStatus,
        skills: [],
        observedAt: new Date().toISOString(),
        reason: "skill_probe_unsupported" as HostSkillUnavailableReason,
      };

  const toolOk =
    toolDiscovery.status === "available" &&
    toolDiscovery.tools.includes(SECOND_NATURE_OPS_TOOL);
  const skillOk =
    skillDiscovery.status === "available" &&
    skillDiscovery.skills.includes(SECOND_NATURE_SKILL_ID);

  const setupComplete = toolOk && skillOk;
  const evidenceLevel = capSetupEvidenceLevel(
    toolDiscovery.status,
    skillDiscovery.status,
  );

  let reason: HostToolUnavailableReason | HostSkillUnavailableReason | undefined;
  let nextStep: string;
  if (!toolOk) {
    reason = toolDiscovery.reason ?? "host_tool_unavailable";
    nextStep =
      "confirm_second_nature_ops_is_enabled_in_host_tool_registry_and_re_run_setup_hint";
  } else if (!skillOk) {
    reason = skillDiscovery.reason ?? "skill_projection_unavailable";
    nextStep =
      "confirm_packaged_SKILL.md_is_indexed_by_host_skill_registry_and_re_run_setup_hint";
  } else {
    nextStep = "setup_verified_by_host_discovery";
  }

  return {
    toolDiscovery: {
      ...toolDiscovery,
      hostName,
      hostVersion,
    },
    skillDiscovery,
    setupComplete,
    evidenceLevel,
    reason,
    nextStep,
  };
}

export interface HostToolVisibilityLogEntry {
  observedAt: string;
  hostName?: string;
  hostVersion?: string;
  command: string;
  toolDiscovery: HostToolDiscoveryResult;
  skillDiscovery: HostSkillDiscoveryResult;
  evidenceLevel: HostDiscoveryReport["evidenceLevel"];
  setupComplete: boolean;
}

/**
 * Persist a host tool/skill visibility log under the workspace so manual host
 * smoke appendices can include timestamp, hostName, hostVersion, raw tool list,
 * command envelope, and evidenceLevel.
 */
export async function recordHostToolVisibilityLog(
  workspaceRoot: string,
  command: string,
  report: HostDiscoveryReport,
): Promise<void> {
  const logDir = path.join(workspaceRoot, ".second-nature", "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, "host-tool-visibility.json");

  const entry: HostToolVisibilityLogEntry = {
    observedAt: new Date().toISOString(),
    hostName: report.toolDiscovery.hostName,
    hostVersion: report.toolDiscovery.hostVersion,
    command,
    toolDiscovery: report.toolDiscovery,
    skillDiscovery: report.skillDiscovery,
    evidenceLevel: report.evidenceLevel,
    setupComplete: report.setupComplete,
  };

  let existing: HostToolVisibilityLogEntry[] = [];
  try {
    const raw = fs.readFileSync(logPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) existing = parsed as HostToolVisibilityLogEntry[];
  } catch {
    // File missing or unreadable — start fresh.
  }

  existing.push(entry);
  fs.writeFileSync(logPath, `${JSON.stringify(existing.slice(-50), null, 2)}\n`, "utf-8");
}
