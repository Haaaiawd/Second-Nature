import { type ConnectorManifestV6, type ConnectorTrustStatus } from "../manifest/manifest-schema.js";
/**
 * Classify manifest runner into trust status per v6 trust decision tree.
 * declarative_http/a2a/mcp -> declarative_trusted
 * cli_descriptor -> declarative_trusted (P0 conditional; dry-run/read path优先)
 * custom_adapter/skill/browser -> custom_adapter_pending_trust
 * explicit blocked/trusted_custom_adapter in manifest.trust respected.
 */
export declare function classifyTrust(manifest: ConnectorManifestV6): ConnectorTrustStatus;
/**
 * Determine whether a connector entry is executable based on trust status.
 */
export declare function isExecutable(trustStatus: ConnectorTrustStatus): boolean;
