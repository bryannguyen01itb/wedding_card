import { wedding } from "../config.js";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function weddingId() {
    return String(wedding.weddingId || "").trim();
}

function isLocalProjectAsset(value) {
    return /^\s*(img|music)\//i.test(String(value || ""));
}

function buildPath(folder, fileName) {
    const id = weddingId();
    return id ? `${folder}/${id}/${fileName}` : "";
}

function fallbackImageCandidates(key) {
    if (!key) return [];
    return IMAGE_EXTENSIONS.map(ext => buildPath("img", `${key}.${ext}`)).filter(Boolean);
}

export function localMusicFallback() {
    return buildPath("music", "music.mp3");
}

export function addImageFallback(img, key) {
    if (!img || !key || img.dataset.localFallbackBound === "true") return;

    img.dataset.localFallbackBound = "true";
    img.dataset.localFallbackIndex = "0";
    img.addEventListener("error", () => {
        const candidates = fallbackImageCandidates(key);
        const index = Number(img.dataset.localFallbackIndex || 0);
        const next = candidates[index];

        if (!next || img.src.endsWith(next)) return;
        img.dataset.localFallbackIndex = String(index + 1);
        img.src = next;
    });
}

function isSameImageUrl(img, nextSrc) {
    const next = String(nextSrc || "").trim();
    if (!next) {
        return !String(img?.getAttribute?.("src") || img?.src || "").trim();
    }
    const currentAttr = String(img?.getAttribute?.("src") || "").trim();
    if (currentAttr === next) return true;
    try {
        const base = typeof location !== "undefined" ? location.href : undefined;
        const a = new URL(img.currentSrc || img.src || currentAttr, base).href;
        const b = new URL(next, base).href;
        return a === b;
    } catch {
        return currentAttr === next;
    }
}

export function setImageWithFallback(img, src, key) {
    if (!img) return;
    addImageFallback(img, key);
    const next = src || fallbackImageCandidates(key)[0] || "";
    // Soft preview re-render: giữ nguyên src trùng → không tốn bandwidth Cloudinary
    if (isSameImageUrl(img, next)) return;
    img.src = next;
}

export function getLocalImageFallback(key) {
    return fallbackImageCandidates(key)[0] || "";
}

export function shouldTryRemoteFallback(value) {
    return Boolean(value) && !isLocalProjectAsset(value);
}
