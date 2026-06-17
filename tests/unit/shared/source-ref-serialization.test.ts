import { describe, it } from "node:test";
import assert from "node:assert";
import {
  serializeSourceRefs,
  parseSourceRefs,
} from "../../../src/shared/serialization.js";
import type { SourceRef } from "../../../src/shared/types/v8-contracts.js";

const sampleRef: SourceRef = {
  uri: "sn://evidence/ev_001",
  family: "evidence",
  id: "ev_001",
  redactionClass: "none",
};

const sampleRefs: SourceRef[] = [
  sampleRef,
  {
    uri: "sn://perception/pc_002",
    family: "perception",
    id: "pc_002",
    redactionClass: "redacted",
    sensitivityClass: "private_context",
  },
];

describe("serializeSourceRefs", () => {
  it("serializes a non-empty array", () => {
    const json = serializeSourceRefs(sampleRefs);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].id, "ev_001");
    assert.strictEqual(parsed[1].family, "perception");
  });

  it("serializes an empty array", () => {
    const json = serializeSourceRefs([]);
    assert.strictEqual(json, "[]");
  });
});

describe("parseSourceRefs", () => {
  it("parses a valid JSON array", () => {
    const json = serializeSourceRefs(sampleRefs);
    const refs = parseSourceRefs(json);
    assert.deepStrictEqual(refs, sampleRefs);
  });

  it("returns empty array for null input", () => {
    assert.deepStrictEqual(parseSourceRefs(null), []);
  });

  it("returns empty array for undefined input", () => {
    assert.deepStrictEqual(parseSourceRefs(undefined), []);
  });

  it("returns empty array for empty string", () => {
    assert.deepStrictEqual(parseSourceRefs(""), []);
  });

  it("returns empty array for malformed JSON", () => {
    assert.deepStrictEqual(parseSourceRefs("{not json"), []);
  });

  it("returns empty array for non-array JSON", () => {
    assert.deepStrictEqual(parseSourceRefs('{"id":"ev_001"}'), []);
  });

  it("returns empty array for malformed source ref objects", () => {
    assert.deepStrictEqual(
      parseSourceRefs(JSON.stringify([{ id: "ev_001", kind: "legacy" }])),
      [],
    );
    assert.deepStrictEqual(
      parseSourceRefs(JSON.stringify([{ ...sampleRef, uri: undefined }])),
      [],
    );
  });
});
