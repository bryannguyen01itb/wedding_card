/**
 * =============================================================================
 * MÀU CHỦ ĐẠO TOÀN SITE — CHỈ SỬA OBJECT `BRAND` BÊN DƯỚI
 * =============================================================================
 *
 * Một nguồn cho:
 *   • Trang thiệp (index) — default theme.primaryColor
 *   • Builder UI + default ô "Màu sắc thiệp"
 *   • Admin UI + default "Màu chủ đạo"
 *
 * Sau khi đổi `BRAND.primary` (và các field liên quan), chạy:
 *   node scripts/sync-brand-css.mjs
 * để cập nhật css/brand.css (thiệp / builder / admin load file CSS này).
 */

/** @type {const} */
export const BRAND = {
    /** Màu chủ đạo (nút, link, accent, default thiệp) */
    primary: "#12c4b8",
    /** RGB tách — dùng trong rgba(var(--brand-primary-rgb), a) */
    primaryRgb: "18, 196, 184",
    /** Hover / nhấn */
    primaryHover: "#0faca1",
    /** Chữ chính */
    ink: "#1c4c45",
    /** Chữ phụ / hint */
    muted: "#4a7a74",
    /** Nền trang builder/admin */
    paper: "#ecfaf9",
    /** Nền card / modal */
    surface: "#f4fcfb",
    /** Accent logo (cam) — tuỳ chọn */
    accentOrange: "#f9a138",
    /** Accent logo (sky) — tuỳ chọn */
    accentSky: "#50c8f0"
};

/** Shortcut hay dùng */
export const BRAND_PRIMARY = BRAND.primary;
export const BRAND_PRIMARY_RGB = BRAND.primaryRgb;

/**
 * Chuỗi CSS :root — inject runtime hoặc sync ra css/brand.css
 * @returns {string}
 */
export function getBrandCssText() {
    const b = BRAND;
    return `/* Auto from js/brand.js — đừng sửa tay nếu dùng scripts/sync-brand-css.mjs */
:root {
    --brand-primary: ${b.primary};
    --brand-primary-rgb: ${b.primaryRgb};
    --brand-primary-hover: ${b.primaryHover};
    --brand-ink: ${b.ink};
    --brand-muted: ${b.muted};
    --brand-paper: ${b.paper};
    --brand-surface: ${b.surface};
    --brand-accent-orange: ${b.accentOrange};
    --brand-accent-sky: ${b.accentSky};

    /* Alias thiệp (theme.js có thể ghi đè runtime theo wedding) */
    --primary-color: var(--brand-primary);
    --primary-rgb: var(--brand-primary-rgb);
    --primary-hover: var(--brand-primary-hover);

    /* Alias admin / builder UI */
    --admin-primary: var(--brand-primary);
    --admin-primary-rgb: var(--brand-primary-rgb);
    --admin-ink: var(--brand-ink);
    --admin-muted: var(--brand-muted);
    --admin-paper: var(--brand-paper);
    --admin-surface: var(--brand-surface);
    --builder-primary: var(--brand-primary);
    --builder-primary-rgb: var(--brand-primary-rgb);
    --builder-ink: var(--brand-ink);
    --builder-muted: var(--brand-muted);
    --builder-paper: var(--brand-paper);
    --builder-surface: var(--brand-surface);
}
`;
}

/** Gắn <style id="brand-vars"> nếu trang chưa load css/brand.css */
export function injectBrandCss() {
    if (typeof document === "undefined") return;
    if (document.getElementById("brand-vars")) return;
    const style = document.createElement("style");
    style.id = "brand-vars";
    style.textContent = getBrandCssText();
    document.head.prepend(style);
}
