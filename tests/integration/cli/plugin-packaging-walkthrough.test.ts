import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function runSmoke(mode: "local-path" | "clawhub" | "npm") {
  const result = spawnSync(process.execPath, ["dist/scripts/plugin-smoke-check.js", mode], {
    cwd: root,
    encoding: "utf-8",
  });

  assert.equal(result.status, 0, `smoke check should pass for ${mode}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout) as {
    mode: string;
    ok: boolean;
    installSpec: string;
    fallbackOrder?: string[];
    gatewayRestartRequired: boolean;
    checks: Record<string, boolean>;
  };
}

test("T5.3.1 plugin package + manifest are discoverable for host loading", () => {
  const pluginPkgPath = path.join(root, "plugin", "package.json");
  const manifestPath = path.join(root, "plugin", "openclaw.plugin.json");

  assert.equal(fs.existsSync(pluginPkgPath), true);
  assert.equal(fs.existsSync(manifestPath), true);

  const pluginPkg = readJson(pluginPkgPath);
  const manifest = readJson(manifestPath);

  assert.equal(pluginPkg.name, "@haaaiawd/second-nature");
  assert.equal(pluginPkg.main, "./index.js");
  assert.ok((pluginPkg.files as string[]).includes("index.js"));
  assert.ok((pluginPkg.files as string[]).includes("openclaw.plugin.json"));
  assert.ok((pluginPkg.files as string[]).includes("runtime/"));

  assert.equal(manifest.id, "second-nature");
  // OpenClaw 2026.5.x scans `contracts` (not the legacy `capabilities` key) to
  // expose tools/commands/services. The runtime entry now lives in package.json
  // `openclaw.runtimeExtensions`, so manifest.entry must NOT be present (it
  // would mark the manifest as legacy and drop the new fields on the floor).
  assert.equal(manifest.entry, undefined);
  assert.equal((manifest.contracts as any).commands[0], "second-nature");
  assert.equal((manifest.contracts as any).tools[0], "second_nature_ops");
  assert.deepEqual(
    (pluginPkg.openclaw as { runtimeExtensions?: string[] }).runtimeExtensions,
    ["./index.js"],
  );

  // CRITICAL — manifest.activation gates whether the gateway daemon's
  // `loadGatewayStartupPluginPlan` will load this plugin at all. Tool-only
  // plugins (no channel / no provider / no context-engine slot) MUST opt in
  // via `activation.onStartup: true`. Without it the plugin appears enabled
  // in the registry yet never reaches register(api) inside the daemon, which
  // is exactly the silent-failure mode we hit on 2026-05-06. The
  // `onCapabilities: ["tool"]` declaration is a second, semantically honest
  // ticket aligned with discovery-B9FIOZR8.js's onCapabilities allow-list
  // ("provider" | "channel" | "tool" | "hook"). Do not relax these.
  const activation = manifest.activation as { onStartup?: boolean; onCapabilities?: string[] } | undefined;
  assert.equal(activation?.onStartup, true, "manifest.activation.onStartup must be true for tool-only plugins");
  assert.deepEqual(activation?.onCapabilities, ["tool"], "manifest.activation.onCapabilities must declare ['tool']");
});

test("T5.3.1 plugin entry declares load/reload lifecycle registration markers", () => {
  const pluginEntryPath = path.join(root, "plugin", "index.ts");
  const source = fs.readFileSync(pluginEntryPath, "utf-8");

  assert.equal(source.includes("second-nature-lifecycle"), true);
  assert.equal(source.includes("createLifecycleService"), true);
  assert.equal(source.includes("./runtime/core/second-nature/runtime/"), true);
  assert.equal(source.includes("createRuntimeService"), true);
  assert.equal(source.includes("register(api: RegisterApi)"), true);
  assert.equal(source.includes("async register(api: RegisterApi)"), false);
  assert.equal(source.includes("recordRuntimeEvidence"), true);
  assert.equal(
    source.includes("openclaw/plugin-sdk"),
    false,
    "plugin entry must not statically import host SDK during upload/package validation",
  );
});

test("T5.3.1 smoke path covers local install and clawhub/npm fallback order", () => {
  const localPath = runSmoke("local-path");
  assert.equal(localPath.mode, "local-path");
  assert.equal(localPath.ok, true);
  assert.equal(localPath.installSpec.startsWith("file:"), true);
  assert.equal(localPath.gatewayRestartRequired, true);
  assert.equal(Object.values(localPath.checks).every(Boolean), true);

  const clawhub = runSmoke("clawhub");
  assert.equal(clawhub.mode, "clawhub");
  assert.equal(clawhub.ok, true);
  assert.deepEqual(clawhub.fallbackOrder, ["clawhub", "npm"]);

  const npm = runSmoke("npm");
  assert.equal(npm.mode, "npm");
  assert.equal(npm.ok, true);
  assert.deepEqual(npm.fallbackOrder, ["npm", "file"]);
});
