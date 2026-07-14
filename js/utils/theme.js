import { getLocalImageFallback, shouldTryRemoteFallback } from "./mediaFallback.js";
// Bootstrap module registry before applying skins.
import "../modules/index.js";
import {
    applyModuleClasses,
    getActiveConceptConfig,
    resolveCoverOpenLabel
} from "../modules/core/apply.js";
import { getRegisteredSkins, normalizeSkinId } from "../modules/index.js";

const DEFAULT_PRIMARY_COLOR = "#8fb8a8";
const FIXED_BASE_CONCEPT = "concept-1";

const PALETTE_VARS = {
    botanical: {
        ink: "--botanical-ink",
        muted: "--botanical-muted",
        paper: "--botanical-paper",
        cream: "--botanical-cream",
        mint: "--botanical-mint",
        leaf: "--botanical-leaf",
        rose: "--botanical-rose",
        clay: "--botanical-clay"
    },
    sunset: {
        ink: "--sunset-ink",
        muted: "--sunset-muted",
        paper: "--sunset-paper",
        cream: "--sunset-cream",
        peach: "--sunset-peach",
        coral: "--sunset-coral",
        lavender: "--sunset-lavender",
        sky: "--sunset-sky",
        lemon: "--sunset-lemon"
    }
};

function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const normalized = clean.length === 3
        ? clean.split("").map(c => c + c).join("")
        : clean;
    const value = parseInt(normalized, 16);

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

function darkenHex(hex, percent) {
    const rgb = hexToRgb(hex);
    const ratio = 1 - percent / 100;
    const toHex = value => Math.round(value * ratio).toString(16).padStart(2, "0");
    return "#" + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
}

function rgbToHex({ r, g, b }) {
    const toHex = value => Math.round(value).toString(16).padStart(2, "0");
    return "#" + toHex(r) + toHex(g) + toHex(b);
}

function mixHex(color, targetColor, amount) {
    const from = hexToRgb(color);
    const to = hexToRgb(targetColor);
    const ratio = Math.max(0, Math.min(1, amount));

    return rgbToHex({
        r: from.r + (to.r - from.r) * ratio,
        g: from.g + (to.g - from.g) * ratio,
        b: from.b + (to.b - from.b) * ratio
    });
}

function createBotanicalPalette(primaryColor) {
    return {
        ink: mixHex(primaryColor, "#1f2a25", .78),
        muted: mixHex(primaryColor, "#6f7b75", .72),
        paper: "#fffefa",
        cream: mixHex(primaryColor, "#fffefa", .9),
        mint: mixHex(primaryColor, "#ffffff", .82),
        leaf: primaryColor,
        rose: mixHex(primaryColor, "#d99aa6", .58),
        clay: mixHex(primaryColor, "#c98f72", .64)
    };
}

function createSunsetPalette(primaryColor) {
    return {
        ink: mixHex(primaryColor, "#34283d", .78),
        muted: mixHex(primaryColor, "#7d7186", .74),
        paper: "#fff8ef",
        cream: mixHex(primaryColor, "#fff5d6", .86),
        peach: mixHex(primaryColor, "#ffb199", .58),
        coral: primaryColor,
        lavender: mixHex(primaryColor, "#a78bfa", .56),
        sky: mixHex(primaryColor, "#7dd3fc", .62),
        lemon: mixHex(primaryColor, "#f8d66d", .72)
    };
}

function resolveAssetUrl(path) {
    const value = String(path || "").trim();
    if (!value) return "";

    if (/^(https?:|data:|blob:|file:)/i.test(value)) {
        return value;
    }

    try {
        return new URL(value, window.location.href).href;
    } catch (_error) {
        return value;
    }
}

function toCssUrl(path) {
    const url = resolveAssetUrl(path);
    return url ? `url("${url.replace(/"/g, "%22")}")` : "";
}

function toCssString(value) {
    return JSON.stringify(String(value || ""));
}

function setVar(target, name, value) {
    if (value !== undefined && value !== null && value !== "") {
        target.setProperty(name, value);
    }
}

function setImageVar(target, name, value) {
    if (value) setVar(target, name, toCssUrl(value));
}

function setColorVar(target, name, value) {
    if (!value) return;
    const rgb = hexToRgb(value);
    setVar(target, name, value);
    setVar(target, name + "-rgb", rgb.r + ", " + rgb.g + ", " + rgb.b);
}

function applyBaseConceptClass() {
    // Wish / gift / thanks stay on concept-1 chrome; section skins are modular.
    const skinClasses = getRegisteredSkins().map(skin => skin.id);
    document.body.classList.remove(...skinClasses);
    document.body.classList.add(FIXED_BASE_CONCEPT);
    document.body.dataset.concept = FIXED_BASE_CONCEPT;
    return FIXED_BASE_CONCEPT;
}

function applyPalette(target, palette, variableMap) {
    Object.entries(variableMap).forEach(([key, cssVar]) => {
        setColorVar(target, cssVar, palette[key]);
    });
}

function applyBuilderPalettes(bodyStyle, primaryColor) {
    // Always publish both palettes so mixed section skins can use CSS vars safely.
    applyPalette(bodyStyle, createBotanicalPalette(primaryColor), PALETTE_VARS.botanical);
    applyPalette(bodyStyle, createSunsetPalette(primaryColor), PALETTE_VARS.sunset);
}

function applySharedThemeSurface(rootStyle, primaryColor) {
    setColorVar(rootStyle, "--theme-page-bg", mixHex(primaryColor, "#fffdf8", .94));
    setColorVar(rootStyle, "--theme-page-bg-soft", mixHex(primaryColor, "#fff7eb", .88));
    setColorVar(rootStyle, "--theme-surface", mixHex(primaryColor, "#ffffff", .9));
}

function preloadImage(url) {
    return new Promise(resolve => {
        if (!url || !shouldTryRemoteFallback(url)) {
            resolve(true);
            return;
        }

        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = resolveAssetUrl(url);
    });
}

function setImageVarWithFallback(target, name, value, fallbackKey) {
    setImageVar(target, name, value);
    if (!fallbackKey || !shouldTryRemoteFallback(value)) return;

    preloadImage(value).then(isOk => {
        if (isOk) return;
        const fallback = getLocalImageFallback(fallbackKey);
        if (fallback) setImageVar(target, name, fallback);
    });
}

function applyBaseMediaConfig(config, rootStyle, bodyStyle, openLabel) {
    setImageVarWithFallback(rootStyle, "--site-background-image", config?.images?.background, "background");
    setImageVarWithFallback(rootStyle, "--countdown-image", config?.images?.countdown, "countdown");
    setImageVarWithFallback(bodyStyle, "--concept-background-image", config?.images?.background, "background");
    setImageVarWithFallback(bodyStyle, "--concept-cover-image", config?.images?.cover, "poster");
    setImageVarWithFallback(bodyStyle, "--concept-countdown-image", config?.images?.countdown, "countdown");
    setVar(bodyStyle, "--concept-cover-label", toCssString(openLabel));
}

function applyModuleMedia(themeConfig, rootStyle, bodyStyle) {
    const cover = getActiveConceptConfig(themeConfig, "cover");
    const countdown = getActiveConceptConfig(themeConfig, "countdown");
    const openLabel = resolveCoverOpenLabel(themeConfig);

    setImageVarWithFallback(bodyStyle, "--concept-cover-image", cover.config?.images?.cover, "poster");
    setVar(bodyStyle, "--concept-cover-label", toCssString(openLabel));
    setImageVarWithFallback(rootStyle, "--countdown-image", countdown.config?.images?.countdown, "countdown");
    setImageVarWithFallback(bodyStyle, "--concept-countdown-image", countdown.config?.images?.countdown, "countdown");
}

export function applyTheme(theme = {}) {
    const themeConfig = typeof theme === "string"
        ? { primaryColor: theme }
        : theme;
    const primaryColor = themeConfig?.primaryColor || DEFAULT_PRIMARY_COLOR;
    const rgb = hexToRgb(primaryColor);
    const rootStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const baseConcept = applyBaseConceptClass();
    const baseConfig = themeConfig?.concepts?.[normalizeSkinId(baseConcept)] || {};

    rootStyle.setProperty("--primary-color", primaryColor);
    rootStyle.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    rootStyle.setProperty("--primary-hover", darkenHex(primaryColor, 10));
    applySharedThemeSurface(rootStyle, primaryColor);

    applyBuilderPalettes(bodyStyle, primaryColor);
    applyModuleClasses(themeConfig);
    applyBaseMediaConfig(baseConfig, rootStyle, bodyStyle, resolveCoverOpenLabel(themeConfig));
    applyModuleMedia(themeConfig, rootStyle, bodyStyle);
}
