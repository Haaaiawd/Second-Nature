export const evomapManifest = {
    platformId: "evomap",
    supportedCapabilities: ["agent.register", "agent.heartbeat", "work.discover", "task.claim"],
    channelPriority: ["api_rest", "a2a", "skill"],
    credentialTypes: ["node_secret", "api_key"],
    degradedChannels: ["skill"],
};
