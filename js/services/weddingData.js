import { wedding as fallbackWedding, setWeddingConfig } from "../config.js";
import { db } from "../firebase.js";

const WEDDING_QUERY_KEY = "wedding";

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
    const weddingId = getWeddingIdFromUrl();

    if (!weddingId) {
        setWeddingConfig(fallbackWedding);
        return fallbackWedding;
    }

    try {
        const doc = await db.collection("weddings").doc(weddingId).get();

        if (!doc.exists) {
            console.warn(`Không tìm thấy config Firebase cho weddingId: ${weddingId}`);
            setWeddingConfig(fallbackWedding);
            return fallbackWedding;
        }

        const remoteWedding = mergeConfig(fallbackWedding, {
            ...doc.data(),
            weddingId: doc.id
        });

        setWeddingConfig(remoteWedding);
        return remoteWedding;
    } catch (error) {
        console.error("Không thể tải config từ Firebase:", error);
        setWeddingConfig(fallbackWedding);
        return fallbackWedding;
    }
}
