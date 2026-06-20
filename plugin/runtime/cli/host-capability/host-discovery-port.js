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
const SECOND_NATURE_SKILL_ID = "second-nature";
const SECOND_NATURE_OPS_TOOL = "second_nature_ops";
/**
 * Default fail-closed adapter. It does not invent host API access;
 * it returns explicit `unsupported` diagnostics so callers cannot
 * promote setup to `real_runtime` without real host evidence.
 */
export function createDefaultHostDiscoveryPort() {
    return {
        async listHostTools() {
            return {
                status: "unsupported",
                tools: [],
                observedAt: new Date().toISOString(),
                reason: "host_probe_unsupported",
            };
        },
        async listHostSkills() {
            return {
                status: "unsupported",
                skills: [],
                observedAt: new Date().toISOString(),
                reason: "skill_probe_unsupported",
            };
        },
    };
}
function capSetupEvidenceLevel(toolStatus, skillStatus) {
    if (toolStatus !== "available" || skillStatus !== "available") {
        return "carrier_ack";
    }
    return "state_present";
}
export async function probeHostDiscovery(options) {
    const { port, hostName, hostVersion } = options;
    const toolDiscovery = await port.listHostTools();
    const skillDiscovery = port.listHostSkills
        ? await port.listHostSkills()
        : {
            status: "unsupported",
            skills: [],
            observedAt: new Date().toISOString(),
            reason: "skill_probe_unsupported",
        };
    const toolOk = toolDiscovery.status === "available" &&
        toolDiscovery.tools.includes(SECOND_NATURE_OPS_TOOL);
    const skillOk = skillDiscovery.status === "available" &&
        skillDiscovery.skills.includes(SECOND_NATURE_SKILL_ID);
    const setupComplete = toolOk && skillOk;
    const evidenceLevel = capSetupEvidenceLevel(toolDiscovery.status, skillDiscovery.status);
    let reason;
    let nextStep;
    if (!toolOk) {
        reason = toolDiscovery.reason ?? "host_tool_unavailable";
        nextStep =
            "confirm_second_nature_ops_is_enabled_in_host_tool_registry_and_re_run_setup_hint";
    }
    else if (!skillOk) {
        reason = skillDiscovery.reason ?? "skill_projection_unavailable";
        nextStep =
            "confirm_packaged_SKILL.md_is_indexed_by_host_skill_registry_and_re_run_setup_hint";
    }
    else {
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
/**
 * Persist a host tool/skill visibility log under the workspace so manual host
 * smoke appendices can include timestamp, hostName, hostVersion, raw tool list,
 * command envelope, and evidenceLevel.
 */
export async function recordHostToolVisibilityLog(workspaceRoot, command, report) {
    const logDir = path.join(workspaceRoot, ".second-nature", "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, "host-tool-visibility.json");
    const entry = {
        observedAt: new Date().toISOString(),
        hostName: report.toolDiscovery.hostName,
        hostVersion: report.toolDiscovery.hostVersion,
        command,
        toolDiscovery: report.toolDiscovery,
        skillDiscovery: report.skillDiscovery,
        evidenceLevel: report.evidenceLevel,
        setupComplete: report.setupComplete,
    };
    let existing = [];
    try {
        const raw = fs.readFileSync(logPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
            existing = parsed;
    }
    catch {
        // File missing or unreadable — start fresh.
    }
    existing.push(entry);
    fs.writeFileSync(logPath, `${JSON.stringify(existing.slice(-50), null, 2)}\n`, "utf-8");
}
