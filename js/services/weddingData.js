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
    return mergeConfig(fallbackWedding, {
        ...doc.data(),
        weddingId: doc.id
    });
}

async function fetchWeddingByAccessToken(token) {
    const snap = await db.collection("weddings")
        .where("payment.accessToken", "==", token)
        .limit(1)
        .get();

    if (snap.empty) {
        throw new WeddingConfigError("Không tìm thấy thiệp cưới với link này.", "not-found");
    }

    const doc = snap.docs[0];
    return mergeConfig(fallbackWedding, {
        ...doc.data(),
        weddingId: doc.id
    });
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
        ? mergeConfig(fallbackWedding, previewConfig)
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
            const previewConfig = JSON.parse(localStorage.getItem("weddingBuilderPreview") || "null");
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
