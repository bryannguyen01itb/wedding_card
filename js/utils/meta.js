import { wedding } from "../config.js";

function resolveUrl(path) {
    const value = String(path || "").trim();
    if (!value) return window.location.href;

    try {
        return new URL(value, window.location.href).href;
    } catch (_error) {
        return value;
    }
}

function setMeta(selector, value) {
    const element = document.head.querySelector(selector);
    if (element && value) {
        element.setAttribute("content", value);
    }
}

export function updateLinkPreview() {
    const groomName = String(wedding.groom?.nickname || "CHÚ RỂ").trim().toLocaleUpperCase("vi-VN");
    const brideName = String(wedding.bride?.nickname || "CÔ DÂU").trim().toLocaleUpperCase("vi-VN");
    const title = `THƯ MỜI CƯỚI ${groomName} & ${brideName}`;
    const description = "Trân trọng kính mời bạn đến chung vui cùng gia đình chúng tôi.";
    const image = resolveUrl(wedding.preview?.image || wedding.poster?.image);
    const url = window.location.href;

    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[property="og:image:secure_url"]', image);
    setMeta('meta[property="og:image:width"]', "1200");
    setMeta('meta[property="og:image:height"]', "630");
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', image);
}
