/**
 * Public invitation access helpers.
 * Official guest link uses unguessable payment.accessToken (?t=...),
 * not the predictable weddingId slug.
 *
 * IMPORTANT: param `t` is reserved for access tokens (32 hex).
 * Do NOT use `t` as a cache-buster (builder preview used to — that broke load).
 */

/** 32 hex chars from 16 random bytes — not guessable from weddingId */
export const ACCESS_TOKEN_QUERY_KEY = "t";
const ACCESS_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

export function generateAccessToken() {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/** Chỉ nhận token đúng format 32 hex — bỏ qua timestamp cache-buster / rác trên URL */
export function normalizeAccessToken(value) {
    const token = String(value || "").trim();
    return ACCESS_TOKEN_PATTERN.test(token) ? token.toLowerCase() : "";
}

export function isWeddingPaymentUnlocked(payment = {}) {
    return payment?.unlocked === true || payment?.status === "paid";
}

/**
 * Build guest invitation URL.
 * Prefer token; weddingId fallback only when token missing (legacy).
 * side: "groom" | "bride" — poster location nhà trai/gái.
 */
export function buildInvitationUrlFromBase(baseUrl, { accessToken = "", weddingId = "", side = "" } = {}) {
    const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.href : "https://example.com/");
    url.search = "";
    const token = normalizeAccessToken(accessToken);
    if (token) {
        url.searchParams.set(ACCESS_TOKEN_QUERY_KEY, token);
    } else if (weddingId) {
        url.searchParams.set("wedding", weddingId);
    }
    if (side === "groom" || side === "bride") {
        url.searchParams.set("side", side);
    }
    return url.toString();
}
