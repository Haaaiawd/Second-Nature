import { type SensitivityLevel } from "./policy.js";
export interface RedactionManifest {
    id: string;
    sensitivityLevel: SensitivityLevel;
    maskedFields: string[];
    erasedFields: string[];
    hashedFields: string[];
    originalFieldCount: number;
    redactedFieldCount: number;
    createdAt: string;
}
export interface RedactionResult<T> {
    redacted: T;
    manifest: RedactionManifest;
}
export declare function redactEvent<T extends object>(event: T): RedactionResult<T>;
export declare function createEmptyManifest(): RedactionManifest;
export declare function mergeManifests(manifests: RedactionManifest[]): RedactionManifest;
