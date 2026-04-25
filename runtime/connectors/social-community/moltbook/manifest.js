export const moltbookManifest = {
    platformId: "moltbook",
    supportedCapabilities: ["feed.read", "post.publish", "comment.reply"],
    channelPriority: ["api_rest", "skill", "browser"],
    credentialTypes: ["api_key"],
    degradedChannels: ["skill", "browser"],
};
export const MOLTBOOK_DOC_RISK = {
    key: "moltbook_skill_doc_availability",
    fallbackChannel: "skill",
    note: "official skill/doc may be transiently unavailable; adapter seam remains replaceable via injected skill runner",
};
