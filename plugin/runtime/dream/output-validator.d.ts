/**
 * Dream output validator.
 *
 * Core logic: schema, source grounding, sensitivity, and unsupported claim
 * checks on candidate DreamOutput. Decides accepted eligibility or archive reason.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */
import type { DreamOutput, DreamOutputValidation } from "./types.js";
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
export declare function validateDreamOutput(input: ValidationInput): ValidationResult;
