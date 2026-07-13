import { wedding as fallbackWedding, setWeddingConfig } from "../config.js";
import { db } from "../firebase.js";

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

    const weddingId = getWeddingIdFromUrl();

    if (!weddingId) {
        setWeddingConfig(fallbackWedding);
        return fallbackWedding;
    }

    try {
        const doc = await db.collection("weddings").doc(weddingId).get();

        if (!doc.exists) {
            throw new WeddingConfigError(`Không tìm thấy thiệp cưới: ${weddingId}`, "not-found");
        }

        const remoteWedding = mergeConfig(fallbackWedding, {
            ...doc.data(),
            weddingId: doc.id
        });

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
