/**
 * Workspace connector behavior authoring.
 *
 * Adds a declarative capability stub to `.second-nature/connectors/{platformId}/manifest.yaml`.
 * This records a behavior the agent discovered without granting executable custom code.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
const PLATFORM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const BEHAVIOR_ID_PATTERN = /^[a-zA-Z0-9_.:-]+$/;
function resolveManifestPath(workspaceRoot, platformId) {
    const root = workspaceRoot ? path.resolve(workspaceRoot) : process.cwd();
    return path.join(root, ".second-nature", "connectors", platformId, "manifest.yaml");
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function sanitizeText(value, max = 500) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, max) : undefined;
}
export async function connectorBehaviorAdd(input) {
    const platformId = sanitizeText(input.platformId, 128) ?? "";
    const behaviorId = sanitizeText(input.behaviorId, 160) ?? "";
    const manifestPath = resolveManifestPath(input.workspaceRoot, platformId || "_missing");
    if (!platformId || platformId === "." || platformId === ".." || !PLATFORM_ID_PATTERN.test(platformId)) {
        return {
            ok: false,
            command: "connector_behavior_add",
            platformId,
            behaviorId,
            manifestPath,
            added: false,
            reason: "platformId is required and must use only letters, numbers, _, or -",
        };
    }
    if (!behaviorId || !BEHAVIOR_ID_PATTERN.test(behaviorId)) {
        return {
            ok: false,
            command: "connector_behavior_add",
            platformId,
            behaviorId,
            manifestPath,
            added: false,
            reason: "behaviorId is required and must use only letters, numbers, _, -, ., or :",
        };
    }
    if (!fs.existsSync(manifestPath)) {
        return {
            ok: false,
            command: "connector_behavior_add",
            platformId,
            behaviorId,
            manifestPath,
            added: false,
            reason: "connector manifest not found",
            nextStep: "run connector_init for this platform first",
        };
    }
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = asRecord(yaml.load(raw));
    const capabilities = Array.isArray(manifest.capabilities)
        ? [...manifest.capabilities]
        : [];
    const exists = capabilities.some((entry) => asRecord(entry).id === behaviorId);
    if (exists) {
        return {
            ok: true,
            command: "connector_behavior_add",
            platformId,
            behaviorId,
            manifestPath,
            added: false,
            reason: "behavior already exists",
        };
    }
    capabilities.push({
        id: behaviorId,
        ...(sanitizeText(input.description) ? { description: sanitizeText(input.description) } : {}),
        ...(sanitizeText(input.channel, 64) ? { channel: sanitizeText(input.channel, 64) } : {}),
    });
    manifest.capabilities = capabilities;
    const nextYaml = yaml.dump(manifest, {
        lineWidth: 100,
        noRefs: true,
        sortKeys: false,
    });
    fs.writeFileSync(manifestPath, nextYaml, "utf-8");
    return {
        ok: true,
        command: "connector_behavior_add",
        platformId,
        behaviorId,
        manifestPath,
        added: true,
        nextStep: "run connector_status or reload the runtime registry before executing this behavior",
    };
}
