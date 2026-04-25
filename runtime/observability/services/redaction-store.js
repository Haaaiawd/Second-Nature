import { redactionManifest as redactionManifestTable } from "../db/schema/index.js";
export async function persistRedactionManifest(db, eventId, eventType, manifest) {
    const rows = [
        ...manifest.maskedFields.map((fieldName) => ({ fieldName, action: "mask" })),
        ...manifest.erasedFields.map((fieldName) => ({ fieldName, action: "erase" })),
        ...manifest.hashedFields.map((fieldName) => ({ fieldName, action: "hash" })),
    ];
    if (rows.length === 0) {
        rows.push({ fieldName: "*", action: "none" });
    }
    await db.db.insert(redactionManifestTable).values(rows.map((row, index) => ({
        id: `${manifest.id}:${index}`,
        eventId,
        eventType,
        fieldName: row.fieldName,
        action: row.action,
        originalValueHash: null,
        createdAt: manifest.createdAt,
    })));
}
