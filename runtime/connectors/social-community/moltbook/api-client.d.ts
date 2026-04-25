/**
 * Moltbook REST API Client
 *
 * Implements the MoltbookApiClient interface for direct REST API access.
 * Uses fetch() with Bearer token authentication.
 *
 * API Reference: moltbook.apidog.io
 * Auth: OAuth 2.0 via CLI (moltbook login)
 *
 * Per T3.1.1: This provides a minimal real client for feed.read capability,
 * with a replaceable seam for skill/CLI fallback.
 */
import type { MoltbookApiClient } from "./adapter.js";
export interface MoltbookApiConfig {
    /** Base URL for Moltbook REST API */
    baseUrl: string;
    /** OAuth Bearer token */
    accessToken: string;
    /** Request timeout in milliseconds */
    timeoutMs?: number;
}
export declare function createMoltbookApiClient(config: MoltbookApiConfig): MoltbookApiClient;
export declare class MoltbookApiError extends Error {
    readonly statusCode: number;
    readonly responseBody?: string | undefined;
    constructor(statusCode: number, message: string, responseBody?: string | undefined);
}
