export const instreetManifest = {
    platformId: "instreet",
    supportedCapabilities: ["notification.list", "message.send", "comment.reply", "agent.heartbeat"],
    channelPriority: ["api_rest", "skill", "browser"],
    credentialTypes: ["api_key", "verification_code"],
    degradedChannels: ["skill", "browser"],
};
