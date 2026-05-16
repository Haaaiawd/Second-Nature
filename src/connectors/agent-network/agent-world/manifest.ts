import type { ConnectorManifest } from "../../base/manifest.js";

export const agentWorldManifest: ConnectorManifest = {
  platformId: "agent-world",
  supportedCapabilities: ["feed.read", "work.discover", "task.claim"],
  channelPriority: ["api_rest", "a2a", "skill"],
  credentialTypes: ["api_key"],
  degradedChannels: ["skill"],
};
