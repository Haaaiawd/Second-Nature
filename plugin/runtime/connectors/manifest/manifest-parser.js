import yaml from "js-yaml";
import { connectorManifestV6Schema, } from "./manifest-schema.js";
/**
 * Safe YAML parse + zod validation for connector manifest v6.
 * Uses JSON_SCHEMA to block custom YAML tags/object constructors.
 */
export function parseConnectorManifestV6(yamlText, path) {
    let raw;
    try {
        raw = yaml.load(yamlText, { schema: yaml.JSON_SCHEMA });
    }
    catch (error) {
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
export function toValidationError(path, output) {
    return output.errors.map((message) => ({ path, message }));
}
