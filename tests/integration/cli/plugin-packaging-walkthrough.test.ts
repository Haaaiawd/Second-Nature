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

  assert.equal(pluginPkg.name, "@second-nature/openclaw-plugin");
  assert.equal(pluginPkg.main, "./index.ts");
  assert.deepEqual(pluginPkg.files, ["index.ts", "openclaw.plugin.json"]);

  assert.equal(manifest.id, "second-nature");
  assert.equal(manifest.entry, "./index.ts");
  assert.equal((manifest.capabilities as any).commands[0], "second-nature");
  assert.equal((manifest.capabilities as any).tools[0], "second_nature_ops");
});

test("T5.3.1 plugin entry declares load/reload lifecycle registration markers", () => {
  const pluginEntryPath = path.join(root, "plugin", "index.ts");
  const source = fs.readFileSync(pluginEntryPath, "utf-8");

  assert.equal(source.includes("const lifecycleState"), true);
  assert.equal(source.includes("lifecycleEvent"), true);
  assert.equal(source.includes("second-nature-lifecycle"), true);
  assert.equal(source.includes("load"), true);
  assert.equal(source.includes("reload"), true);
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
