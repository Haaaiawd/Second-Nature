/**
 * Dream output validator.
 *
 * Core logic: schema, source grounding, sensitivity, and unsupported claim
 * checks on candidate DreamOutput. Decides accepted eligibility or archive reason.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */

import type {
  DreamOutput,
  DreamOutputValidation,
} from "./types.js";

export interface ValidationInput {
  output: DreamOutput;
  inputEvidenceIds: string[];
  inputChronicleIds: string[];
  inputToolExperienceIds?: string[];
}

export interface ValidationResult {
  eligible: boolean;
  validation: DreamOutputValidation;
  archiveReasons: string[];
}

function hasUnsupportedClaims(output: DreamOutput): string[] {
  const claims: string[] = [];
  for (const insight of output.insights) {
    if (insight.confidence < 0.3) {
      claims.push(`insight_low_confidence:${insight.id}`);
    }
    if (insight.sourceRefs.length === 0) {
      claims.push(`insight_no_source:${insight.id}`);
    }
  }
  if (output.narrativeUpdate) {
    if (output.narrativeUpdate.unsupportedClaims.length > 0) {
      claims.push(...output.narrativeUpdate.unsupportedClaims);
    }
    if (output.narrativeUpdate.sourceRefs.length === 0) {
      claims.push("narrative_update_no_source");
    }
  }
  if (output.relationshipUpdate) {
    if (output.relationshipUpdate.sourceRefs.length === 0) {
      claims.push("relationship_update_no_source");
    }
  }
  return claims;
}

function isSourceGrounded(
  output: DreamOutput,
  inputEvidenceIds: string[],
  inputChronicleIds: string[],
  inputToolExperienceIds?: string[],
): boolean {
  const validSourceIds = new Set([
    ...inputEvidenceIds,
    ...inputChronicleIds,
    ...(inputToolExperienceIds ?? []),
  ]);
  for (const entry of output.canonicalEntries) {
    for (const ref of entry.sourceRefs) {
      if (!validSourceIds.has(ref.sourceId)) {
        return false;
      }
    }
  }
  for (const insight of output.insights) {
    for (const refId of insight.sourceRefs) {
      if (!validSourceIds.has(refId)) {
        return false;
      }
    }
  }
  return true;
}

function hasSensitivityIssues(output: DreamOutput): string[] {
  const issues: string[] = [];
  for (const entry of output.canonicalEntries) {
    const text = JSON.stringify(entry).toLowerCase();
    if (text.includes("password") || text.includes("token") || text.includes("secret")) {
      issues.push(`sensitivity_in_entry:${entry.entryId}`);
    }
  }
  return issues;
}

export function validateDreamOutput(input: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const archiveReasons: string[] = [];

  // Schema: basic structural checks
  const schemaValid =
    typeof input.output.outputId === "string" &&
    input.output.outputId.length > 0 &&
    typeof input.output.runId === "string" &&
    Array.isArray(input.output.canonicalEntries) &&
    Array.isArray(input.output.insights);

  if (!schemaValid) {
    errors.push("schema_invalid");
    archiveReasons.push("schema_invalid");
  }

  // Source grounding
  const sourceGrounded = isSourceGrounded(
    input.output,
    input.inputEvidenceIds,
    input.inputChronicleIds,
    input.inputToolExperienceIds,
  );
  if (!sourceGrounded) {
    errors.push("source_not_grounded");
    archiveReasons.push("source_not_grounded");
  }

  // Sensitivity
  const sensitivityIssues = hasSensitivityIssues(input.output);
  const sensitivityClean = sensitivityIssues.length === 0;
  if (!sensitivityClean) {
    errors.push(...sensitivityIssues);
    archiveReasons.push(...sensitivityIssues);
  }

  // Unsupported claims
  const unsupportedClaims = hasUnsupportedClaims(input.output);
  if (unsupportedClaims.length > 0) {
    errors.push(...unsupportedClaims);
    archiveReasons.push("unsupported_claims_present");
  }

  const eligible =
    schemaValid && sourceGrounded && sensitivityClean && unsupportedClaims.length === 0;

  return {
    eligible,
    validation: {
      schemaValid,
      sourceGrounded,
      sensitivityClean,
      unsupportedClaims,
      errors,
      checkedAt: new Date().toISOString(),
    },
    archiveReasons,
  };
}
