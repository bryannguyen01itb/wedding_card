import { wedding as fallbackWedding, setWeddingConfig } from "../config.js";
import { db } from "../firebase.js";
import {
    ACCESS_TOKEN_QUERY_KEY,
    isWeddingPaymentUnlocked,
    normalizeAccessToken,
    resolveCoverGuestName
} from "../utils/access.js";

const WEDDING_QUERY_KEY = "wedding";

export class WeddingConfigError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "WeddingConfigError";
        this.code = code;
    }
}

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function mergeConfig(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override === undefined ? base : override;
    }

    const result = { ...base };

    Object.keys(override).forEach(key => {
        result[key] = mergeConfig(base[key], override[key]);
    });

    return result;
}

/**
 * Sau deep-merge với fallback config.js:
 * - Thiệp cũ (trước joint/separate + events[]) chỉ có title/time/meal/address.
 * - mergeConfig giữ events[] mẫu từ fallback → lịch hiển thị SAI.
 * - Bỏ events[] / joint mẫu nếu doc Firebase không có field đó.
 *
 * Schema ceremony (mới):
 *   mode: "separate" | "joint"
 *   joint | bride | groom: { events[{id,title,date,time,icon}], title, time, meal, address, location, mapUrl }
 * Schema thiệp cũ (vẫn đọc được):
 *   bride/groom: { title, time, date?, meal{title,time}, address, location, mapUrl } — không mode, không events
 */
export function normalizeCeremonyAfterMerge(merged, rawData = null) {
    if (!merged || typeof merged !== "object") return merged;

    const rawCeremony = rawData && typeof rawData === "object"
        ? (rawData.ceremony || null)
        : null;
    const ceremony = { ...(merged.ceremony || {}) };

    // Doc không có mode → always separate (thiệp cũ = 2 nhà)
    if (!rawCeremony || rawCeremony.mode == null || rawCeremony.mode === "") {
        ceremony.mode = "separate";
    } else {
        ceremony.mode = rawCeremony.mode === "joint" ? "joint" : "separate";
    }

    for (const role of ["bride", "groom", "joint"]) {
        const rawHouse = rawCeremony?.[role];
        const house = ceremony[role];
        if (!house || typeof house !== "object") continue;

        // Firebase không có block joint (thiệp cũ) → bỏ events mẫu; giữ field khác nếu có
        if (role === "joint" && (rawHouse == null || typeof rawHouse !== "object")) {
            const { events: _drop, ...rest } = house;
            ceremony.joint = rest;
            continue;
        }

        const rawHasEvents = Array.isArray(rawHouse?.events) && rawHouse.events.length > 0;
        if (!rawHasEvents) {
            // Ưu tiên title/time/meal từ doc (và phần đã merge); không dùng events mẫu
            const { events: _drop, ...rest } = house;
            ceremony[role] = rest;
        }
    }

    // ceremony.image: thiệp cũ thường KHÔNG upload → giữ fallback config (vd img/anh_2.jpg)
    // để concept 2/3 timeline vẫn có ảnh. Chỉ xóa nếu raw ghi rõ image: "" (user xóa hẳn).
    if (rawCeremony && Object.prototype.hasOwnProperty.call(rawCeremony, "image")
        && !String(rawCeremony.image || "").trim()) {
        delete ceremony.image;
    } else if (!String(ceremony.image || "").trim() && fallbackWedding?.ceremony?.image) {
        ceremony.image = fallbackWedding.ceremony.image;
    }

    return {
        ...merged,
        ceremony
    };
}

function mergeWeddingWithFallback(rawData = {}, weddingId = "") {
    const merged = mergeConfig(fallbackWedding, {
        ...rawData,
        weddingId: weddingId || rawData.weddingId || ""
    });
    return normalizeCeremonyAfterMerge(merged, rawData);
}

export function getWeddingIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get(WEDDING_QUERY_KEY);
    return id ? id.trim() : "";
}

export function getAccessTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalizeAccessToken(params.get(ACCESS_TOKEN_QUERY_KEY));
}

function isBuilderPreviewRequest() {
    return new URLSearchParams(window.location.search).get("preview") === "builder";
}

function assertPublicAccessAllowed(config) {
    // Public guest view requires paid/unlocked. Builder preview bypasses this.
    if (isWeddingPaymentUnlocked(config.payment)) return;
    throw new WeddingConfigError(
        "Thiệp chưa được mở khóa. Vui lòng hoàn tất thanh toán và dùng đúng link chính thức admin/builder gửi sau khi xác nhận.",
        "payment-locked"
    );
}

async function fetchWeddingById(weddingId) {
    const doc = await db.collection("weddings").doc(weddingId).get();
    if (!doc.exists) {
        throw new WeddingConfigError(`Không tìm thấy thiệp cưới: ${weddingId}`, "not-found");
    }
    return mergeWeddingWithFallback(doc.data() || {}, doc.id);
}

async function fetchWeddingByAccessToken(token) {
    const normalized = normalizeAccessToken(token);
    if (!normalized) {
        throw new WeddingConfigError("Không tìm thấy thiệp cưới với link này.", "not-found");
    }

    // Ưu tiên map accessTokens/{token} (không cần list collection weddings)
    try {
        const mapDoc = await db.collection("accessTokens").doc(normalized).get();
        if (mapDoc.exists) {
            const weddingId = String(mapDoc.data()?.weddingId || "").trim();
            if (weddingId) {
                return fetchWeddingById(weddingId);
            }
        }
    } catch (error) {
        console.warn("[weddingData] accessTokens map lookup failed, fallback query:", error);
    }

    // Legacy: query weddings theo payment.accessToken (limit 1)
    const snap = await db.collection("weddings")
        .where("payment.accessToken", "==", normalized)
        .limit(1)
        .get();

    if (snap.empty) {
        throw new WeddingConfigError("Không tìm thấy thiệp cưới với link này.", "not-found");
    }

    const doc = snap.docs[0];
    return mergeWeddingWithFallback(doc.data() || {}, doc.id);
}

/** Gán cover.guest theo ?g= (index trong guests[]) trước khi render. */
function applyCoverGuestFromUrl(config) {
    const guestName = resolveCoverGuestName(config);
    const next = {
        ...config,
        cover: {
            ...(config.cover || {}),
            guest: guestName
        }
    };
    setWeddingConfig(next);
    return next;
}

function hasGalleryPhotoSrc(photos) {
    return (Array.isArray(photos) ? photos : []).some(photo => {
        const src = typeof photo === "string" ? photo : photo?.src;
        return Boolean(String(src || "").trim());
    });
}

function applyPreviewOrFallback(previewConfig) {
    let merged = previewConfig
        ? normalizeCeremonyAfterMerge(
            mergeConfig(fallbackWedding, previewConfig),
            previewConfig
        )
        : fallbackWedding;

    // Preview builder / Firebase photos:[] đè mất album mẫu → gallery trống.
    // Khi không còn ảnh nào có src, khôi phục photos mẫu từ config.js.
    if (!hasGalleryPhotoSrc(merged?.gallery?.photos)) {
        merged = {
            ...merged,
            gallery: {
                ...(fallbackWedding.gallery || {}),
                ...(merged.gallery || {}),
                photos: Array.isArray(fallbackWedding.gallery?.photos)
                    ? fallbackWedding.gallery.photos
                    : []
            }
        };
    }

    return applyCoverGuestFromUrl(merged);
}

export async function loadWeddingConfig() {
    // Builder iframe: luôn dùng localStorage / thiệp mẫu — không đụng Firebase / ?t=
    if (isBuilderPreviewRequest()) {
        try {
            // parent ghi localStorage + ?ptab= (sessionStorage parent≠iframe)
            const { readPreviewConfig } = await import("../utils/previewStorage.js");
            const previewConfig = readPreviewConfig();
            return applyPreviewOrFallback(previewConfig);
        } catch (error) {
            console.warn("Không đọc được preview builder:", error);
            return applyPreviewOrFallback(null);
        }
    }

    const accessToken = getAccessTokenFromUrl();
    const weddingId = getWeddingIdFromUrl();

    if (!accessToken && !weddingId) {
        return applyCoverGuestFromUrl(fallbackWedding);
    }

    try {
        // Prefer unguessable token link (?t=32hex)
        const remoteWedding = accessToken
            ? await fetchWeddingByAccessToken(accessToken)
            : await fetchWeddingById(weddingId);

        // Guest public view: block unpaid even if weddingId is guessed
        assertPublicAccessAllowed(remoteWedding);

        return applyCoverGuestFromUrl(remoteWedding);
    } catch (error) {
        if (error instanceof WeddingConfigError) {
            throw error;
        }

        console.error("Không thể tải config từ Firebase:", error);
        throw new WeddingConfigError("Không thể tải dữ liệu thiệp cưới.", "load-failed");
    }
}
