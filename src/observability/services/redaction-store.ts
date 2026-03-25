import { redactionManifest as redactionManifestTable } from "../db/schema/index.js";
import type { ObservabilityDatabase } from "../db/index.js";
import type { RedactionManifest } from "../redaction/manifest.js";

export async function persistRedactionManifest(
  db: ObservabilityDatabase,
  eventId: string,
  eventType: string,
  manifest: RedactionManifest
): Promise<void> {
  const rows: Array<{ fieldName: string; action: "mask" | "erase" | "hash" | "none" }> = [
    ...manifest.maskedFields.map((fieldName) => ({ fieldName, action: "mask" as const })),
    ...manifest.erasedFields.map((fieldName) => ({ fieldName, action: "erase" as const })),
    ...manifest.hashedFields.map((fieldName) => ({ fieldName, action: "hash" as const })),
  ];

  if (rows.length === 0) {
    rows.push({ fieldName: "*", action: "none" as const });
  }

  await db.db.insert(redactionManifestTable).values(
    rows.map((row, index) => ({
      id: `${manifest.id}:${index}`,
      eventId,
      eventType,
      fieldName: row.fieldName,
      action: row.action,
      originalValueHash: null,
      createdAt: manifest.createdAt,
    }))
  );
}
