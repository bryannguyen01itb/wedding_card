/**
 * Bridge preview data parent builder ↔ iframe thiệp.
 *
 * sessionStorage KHÔNG luôn chia sẻ giữa parent và iframe (browsing context riêng)
 * → ghi localStorage theo tabId + truyền ?ptab= trên URL iframe.
 * Mỗi tab builder có tabId riêng → không đụng preview tab khác.
 */

const TAB_ID_KEY = "weddingBuilderPreviewTabId";
const CONFIG_PREFIX = "weddingBuilderPreview:";
const STATE_PREFIX = "weddingBuilderPreviewState:";
const LEGACY_CONFIG = "weddingBuilderPreview";
const LEGACY_STATE = "weddingBuilderPreviewState";

export function getPreviewTabId() {
    if (typeof sessionStorage === "undefined") return "default";
    try {
        let id = sessionStorage.getItem(TAB_ID_KEY);
        if (!id) {
            id = `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            sessionStorage.setItem(TAB_ID_KEY, id);
        }
        return id;
    } catch {
        return "default";
    }
}

export function writePreviewConfig(config) {
    const id = getPreviewTabId();
    const raw = JSON.stringify(config ?? null);
    try {
        sessionStorage.setItem(LEGACY_CONFIG, raw);
    } catch {
        /* ignore */
    }
    try {
        localStorage.setItem(CONFIG_PREFIX + id, raw);
        // legacy single-key: soft multi-tab vẫn có thể đụng; hard load dùng ptab
        localStorage.setItem(LEGACY_CONFIG, raw);
    } catch {
        /* ignore quota */
    }
    return id;
}

export function writePreviewState(state) {
    const id = getPreviewTabId();
    const raw = JSON.stringify(state ?? null);
    try {
        sessionStorage.setItem(LEGACY_STATE, raw);
    } catch {
        /* ignore */
    }
    try {
        localStorage.setItem(STATE_PREFIX + id, raw);
        localStorage.setItem(LEGACY_STATE, raw);
    } catch {
        /* ignore */
    }
    return id;
}

function parseJson(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Đọc trong iframe: ưu tiên ?ptab= → session → legacy localStorage */
export function readPreviewConfig() {
    if (typeof window === "undefined") return null;
    const ptab = new URLSearchParams(window.location.search).get("ptab") || "";
    if (ptab) {
        const fromTab = parseJson(localStorage.getItem(CONFIG_PREFIX + ptab));
        if (fromTab) return fromTab;
    }
    try {
        const fromSession = parseJson(sessionStorage.getItem(LEGACY_CONFIG));
        if (fromSession) return fromSession;
    } catch {
        /* ignore */
    }
    return parseJson(localStorage.getItem(LEGACY_CONFIG));
}

export function readPreviewState() {
    if (typeof window === "undefined") return null;
    const ptab = new URLSearchParams(window.location.search).get("ptab") || "";
    if (ptab) {
        const fromTab = parseJson(localStorage.getItem(STATE_PREFIX + ptab));
        if (fromTab) return fromTab;
    }
    try {
        const fromSession = parseJson(sessionStorage.getItem(LEGACY_STATE));
        if (fromSession) return fromSession;
    } catch {
        /* ignore */
    }
    return parseJson(localStorage.getItem(LEGACY_STATE));
}
