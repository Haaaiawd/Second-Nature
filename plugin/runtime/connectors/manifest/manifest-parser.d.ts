import { type ConnectorManifestV6, type ConnectorManifestValidationError } from "./manifest-schema.js";
export interface ParseManifestResult {
    ok: true;
    manifest: ConnectorManifestV6;
}
export interface ParseManifestFailure {
    ok: false;
    errors: string[];
}
export type ParseManifestOutput = ParseManifestResult | ParseManifestFailure;
/**
 * Safe YAML parse + zod validation for connector manifest v6.
 * Uses JSON_SCHEMA to block custom YAML tags/object constructors.
 */
export declare function parseConnectorManifestV6(yamlText: string, path?: string): ParseManifestOutput;
export declare function toValidationError(path: string, output: ParseManifestFailure): ConnectorManifestValidationError[];
