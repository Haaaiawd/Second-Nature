import * as crypto from "crypto";
export function redactEvent(event) {
    const maskedFields = [];
    const erasedFields = [];
    const hashedFields = [];
    const output = structuredClone(event);
    function joinPath(basePath, key) {
        return basePath.length > 0 ? `${basePath}.${key}` : key;
    }
    function processObject(target, basePath) {
        for (const key of Object.keys(target)) {
            const lowerKey = key.toLowerCase();
            const value = target[key];
            const fieldPath = joinPath(basePath, key);
            if (lowerKey === "token" ||
                lowerKey === "access_token" ||
                lowerKey === "refresh_token" ||
                lowerKey === "api_key" ||
                lowerKey === "apisecret" ||
                lowerKey === "secret" ||
                lowerKey === "password" ||
                lowerKey === "bearer_token" ||
                lowerKey === "authorization" ||
                lowerKey === "node_secret") {
                target[key] = "[MASKED]";
                maskedFields.push(fieldPath);
                continue;
            }
            if (lowerKey === "full_message" ||
                lowerKey === "full_post" ||
                lowerKey === "private_message" ||
                lowerKey === "prompt" ||
                lowerKey === "system_prompt" ||
                lowerKey === "completion" ||
                lowerKey === "response_content") {
                delete target[key];
                erasedFields.push(fieldPath);
                continue;
            }
            if (lowerKey === "content_hash" ||
                lowerKey === "trace_id" ||
                lowerKey === "user_id" ||
                lowerKey === "session_id") {
                if (typeof value === "string") {
                    target[key] = crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
                }
                hashedFields.push(fieldPath);
                continue;
            }
            if (value && typeof value === "object" && !Array.isArray(value)) {
                processObject(value, fieldPath);
            }
        }
    }
    processObject(output, "");
    const originalFieldCount = Object.keys(event).length;
    const redactedFieldCount = Object.keys(output).length;
    return {
        redacted: output,
        manifest: {
            id: `rm:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`,
            sensitivityLevel: "internal",
            maskedFields,
            erasedFields,
            hashedFields,
            originalFieldCount,
            redactedFieldCount,
            createdAt: new Date().toISOString(),
        },
    };
}
export function createEmptyManifest() {
    return {
        id: `rm:${Date.now()}:empty`,
        sensitivityLevel: "internal",
        maskedFields: [],
        erasedFields: [],
        hashedFields: [],
        originalFieldCount: 0,
        redactedFieldCount: 0,
        createdAt: new Date().toISOString(),
    };
}
export function mergeManifests(manifests) {
    const merged = {
        id: `rm:${Date.now()}:merged`,
        sensitivityLevel: "internal",
        maskedFields: [],
        erasedFields: [],
        hashedFields: [],
        originalFieldCount: 0,
        redactedFieldCount: 0,
        createdAt: new Date().toISOString(),
    };
    for (const m of manifests) {
        merged.maskedFields.push(...m.maskedFields);
        merged.erasedFields.push(...m.erasedFields);
        merged.hashedFields.push(...m.hashedFields);
        merged.originalFieldCount += m.originalFieldCount;
        merged.redactedFieldCount += m.redactedFieldCount;
        if (m.sensitivityLevel === "restricted") {
            merged.sensitivityLevel = "restricted";
        }
        else if (m.sensitivityLevel === "confidential" && merged.sensitivityLevel !== "restricted") {
            merged.sensitivityLevel = "confidential";
        }
    }
    return merged;
}
