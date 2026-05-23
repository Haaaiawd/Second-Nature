import test from "node:test";
import assert from "node:assert/strict";

import {
  generateGuidanceDraft,
  validateDraftSources,
  type GuidanceDraftRequest,
  type DraftEvidencePackPort,
  type SourceValidatorPort,
  type DraftMessage,
  type GuidanceSourceRef,
} from "../../../src/guidance/index.js";

function makeRequest(
  overrides?: Partial<GuidanceDraftRequest>,
): GuidanceDraftRequest {
  return {
    requestId: "req-001",
    sceneKind: "outreach",
    evidencePackRef: "pack-001",
    relationshipContextRef: "rel-001",
    requestedAt: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

function makeSourceRef(id: string): GuidanceSourceRef {
  return {
    id,
    kind: "platform_item",
    uri: `https://example.com/item/${id}`,
  };
}

// ─── generateGuidanceDraft ──────────────────────────────────────────────────

test("T-GVS.C.1 generateGuidanceDraft produces DraftMessage with sourceRefs", async () => {
  const evidencePort: DraftEvidencePackPort = {
    async loadEvidencePack(ref) {
      if (ref === "pack-001") {
        return {
          claims: [
            { id: "c1", text: "Claim one", sourceRefs: [makeSourceRef("s1")] },
            { id: "c2", text: "Claim two", sourceRefs: [makeSourceRef("s2")] },
          ],
        };
      }
      return undefined;
    },
  };

  const result = await generateGuidanceDraft(makeRequest(), { evidencePort });

  assert.ok(result.draft, "expected draft to be defined");
  assert.equal(result.draft!.sourceRefs.length, 2);
  assert.equal(result.draft!.sourceRefs[0]!.id, "s1");
  assert.equal(result.draft!.sourceRefs[1]!.id, "s2");
  assert.equal(result.draft!.deliveryWording, "sendable");
  assert.ok(result.draft!.text.includes("Claim one"));
  assert.ok(result.draft!.explanation!.includes("relationshipContext=rel-001"));
});

test("T-GVS.C.1 generateGuidanceDraft returns error when evidence pack missing", async () => {
  const evidencePort: DraftEvidencePackPort = {
    async loadEvidencePack() {
      return undefined;
    },
  };

  const result = await generateGuidanceDraft(makeRequest(), { evidencePort });

  assert.equal(result.error, "evidence_pack_unavailable");
  assert.equal(result.draft, undefined);
});

test("T-GVS.C.1 generateGuidanceDraft returns error when claims have no sourceRefs", async () => {
  const evidencePort: DraftEvidencePackPort = {
    async loadEvidencePack() {
      return {
        claims: [{ id: "c1", text: "Claim without source", sourceRefs: [] }],
      };
    },
  };

  const result = await generateGuidanceDraft(makeRequest(), { evidencePort });

  assert.equal(result.error, "draft_source_invalidated");
});

test("T-GVS.C.1 generateGuidanceDraft returns unsupported_scene_kind for invalid sceneKind", async () => {
  const evidencePort: DraftEvidencePackPort = {
    async loadEvidencePack() {
      return {
        claims: [{ id: "c1", text: "Claim one", sourceRefs: [makeSourceRef("s1")] }],
      };
    },
  };

  const result = await generateGuidanceDraft(
    makeRequest({ sceneKind: "invalid_scene" as any }),
    { evidencePort },
  );

  assert.equal(result.error, "unsupported_scene_kind");
});

test("T-GVS.C.1 generateGuidanceDraft uses inner-guide style per sceneKind", async () => {
  const evidencePort: DraftEvidencePackPort = {
    async loadEvidencePack() {
      return {
        claims: [{ id: "c1", text: "something interesting", sourceRefs: [makeSourceRef("s1")] }],
      };
    },
  };

  const outreach = await generateGuidanceDraft(makeRequest({ sceneKind: "outreach" }), { evidencePort });
  assert.ok(outreach.draft!.text.startsWith("Hi there"));

  const followUp = await generateGuidanceDraft(makeRequest({ sceneKind: "follow_up" }), { evidencePort });
  assert.ok(followUp.draft!.text.startsWith("Following up"));

  const reconnect = await generateGuidanceDraft(makeRequest({ sceneKind: "reconnect" }), { evidencePort });
  assert.ok(reconnect.draft!.text.startsWith("It's been a while"));
});

// ─── validateDraftSources ────────────────────────────────────────────────────

test("T-GVS.C.1 validateDraftSources passes when all sources available", async () => {
  const validatorPort: SourceValidatorPort = {
    async checkSourceAvailable() {
      return true;
    },
  };

  const draft: DraftMessage = {
    text: "Test draft",
    deliveryWording: "sendable",
    sourceRefs: [makeSourceRef("s1"), makeSourceRef("s2")],
  };

  const result = await validateDraftSources(draft, { validatorPort });

  assert.equal(result.valid, true);
  assert.equal(result.invalidated, undefined);
  assert.equal(result.reason, undefined);
});

test("T-GVS.C.1 validateDraftSources fails when a source is redacted", async () => {
  const validatorPort: SourceValidatorPort = {
    async checkSourceAvailable(ref) {
      return ref.id !== "s2";
    },
  };

  const draft: DraftMessage = {
    text: "Test draft",
    deliveryWording: "sendable",
    sourceRefs: [makeSourceRef("s1"), makeSourceRef("s2")],
  };

  const result = await validateDraftSources(draft, { validatorPort });

  assert.equal(result.valid, false);
  assert.equal(result.invalidated, true);
  assert.equal(result.reason, "draft_source_invalidated");
});

test("T-GVS.C.1 validateDraftSources fails when all sources deleted", async () => {
  const validatorPort: SourceValidatorPort = {
    async checkSourceAvailable() {
      return false;
    },
  };

  const draft: DraftMessage = {
    text: "Test draft",
    deliveryWording: "sendable",
    sourceRefs: [makeSourceRef("s1")],
  };

  const result = await validateDraftSources(draft, { validatorPort });

  assert.equal(result.valid, false);
  assert.equal(result.invalidated, true);
  assert.equal(result.reason, "draft_source_invalidated");
});
