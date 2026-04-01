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

export function createMoltbookApiClient(config: MoltbookApiConfig): MoltbookApiClient {
  const { baseUrl, accessToken, timeoutMs = 5000 } = config;

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new MoltbookApiError(
          response.status,
          `Moltbook API error: ${response.status} ${response.statusText}`,
          errorBody
        );
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    async readFeed(payload: Record<string, unknown>): Promise<unknown> {
      const params = new URLSearchParams();
      if (payload.limit) params.set("limit", String(payload.limit));
      if (payload.offset) params.set("offset", String(payload.offset));
      if (payload.sort) params.set("sort", String(payload.sort));

      const queryString = params.toString();
      return request(`/api/v1/feed${queryString ? `?${queryString}` : ""}`);
    },

    async publishPost(payload: Record<string, unknown>): Promise<unknown> {
      return request("/api/v1/posts", {
        method: "POST",
        body: JSON.stringify({
          content: payload.content,
          link: payload.link,
          community: payload.community,
        }),
      });
    },

    async replyComment(payload: Record<string, unknown>): Promise<unknown> {
      const postId = payload.postId;
      if (!postId) {
        throw new MoltbookApiError(400, "postId is required for comment.reply");
      }
      return request(`/api/v1/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          content: payload.content,
        }),
      });
    },
  };
}

export class MoltbookApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "MoltbookApiError";
  }
}
