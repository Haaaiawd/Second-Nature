export function createMoltbookApiClient(config) {
    const { baseUrl, accessToken, timeoutMs = 5000 } = config;
    async function request(path, options = {}) {
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
                throw new MoltbookApiError(response.status, `Moltbook API error: ${response.status} ${response.statusText}`, errorBody);
            }
            return response.json();
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    return {
        async readFeed(payload) {
            const params = new URLSearchParams();
            if (payload.limit)
                params.set("limit", String(payload.limit));
            if (payload.offset)
                params.set("offset", String(payload.offset));
            if (payload.sort)
                params.set("sort", String(payload.sort));
            const queryString = params.toString();
            return request(`/api/v1/feed${queryString ? `?${queryString}` : ""}`);
        },
        async publishPost(payload) {
            return request("/api/v1/posts", {
                method: "POST",
                body: JSON.stringify({
                    content: payload.content,
                    link: payload.link,
                    community: payload.community,
                }),
            });
        },
        async replyComment(payload) {
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
    statusCode;
    responseBody;
    constructor(statusCode, message, responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.name = "MoltbookApiError";
    }
}
