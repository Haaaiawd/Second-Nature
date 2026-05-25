#!/usr/bin/env node
/**
 * Plugin package build script
 *
 * Produces a self-contained publishable plugin package:
 * 1. Compiles plugin/index.ts → plugin/index.js (ESM, no TypeScript)
 * 2. Copies compiled runtime code from dist/src/ → plugin/runtime/
 * 3. Ensures openclaw.plugin.json and package.json reference ./index.js
 *
 * Usage: node scripts/build-plugin-package.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();
const distDir = path.resolve(rootDir, "dist");
const pluginDir = path.resolve(rootDir, "plugin");
const pluginRuntimeDir = path.resolve(pluginDir, "runtime");

// ─── Step 1: Compile plugin/index.ts → plugin/index.js ───────────────────────

function compilePluginEntry() {
  console.log("📝 Compiling plugin/index.ts → plugin/index.js...");

  // Use tsc to compile just the plugin entry
  // We compile the whole project first to ensure plugin/index.js is up to date
  try {
    execSync("pnpm build", { cwd: rootDir, stdio: "inherit" });
  } catch {
    console.error("❌ Build failed. Run 'pnpm build' manually first.");
    process.exit(1);
  }

  // The compiled plugin entry is at dist/plugin/index.js
  const compiledEntry = path.resolve(distDir, "plugin", "index.js");
  const targetEntry = path.resolve(pluginDir, "index.js");

  if (!fs.existsSync(compiledEntry)) {
    console.error(`❌ Compiled entry not found: ${compiledEntry}`);
    process.exit(1);
  }

  fs.copyFileSync(compiledEntry, targetEntry);
  console.log(`✅ Copied ${compiledEntry} → ${targetEntry}`);

  const distPluginDir = path.resolve(distDir, "plugin");
  if (fs.existsSync(distPluginDir)) {
    for (const file of fs.readdirSync(distPluginDir)) {
      if (!file.endsWith(".js") || file === "index.js") continue;
      const from = path.join(distPluginDir, file);
      const to = path.join(pluginDir, file);
      fs.copyFileSync(from, to);
      console.log(`✅ Copied plugin helper ${file} → plugin/`);
    }
  }
}

// ─── Step 2: Copy runtime artifacts ──────────────────────────────────────────

const RUNTIME_ARTIFACTS = [
  { src: "src/cli/index.js", dest: "cli/index.js" },
  { src: "src/cli/action-bridge.js", dest: "cli/action-bridge.js" },
  { src: "src/cli/runtime/", dest: "cli/runtime/" },
  { src: "src/cli/host-capability/", dest: "cli/host-capability/" },
  { src: "src/cli/host-smoke/", dest: "cli/host-smoke/" },
  { src: "src/cli/ops/", dest: "cli/ops/" },
  { src: "src/cli/commands/", dest: "cli/commands/" },
  { src: "src/cli/read-models/", dest: "cli/read-models/" },
  { src: "src/cli/explain/", dest: "cli/explain/" },
  { src: "src/storage/", dest: "storage/" },
  { src: "src/observability/", dest: "observability/" },
  { src: "src/core/second-nature/", dest: "core/second-nature/" },
  { src: "src/guidance/", dest: "guidance/" },
  { src: "src/connectors/", dest: "connectors/" },
  { src: "src/shared/", dest: "shared/" },
];

function copyRecursive(srcPath: string, destPath: string) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
    for (const entry of fs.readdirSync(srcPath)) {
      copyRecursive(path.join(srcPath, entry), path.join(destPath, entry));
    }
  } else {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
}

function copyRuntimeArtifacts() {
  console.log("\n📦 Copying runtime artifacts...");

  if (fs.existsSync(pluginRuntimeDir)) {
    fs.rmSync(pluginRuntimeDir, { recursive: true, force: true });
  }
  fs.mkdirSync(pluginRuntimeDir, { recursive: true });

  let copied = 0;
  let skipped = 0;

  for (const artifact of RUNTIME_ARTIFACTS) {
    const srcPath = path.resolve(distDir, artifact.src);
    const destPath = path.resolve(pluginRuntimeDir, artifact.dest);

    if (!fs.existsSync(srcPath)) {
      console.log(`⚠️  Skipped (not found): ${artifact.src}`);
      skipped++;
      continue;
    }

    copyRecursive(srcPath, destPath);
    copied++;
  }

  console.log(`✅ Copied: ${copied}, Skipped: ${skipped}`);
}

// ─── Step 3: Update manifest and package.json ────────────────────────────────

function updateManifests() {
  console.log("\n🔧 Updating manifests...");

  // Update openclaw.plugin.json
  // Note: OpenClaw 2026.5.x identifies the runtime entry via package.json
  // openclaw.runtimeExtensions, NOT via a top-level "entry" field in
  // openclaw.plugin.json. We strip any legacy "entry" key here so old builds
  // upgrading in place don't keep a stale field.
  const manifestPath = path.resolve(pluginDir, "openclaw.plugin.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if ("entry" in manifest) {
    delete manifest.entry;
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("✅ openclaw.plugin.json normalized (no legacy entry field)");

  // Update plugin/package.json
  const pkgPath = path.resolve(pluginDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.main = "./index.js";
  pkg.openclaw = pkg.openclaw ?? {};
  pkg.openclaw.manifest = "./openclaw.plugin.json";
  pkg.openclaw.extensions = ["./index.js"];
  pkg.openclaw.runtimeExtensions = ["./index.js"];
  pkg.openclaw.compat = pkg.openclaw.compat ?? { pluginApi: ">=2026.5.4" };
  // Replace index.ts with index.js in files
  pkg.files = pkg.files.map((f: string) => (f === "index.ts" ? "index.js" : f));
  // Ensure index.js is in files
  if (!pkg.files.includes("index.js")) {
    pkg.files.unshift("index.js");
  }
  // Remove index.ts from files if present
  pkg.files = pkg.files.filter((f: string) => f !== "index.ts");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("✅ plugin/package.json updated (main, openclaw.{extensions,runtimeExtensions,compat}, files)");
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("🔨 Building plugin package...\n");

  // Step 1: Compile plugin entry
  compilePluginEntry();

  // Step 2: Copy runtime artifacts
  copyRuntimeArtifacts();

  // Step 3: Update manifests
  updateManifests();

  // Step 4: Verify
  console.log("\n🔍 Verifying package...");
  const indexJs = path.resolve(pluginDir, "index.js");
  const manifest = JSON.parse(fs.readFileSync(path.resolve(pluginDir, "openclaw.plugin.json"), "utf-8"));
  const pkg = JSON.parse(fs.readFileSync(path.resolve(pluginDir, "package.json"), "utf-8"));

  if (!fs.existsSync(indexJs)) {
    console.error("❌ plugin/index.js not found");
    process.exit(1);
  }
  const indexSource = fs.readFileSync(indexJs, "utf-8");
  if (indexSource.includes("openclaw/plugin-sdk")) {
    console.error(
      "❌ plugin/index.js must not statically import openclaw/plugin-sdk; upload validators may not have the host SDK installed",
    );
    process.exit(1);
  }
  if (!Array.isArray(pkg.openclaw?.runtimeExtensions) || !pkg.openclaw.runtimeExtensions.includes("./index.js")) {
    console.error("❌ package.json openclaw.runtimeExtensions must include ./index.js");
    process.exit(1);
  }
  if (manifest.contracts == null || typeof manifest.contracts !== "object") {
    console.error("❌ openclaw.plugin.json missing 'contracts' (capability shape required by OpenClaw >= 2026.5.4)");
    process.exit(1);
  }
  if (manifest.activation?.onStartup !== true) {
    console.error(
      "❌ openclaw.plugin.json missing activation.onStartup=true (gateway daemon will silently skip this plugin)",
    );
    process.exit(1);
  }
  if (
    !Array.isArray(manifest.activation?.onCapabilities) ||
    !manifest.activation.onCapabilities.includes("tool")
  ) {
    console.error(
      "❌ openclaw.plugin.json missing activation.onCapabilities=['tool'] (Second Nature is a tool plugin per docs/validation/openclaw-plugin-classification.md)",
    );
    process.exit(1);
  }
  if (pkg.main !== "./index.js") {
    console.error("❌ package.json main is not ./index.js");
    process.exit(1);
  }
  if (pkg.files.includes("index.ts")) {
    console.error("❌ package.json still includes index.ts in files");
    process.exit(1);
  }
  if (!pkg.files.includes("agent-inner-guide.md")) {
    console.error("❌ package.json files must include agent-inner-guide.md");
    process.exit(1);
  }
  if (!pkg.files.includes("SKILL.md")) {
    console.error("❌ package.json files must include SKILL.md");
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(pluginDir, "agent-inner-guide.md"))) {
    console.error("❌ plugin/agent-inner-guide.md not found");
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(pluginDir, "SKILL.md"))) {
    console.error("❌ plugin/SKILL.md not found");
    process.exit(1);
  }

  console.log("✅ All verifications passed");
  console.log("\n📋 Build Summary:");
  console.log(`   Plugin entry: ${indexJs}`);
  console.log(`   Runtime dir: ${pluginRuntimeDir}`);
  console.log(`   Manifest entry: ${manifest.entry}`);
  console.log(`   Package main: ${pkg.main}`);
  console.log(`   Package files: ${JSON.stringify(pkg.files)}`);
  console.log("\n✅ Plugin package build complete");
}

main();
