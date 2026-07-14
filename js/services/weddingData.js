import { wedding as fallbackWedding, setWeddingConfig } from "../config.js";
import { db } from "../firebase.js";
import { isWeddingPaymentUnlocked } from "../utils/access.js";

const WEDDING_QUERY_KEY = "wedding";
const ACCESS_TOKEN_QUERY_KEY = "t";

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
    const token = params.get(ACCESS_TOKEN_QUERY_KEY);
    return token ? token.trim() : "";
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

export async function loadWeddingConfig() {
    const params = new URLSearchParams(window.location.search);

    if (params.get("preview") === "builder") {
        try {
            const previewConfig = JSON.parse(localStorage.getItem("weddingBuilderPreview") || "null");
            if (previewConfig) {
                const mergedPreview = mergeConfig(fallbackWedding, previewConfig);
                setWeddingConfig(mergedPreview);
                return mergedPreview;
            }
        } catch (error) {
            console.warn("Không đọc được preview builder:", error);
        }
    }

    const accessToken = getAccessTokenFromUrl();
    const weddingId = getWeddingIdFromUrl();

    if (!accessToken && !weddingId) {
        setWeddingConfig(fallbackWedding);
        return fallbackWedding;
    }

    try {
        // Prefer unguessable token link (?t=...)
        const remoteWedding = accessToken
            ? await fetchWeddingByAccessToken(accessToken)
            : await fetchWeddingById(weddingId);

        // Guest public view: block unpaid even if weddingId is guessed
        assertPublicAccessAllowed(remoteWedding);

        setWeddingConfig(remoteWedding);
        return remoteWedding;
    } catch (error) {
        if (error instanceof WeddingConfigError) {
            throw error;
        }

        console.error("Không thể tải config từ Firebase:", error);
        throw new WeddingConfigError("Không thể tải dữ liệu thiệp cưới.", "load-failed");
    }
}
