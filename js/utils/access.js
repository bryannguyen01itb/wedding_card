/**
 * Public invitation access helpers.
 * Official guest link uses unguessable payment.accessToken (?t=...),
 * not the predictable weddingId slug.
 */

/** 32 hex chars from 16 random bytes — not guessable from weddingId */
export function generateAccessToken() {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
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
    if (accessToken) {
        url.searchParams.set("t", accessToken);
    } else if (weddingId) {
        url.searchParams.set("wedding", weddingId);
    }
    if (side === "groom" || side === "bride") {
        url.searchParams.set("side", side);
    }
    return url.toString();
}
