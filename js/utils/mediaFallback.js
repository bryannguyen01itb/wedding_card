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

export function setImageWithFallback(img, src, key) {
    if (!img) return;
    addImageFallback(img, key);
    img.src = src || fallbackImageCandidates(key)[0] || "";
}

export function getLocalImageFallback(key) {
    return fallbackImageCandidates(key)[0] || "";
}

export function shouldTryRemoteFallback(value) {
    return Boolean(value) && !isLocalProjectAsset(value);
}
