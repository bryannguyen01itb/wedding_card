import { setImageWithFallback } from "./mediaFallback.js";
export function $(id) {
    return document.getElementById(id);
}

export function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

/** Set text and hide element when empty (titles/subtitles). */
export function setOptionalText(id, value) {
    const el = $(id);
    if (!el) return;

    const text = Array.isArray(value)
        ? value.filter(Boolean).join("\n")
        : String(value || "").trim();
    el.textContent = text;
    el.hidden = !text;
}

function getNameLines(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= 2) return words;

    const middle = Math.ceil(words.length / 2);
    return [
        words.slice(0, middle).join(" "),
        words.slice(middle).join(" ")
    ];
}

export function setSplitName(id, value) {
    const el = $(id);
    if (!el) return;

    el.textContent = "";
    getNameLines(value).forEach((line, index) => {
        if (index > 0) el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode(line));
    });
}

/** So sánh URL ảnh/media — tránh gán lại src trùng → browser không tải lại. */
function isSameResourceUrl(el, nextSrc) {
    const next = String(nextSrc || "").trim();
    if (!next) {
        return !String(el?.getAttribute?.("src") || el?.src || "").trim();
    }
    const currentAttr = String(el?.getAttribute?.("src") || "").trim();
    if (currentAttr === next) return true;
    try {
        const base = typeof location !== "undefined" ? location.href : undefined;
        const a = new URL(el.currentSrc || el.src || currentAttr, base).href;
        const b = new URL(next, base).href;
        return a === b;
    } catch {
        return currentAttr === next;
    }
}

export function setSrc(id, value, fallbackKey = "") {
    const el = $(id);
    if (!el) return;

    if (fallbackKey) {
        setImageWithFallback(el, value, fallbackKey);
        return;
    }

    const next = value || "";
    if (isSameResourceUrl(el, next)) return;
    el.src = next;
}

export function bindClick(element, handler) {
    element?.addEventListener("click", handler);
}

export function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}
