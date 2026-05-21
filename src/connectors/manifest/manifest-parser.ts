import yaml from "js-yaml";
import { z } from "zod";
import {
  connectorManifestV6Schema,
  type ConnectorManifestV6,
  type ConnectorManifestValidationError,
} from "./manifest-schema.js";

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
export function parseConnectorManifestV6(
  yamlText: string,
  path?: string,
): ParseManifestOutput {
  let raw: unknown;
  try {
    raw = yaml.load(yamlText, { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Error ? `yaml_parse_error:${error.message}` : `yaml_parse_error:${String(error)}`,
      ],
    };
  }

  if (raw === null || typeof raw !== "object") {
    return { ok: false, errors: ["yaml_parse_error:parsed_content_is_null_or_not_object"] };
  }

  const parsed = connectorManifestV6Schema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const pathStr = issue.path.join(".");
      return `schema_validation_error:${pathStr}:${issue.message}`;
    });
    return { ok: false, errors };
  }

  return { ok: true, manifest: parsed.data };
}

export function toValidationError(
  path: string,
  output: ParseManifestFailure,
): ConnectorManifestValidationError[] {
  return output.errors.map((message) => ({ path, message }));
}
