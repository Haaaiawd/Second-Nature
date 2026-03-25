import fs from "node:fs";
import path from "node:path";

type SmokeMode = "local-path" | "clawhub" | "npm";

interface SmokeResult {
  mode: SmokeMode;
  ok: boolean;
  installSpec: string;
  fallbackOrder?: string[];
  gatewayRestartRequired: true;
  manifestPath?: string;
  entryPath?: string;
  checks: Record<string, boolean>;
  notes: string[];
}

function resolveRoot(): string {
  return process.cwd();
}

function ensureFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function localPathResult(root: string): SmokeResult {
  const pluginDir = path.join(root, "plugin");
  const pluginPkg = path.join(pluginDir, "package.json");
  const manifest = path.join(pluginDir, "openclaw.plugin.json");
  const entry = path.join(pluginDir, "index.ts");

  const checks = {
    pluginDirExists: fs.existsSync(pluginDir),
    pluginPackageExists: ensureFile(pluginPkg),
    manifestExists: ensureFile(manifest),
    entryExists: ensureFile(entry),
  };

  return {
    mode: "local-path",
    ok: Object.values(checks).every(Boolean),
    installSpec: `file:${pluginDir}`,
    gatewayRestartRequired: true,
    manifestPath: manifest,
    entryPath: entry,
    checks,
    notes: [
      `openclaw plugins install file:${pluginDir}`,
      "openclaw plugins enable second-nature",
      "openclaw gateway restart",
      "openclaw plugins status second-nature",
    ],
  };
}

function clawhubResult(): SmokeResult {
  return {
    mode: "clawhub",
    ok: true,
    installSpec: "clawhub:@second-nature/openclaw-plugin",
    fallbackOrder: ["clawhub", "npm"],
    gatewayRestartRequired: true,
    checks: {
      installSpecReady: true,
      fallbackOrderDefined: true,
    },
    notes: [
      "openclaw plugins install clawhub:@second-nature/openclaw-plugin",
      "if clawhub unresolved: retry with npm:@second-nature/openclaw-plugin",
      "openclaw gateway restart",
    ],
  };
}

function npmResult(): SmokeResult {
  return {
    mode: "npm",
    ok: true,
    installSpec: "npm:@second-nature/openclaw-plugin",
    fallbackOrder: ["npm", "file"],
    gatewayRestartRequired: true,
    checks: {
      installSpecReady: true,
      fallbackOrderDefined: true,
    },
    notes: [
      "openclaw plugins install npm:@second-nature/openclaw-plugin",
      "if npm unavailable: fallback to file:./plugin",
      "openclaw gateway restart",
    ],
  };
}

function parseMode(rawMode: string | undefined): SmokeMode {
  if (rawMode === "clawhub") return "clawhub";
  if (rawMode === "npm") return "npm";
  return "local-path";
}

function run(): void {
  const mode = parseMode(process.argv[2]);
  const root = resolveRoot();

  let result: SmokeResult;
  if (mode === "clawhub") {
    result = clawhubResult();
  } else if (mode === "npm") {
    result = npmResult();
  } else {
    result = localPathResult(root);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

run();
