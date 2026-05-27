#!/usr/bin/env node
/**
 * Plugin runtime artifact build script
 *
 * This script copies the compiled runtime code from dist/src/ into plugin/runtime/
 * to create a self-contained plugin package that does not depend on the source repository.
 *
 * Usage: node scripts/build-plugin-runtime.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const distDir = path.resolve(rootDir, "dist");
const pluginRuntimeDir = path.resolve(rootDir, "plugin", "runtime");

/**
 * Directories and files that must be included in the plugin runtime artifact.
 * This is the minimum runtime dependency graph as defined in ADR-006.
 */
const RUNTIME_ARTIFACTS = [
  // CLI runtime
  { src: "src/cli/index.js", dest: "cli/index.js" },
  { src: "src/cli/index.d.ts", dest: "cli/index.d.ts" },
  { src: "src/cli/action-bridge.js", dest: "cli/action-bridge.js" },
  { src: "src/cli/action-bridge.d.ts", dest: "cli/action-bridge.d.ts" },
  { src: "src/cli/commands/", dest: "cli/commands/" },
  { src: "src/cli/read-models/", dest: "cli/read-models/" },
  { src: "src/cli/explain/", dest: "cli/explain/" },

  // State system runtime
  { src: "src/storage/", dest: "storage/" },

  // Observability system runtime
  { src: "src/observability/", dest: "observability/" },

  // Core second-nature (for heartbeat service entry)
  { src: "src/core/second-nature/", dest: "core/second-nature/" },

  // Guidance system
  { src: "src/guidance/", dest: "guidance/" },

  // Connector system
  { src: "src/connectors/", dest: "connectors/" },

  // Dream scheduler (required by ops-router.ts → createQuietDreamSchedulePort)
  { src: "src/dream/", dest: "dream/" },

  // Shared types
  { src: "src/shared/", dest: "shared/" },

  // Type declarations
  { src: "src/openclaw-plugin-sdk.d.ts", dest: "openclaw-plugin-sdk.d.ts" },
];

/**
 * Copy a file or directory recursively
 */
function copyRecursive(srcPath: string, destPath: string): void {
  const stat = fs.statSync(srcPath);

  if (stat.isDirectory()) {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }

    const entries = fs.readdirSync(srcPath);
    for (const entry of entries) {
      const srcEntry = path.join(srcPath, entry);
      const destEntry = path.join(destPath, entry);
      copyRecursive(srcEntry, destEntry);
    }
  } else {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
  }
}

/**
 * Clean the plugin runtime directory
 */
function cleanRuntimeDir(): void {
  if (fs.existsSync(pluginRuntimeDir)) {
    fs.rmSync(pluginRuntimeDir, { recursive: true, force: true });
  }
  fs.mkdirSync(pluginRuntimeDir, { recursive: true });
  console.log("✅ Cleaned plugin runtime directory");
}

/**
 * Copy runtime artifacts from dist/ to plugin/runtime/
 */
function copyArtifacts(): { copied: number; skipped: number } {
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
    console.log(`✅ Copied: ${artifact.src} -> ${artifact.dest}`);
    copied++;
  }

  return { copied, skipped };
}

/**
 * Verify the runtime artifact structure
 */
function verifyArtifacts(): boolean {
  const requiredFiles = [
    "cli/index.js",
    "cli/commands/index.js",
    "storage/index.js",
    "storage/db/index.js",
    "observability/index.js",
    "observability/db/index.js",
    "core/second-nature/index.js",
    "guidance/index.js",
    "connectors/index.js",
  ];

  let allPresent = true;
  for (const file of requiredFiles) {
    const filePath = path.resolve(pluginRuntimeDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Missing required file: ${file}`);
      allPresent = false;
    }
  }

  return allPresent;
}

/**
 * Check for any remaining ../src/ references in the runtime artifact
 */
function checkForExternalReferences(): { found: boolean; files: string[] } {
  const found: string[] = [];

  function checkFile(filePath: string): void {
    if (!fs.existsSync(filePath)) return;

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(filePath);
      for (const entry of entries) {
        checkFile(path.join(filePath, entry));
      }
    } else if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (content.includes("../src/") || content.includes("..\\src\\")) {
        found.push(path.relative(pluginRuntimeDir, filePath));
      }
    }
  }

  checkFile(pluginRuntimeDir);
  return { found: found.length > 0, files: found };
}

/**
 * Main build function
 */
function main(): void {
  console.log("🔨 Building plugin runtime artifact...\n");

  // Step 1: Verify dist/ exists
  if (!fs.existsSync(distDir)) {
    console.error("❌ dist/ directory not found. Run 'pnpm build' first.");
    process.exit(1);
  }
  console.log("✅ Found dist/ directory");

  // Step 2: Clean plugin runtime directory
  cleanRuntimeDir();

  // Step 3: Copy artifacts
  console.log("\n📦 Copying runtime artifacts...");
  const { copied, skipped } = copyArtifacts();
  console.log(`\n📊 Copied: ${copied}, Skipped: ${skipped}`);

  // Step 4: Verify artifacts
  console.log("\n🔍 Verifying artifact structure...");
  const verified = verifyArtifacts();
  if (verified) {
    console.log("✅ All required files present");
  } else {
    console.log("❌ Some required files are missing");
    process.exit(1);
  }

  // Step 5: Check for external references
  console.log("\n🔍 Checking for external src/ references...");
  const { found, files } = checkForExternalReferences();
  if (found) {
    console.log("⚠️  Found external src/ references in:");
    files.forEach((f) => console.log(`   - ${f}`));
    console.log("\n   These will be resolved in T1.2.1 (wrapper rewire)");
  } else {
    console.log("✅ No external src/ references found");
  }

  // Step 6: Summary
  console.log("\n📋 Build Summary:");
  console.log(`   Runtime artifact directory: ${pluginRuntimeDir}`);
  console.log(`   Files copied: ${copied}`);
  console.log(`   Files skipped: ${skipped}`);
  console.log(`   External references: ${found ? "⚠️ (will be fixed in T1.2.1)" : "✅"}`);
  console.log("\n✅ Plugin runtime artifact build complete");
}

main();
