import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { loadUserInterestSnapshot } from "../../../src/storage/user-interest/load-user-interest-snapshot.js";

const anchorBody = "# Profile\n" + "x".repeat(40);

test("T4.2.2 missing anchors and curated → insufficient + missing_user_interest_model", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-interest-"));
  const snap = await loadUserInterestSnapshot(dir);
  assert.equal(snap.staleness, "insufficient");
  assert.equal(snap.confidence, 0);
  assert.ok(snap.missingReasons?.includes("missing_user_interest_model"));
  assert.equal(snap.signals.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("T4.2.2 USER.md + MEMORY.md anchors yield fresh snapshot with source-backed signals", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-interest-"));
  await fs.writeFile(path.join(dir, "USER.md"), anchorBody, "utf-8");
  await fs.writeFile(path.join(dir, "MEMORY.md"), anchorBody, "utf-8");

  const snap = await loadUserInterestSnapshot(dir);
  assert.equal(snap.staleness, "fresh");
  assert.ok(snap.confidence > 0);
  assert.ok(snap.signals.length >= 2);
  assert.ok(snap.signals.every((s) => s.sourceRefs.length > 0));
  assert.ok(snap.sourceRefs.length > 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("T4.2.2 stale mtime on anchors yields staleness stale", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-interest-"));
  const userPath = path.join(dir, "USER.md");
  await fs.writeFile(userPath, anchorBody, "utf-8");
  const old = new Date("2020-01-01T00:00:00Z");
  await fs.utimes(userPath, old, old);

  const snap = await loadUserInterestSnapshot(dir);
  assert.equal(snap.staleness, "stale");
  assert.ok(snap.signals.length >= 1);
  await fs.rm(dir, { recursive: true, force: true });
});

test("T4.2.2 curated memory file alone can produce signals", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sn-interest-"));
  await fs.mkdir(path.join(dir, "memory", "curated"), { recursive: true });
  await fs.writeFile(path.join(dir, "memory", "curated", "note.md"), anchorBody, "utf-8");

  const snap = await loadUserInterestSnapshot(dir);
  assert.equal(snap.staleness, "fresh");
  assert.ok(snap.signals.some((s) => s.topic.startsWith("curated:")));
  await fs.rm(dir, { recursive: true, force: true });
});
