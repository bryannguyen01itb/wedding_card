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

export function setSrc(id, value, fallbackKey = "") {
    const el = $(id);
    if (!el) return;

    if (fallbackKey) {
        setImageWithFallback(el, value, fallbackKey);
        return;
    }

    el.src = value;
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
