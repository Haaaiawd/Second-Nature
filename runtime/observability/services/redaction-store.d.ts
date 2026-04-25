import type { ObservabilityDatabase } from "../db/index.js";
import type { RedactionManifest } from "../redaction/manifest.js";
export declare function persistRedactionManifest(db: ObservabilityDatabase, eventId: string, eventType: string, manifest: RedactionManifest): Promise<void>;
