import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PACKAGED_RUNTIME_REQUIRED_ENTRIES,
  detectForbiddenSourcePathDependencies,
  resolvePackagedRuntime,
} from "../../../src/cli/runtime/runtime-artifact-boundary.js";

function touchFile(absPath: string): void {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, "// fixture\n", "utf-8");
}

function writeMinimalRuntimeTree(runtimeRoot: string): void {
  for (const rel of PACKAGED_RUNTIME_REQUIRED_ENTRIES) {
    touchFile(path.join(runtimeRoot, rel));
  }
}

test("resolvePackagedRuntime succeeds when runtime layout is complete", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sn-pack-"));
  const runtimeRoot = path.join(root, "runtime");
  fs.mkdirSync(runtimeRoot, { recursive: true });
  writeMinimalRuntimeTree(runtimeRoot);

  const res = resolvePackagedRuntime(root);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.boundary.sourcePathDependencyAllowed, false);
    assert.ok(res.runtimeRoot.endsWith("runtime"));
  }
});

test("resolvePackagedRuntime returns runtime_artifact_missing when runtime dir absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sn-pack-"));
  const res = resolvePackagedRuntime(root);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "runtime_artifact_missing");
  }
});

test("resolvePackagedRuntime returns runtime_layout_incomplete when required modules missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sn-pack-"));
  const runtimeRoot = path.join(root, "runtime");
  fs.mkdirSync(runtimeRoot, { recursive: true });
  touchFile(path.join(runtimeRoot, "cli/index.js"));

  const res = resolvePackagedRuntime(root);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "runtime_layout_incomplete");
    assert.ok(res.missingPaths.length > 0);
  }
});

test("detectForbiddenSourcePathDependencies flags repository-relative src imports", () => {
  const bad = `
import { x } from "../../src/cli/index.js";
const y = require('../src/foo.ts');
`;
  const hits = detectForbiddenSourcePathDependencies(bad);
  assert.ok(hits.length >= 2);

  const clean = `import { x } from "./runtime/cli/index.js";`;
  assert.deepEqual(detectForbiddenSourcePathDependencies(clean), []);
});
