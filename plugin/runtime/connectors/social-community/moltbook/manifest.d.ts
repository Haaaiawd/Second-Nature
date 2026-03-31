import type { ConnectorManifest } from "../../base/manifest.js";
export declare const moltbookManifest: ConnectorManifest;
export declare const MOLTBOOK_DOC_RISK: {
    readonly key: "moltbook_skill_doc_availability";
    readonly fallbackChannel: "skill";
    readonly note: "official skill/doc may be transiently unavailable; adapter seam remains replaceable via injected skill runner";
};
