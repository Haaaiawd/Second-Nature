import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { createPersonaCandidateLoader } from "../../../src/storage/services/persona-candidate-loader.js";

const workspaceRoot = path.join(process.cwd(), "workspace");

test("persona candidate loader returns snippet-sized candidates instead of full documents", async () => {
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, "SOUL.md"), "# SOUL\n\n第一段\n\n第二段", "utf8");
  await fs.writeFile(path.join(workspaceRoot, "USER.md"), "# USER\n\n用户相关片段", "utf8");
  await fs.writeFile(path.join(workspaceRoot, "IDENTITY.md"), "# IDENTITY\n\n身份片段", "utf8");
  await fs.writeFile(path.join(workspaceRoot, "MEMORY.md"), "# MEMORY\n\n记忆片段一\n\n记忆片段二", "utf8");

  const loader = createPersonaCandidateLoader();
  const candidates = await loader.loadPersonaCandidates({
    sceneType: "outreach",
    mode: "active",
    riskLevel: "low",
  });

  assert.ok(candidates.length >= 4);
  assert.ok(candidates.every((item) => item.text.length > 0));
  assert.ok(candidates.every((item) => item.tags.includes("outreach")));
  assert.ok(candidates.every((item) => !item.text.includes("# ")));
});
