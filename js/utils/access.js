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
/** Legacy index khach moi (0-based) tren link cu: ?t=...&g=0 */
export const GUEST_QUERY_KEY = "g";
/** Ma khach on dinh cho link moi: ?t=...&guest=gabc123 */
export const GUEST_ID_QUERY_KEY = "guest";
const ACCESS_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;
const GUEST_ID_PATTERN = /^[a-z0-9_-]{4,40}$/i;

export function generateAccessToken() {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/** Chi nhan token dung format 32 hex — bo qua timestamp cache-buster / rac tren URL */
export function normalizeAccessToken(value) {
    const token = String(value || "").trim();
    return ACCESS_TOKEN_PATTERN.test(token) ? token.toLowerCase() : "";
}

export function isWeddingPaymentUnlocked(payment = {}) {
    return payment?.unlocked === true || payment?.status === "paid";
}

export function generateGuestId() {
    const bytes = new Uint8Array(6);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return `g${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeGuestId(value) {
    const id = String(value || "").trim();
    return GUEST_ID_PATTERN.test(id) ? id.toLowerCase() : "";
}

/**
 * Build guest invitation URL.
 * Prefer token; weddingId fallback only when token missing (legacy).
 * guestId -> ?guest= is stable when the list is reordered; guestIndex is legacy ?g=.
 */
export function buildInvitationUrlFromBase(baseUrl, {
    accessToken = "",
    weddingId = "",
    guestId = "",
    guestIndex = null
} = {}) {
    const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.href : "https://example.com/");
    url.search = "";
    const token = normalizeAccessToken(accessToken);
    if (token) {
        url.searchParams.set(ACCESS_TOKEN_QUERY_KEY, token);
    } else if (weddingId) {
        url.searchParams.set("wedding", weddingId);
    }
    const normalizedGuestId = normalizeGuestId(guestId);
    if (normalizedGuestId) {
        url.searchParams.set(GUEST_ID_QUERY_KEY, normalizedGuestId);
    } else if (guestIndex !== null && guestIndex !== undefined && guestIndex !== "") {
        const index = Number(guestIndex);
        if (Number.isInteger(index) && index >= 0) {
            url.searchParams.set(GUEST_QUERY_KEY, String(index));
        }
    }
    return url.toString();
}

/** Doc index khach tu URL cu (?g=, hoac ?guest=0 tu ban cu hon). */
export function getGuestIndexFromUrl(search = typeof window !== "undefined" ? window.location.search : "") {
    const params = new URLSearchParams(search);
    const raw = params.get(GUEST_QUERY_KEY) ?? params.get(GUEST_ID_QUERY_KEY);
    if (raw === null || String(raw).trim() === "") return null;
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 0) return null;
    return index;
}

export function getGuestIdFromUrl(search = typeof window !== "undefined" ? window.location.search : "") {
    const params = new URLSearchParams(search);
    return normalizeGuestId(params.get(GUEST_ID_QUERY_KEY));
}

export function normalizeGuestEntries(value) {
    const raw = Array.isArray(value)
        ? value
        : String(value || "").split(/\r?\n/);

    return raw.map((item, index) => {
        if (item && typeof item === "object") {
            const name = String(item.name || item.label || item.guest || "").trim();
            if (!name) return null;
            const legacyIndex = Number(item.legacyIndex);
            const entry = {
                id: normalizeGuestId(item.id || item.guestId),
                name
            };
            if (Number.isInteger(legacyIndex) && legacyIndex >= 0) {
                entry.legacyIndex = legacyIndex;
            }
            return entry;
        }

        const name = String(item || "").trim();
        return name ? { id: "", name, legacyIndex: index } : null;
    }).filter(Boolean);
}

/** Danh sach ten khach da chuan hoa (bo dong trong). */
export function normalizeGuestNames(value) {
    return normalizeGuestEntries(value).map(entry => entry.name);
}

function guestNameKey(name) {
    return String(name || "").trim().toLocaleLowerCase("vi");
}

export function reconcileGuestEntries(value, existingGuests = []) {
    const names = normalizeGuestNames(value);
    const existing = normalizeGuestEntries(existingGuests);
    const used = new Set();
    const issuedIds = new Set(existing.map(entry => entry.id).filter(Boolean));

    return names.map(name => {
        const key = guestNameKey(name);
        const matchIndex = existing.findIndex((entry, index) => (
            !used.has(index) && guestNameKey(entry.name) === key
        ));
        const matched = matchIndex >= 0 ? existing[matchIndex] : null;
        if (matchIndex >= 0) used.add(matchIndex);

        let id = matched?.id || "";
        if (!id) {
            id = generateGuestId();
            while (issuedIds.has(id)) id = generateGuestId();
        }
        issuedIds.add(id);

        const entry = { id, name };
        if (matched && Number.isInteger(matched.legacyIndex) && matched.legacyIndex >= 0) {
            entry.legacyIndex = matched.legacyIndex;
        }
        return entry;
    });
}

/**
 * Ten hien thi cover: guests[guest] neu co; fallback ?g= legacy; khong thi cover.guest.
 */
export function resolveCoverGuestName(
    config = {},
    guestIndex = getGuestIndexFromUrl(),
    guestId = getGuestIdFromUrl()
) {
    const guests = normalizeGuestEntries(config?.guests);
    const byId = normalizeGuestId(guestId);
    if (byId) {
        const match = guests.find(entry => normalizeGuestId(entry.id) === byId);
        if (match?.name) return match.name;
    }
    if (guestIndex !== null) {
        const legacyMatch = guests.find(entry => entry.legacyIndex === guestIndex);
        if (legacyMatch?.name) return legacyMatch.name;
        if (guestIndex >= 0 && guestIndex < guests.length) return guests[guestIndex].name;
    }
    return String(config?.cover?.guest || "Quý khách").trim() || "Quý khách";
}
