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
/** Index khách mời (0-based) trên link thiệp: ?t=…&g=0 */
export const GUEST_QUERY_KEY = "g";
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
 * guestIndex (0-based) → ?g= — cover.guest = guests[index]; không có g → "Quý khách".
 */
export function buildInvitationUrlFromBase(baseUrl, { accessToken = "", weddingId = "", guestIndex = null } = {}) {
    const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.href : "https://example.com/");
    url.search = "";
    const token = normalizeAccessToken(accessToken);
    if (token) {
        url.searchParams.set(ACCESS_TOKEN_QUERY_KEY, token);
    } else if (weddingId) {
        url.searchParams.set("wedding", weddingId);
    }
    if (guestIndex !== null && guestIndex !== undefined && guestIndex !== "") {
        const index = Number(guestIndex);
        if (Number.isInteger(index) && index >= 0) {
            url.searchParams.set(GUEST_QUERY_KEY, String(index));
        }
    }
    return url.toString();
}

/** Đọc index khách từ URL (?g= hoặc ?guest=). */
export function getGuestIndexFromUrl(search = typeof window !== "undefined" ? window.location.search : "") {
    const params = new URLSearchParams(search);
    const raw = params.get(GUEST_QUERY_KEY) ?? params.get("guest");
    if (raw === null || String(raw).trim() === "") return null;
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 0) return null;
    return index;
}

/** Danh sách tên khách đã chuẩn hóa (bỏ dòng trống). */
export function normalizeGuestNames(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item || "").trim()).filter(Boolean);
    }
    return String(value || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}

/**
 * Tên hiển thị cover: guests[g] nếu có; không thì cover.guest / "Quý khách".
 */
export function resolveCoverGuestName(config = {}, guestIndex = getGuestIndexFromUrl()) {
    const guests = normalizeGuestNames(config?.guests);
    if (guestIndex !== null && guestIndex >= 0 && guestIndex < guests.length) {
        return guests[guestIndex];
    }
    return String(config?.cover?.guest || "Quý khách").trim() || "Quý khách";
}
