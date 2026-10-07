/** Export frame only: preserve saved sources; never invent per-wedding paths. */
export function setImageWithFallback(img, src) {
    if (!img) return;
    const value = String(src || "").trim();
    if (value) {
        img.setAttribute("src", value);
        img.hidden = false;
        img.style.removeProperty("display");
    } else {
        img.removeAttribute("src");
        img.hidden = true;
        img.style.setProperty("display", "none", "important");
    }
}

export function addImageFallback() {}

export function getLocalImageFallback() {
    return "";
}

export function localMusicFallback() {
    return "";
}

export function shouldTryRemoteFallback() {
    return false;
}
