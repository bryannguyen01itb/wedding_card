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
    const toHex = v => Math.round(v * ratio).toString(16).padStart(2, "0");
    return "#" + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
}

function rgbToHex({ r, g, b }) {
    const toHex = v => Math.round(v).toString(16).padStart(2, "0");
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

function normalizeConcept(concept) {
    const value = String(concept || "concept-1").trim().toLowerCase();

    if (["2", "concept2", "concept-2", "botanical", "botanical-airy"].includes(value)) {
        return "concept-2";
    }

    if (["3", "concept3", "concept-3", "sunset", "sunset-pop"].includes(value)) {
        return "concept-3";
    }

    return "concept-1";
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

function applyConcept(concept) {
    const activeConcept = normalizeConcept(concept);
    document.body.classList.remove("concept-1", "concept-2", "concept-3");
    document.body.classList.add(activeConcept);
    document.body.dataset.concept = activeConcept;
    return activeConcept;
}

function applyConceptOneConfig(config, rootStyle) {
    setImageVar(rootStyle, "--site-background-image", config?.images?.background);
    setImageVar(rootStyle, "--countdown-image", config?.images?.countdown);
}

function setColorVar(target, name, value) {
    if (!value) return;
    const rgb = hexToRgb(value);
    setVar(target, name, value);
    setVar(target, name + "-rgb", rgb.r + ", " + rgb.g + ", " + rgb.b);
}

function applyConceptTwoConfig(config, rootStyle, bodyStyle, primaryColor) {
    const colors = createBotanicalPalette(primaryColor);

    setColorVar(bodyStyle, "--botanical-ink", colors.ink);
    setColorVar(bodyStyle, "--botanical-muted", colors.muted);
    setColorVar(bodyStyle, "--botanical-paper", colors.paper);
    setColorVar(bodyStyle, "--botanical-cream", colors.cream);
    setColorVar(bodyStyle, "--botanical-mint", colors.mint);
    setColorVar(bodyStyle, "--botanical-leaf", colors.leaf);
    setColorVar(bodyStyle, "--botanical-rose", colors.rose);
    setColorVar(bodyStyle, "--botanical-clay", colors.clay);

    applyConceptMediaConfig(config, rootStyle, bodyStyle, "open invitation");
}

function applyConceptThreeConfig(config, rootStyle, bodyStyle, primaryColor) {
    const colors = createSunsetPalette(primaryColor);

    setColorVar(bodyStyle, "--sunset-ink", colors.ink);
    setColorVar(bodyStyle, "--sunset-muted", colors.muted);
    setColorVar(bodyStyle, "--sunset-paper", colors.paper);
    setColorVar(bodyStyle, "--sunset-cream", colors.cream);
    setColorVar(bodyStyle, "--sunset-peach", colors.peach);
    setColorVar(bodyStyle, "--sunset-coral", colors.coral);
    setColorVar(bodyStyle, "--sunset-lavender", colors.lavender);
    setColorVar(bodyStyle, "--sunset-sky", colors.sky);
    setColorVar(bodyStyle, "--sunset-lemon", colors.lemon);

    applyConceptMediaConfig(config, rootStyle, bodyStyle, "tap to open");
}

function applyConceptMediaConfig(config, rootStyle, bodyStyle, defaultCoverLabel) {
    setImageVar(rootStyle, "--site-background-image", config?.images?.background);
    setImageVar(rootStyle, "--countdown-image", config?.images?.countdown);
    setImageVar(bodyStyle, "--concept-background-image", config?.images?.background);
    setImageVar(bodyStyle, "--concept-cover-image", config?.images?.cover);
    setImageVar(bodyStyle, "--concept-countdown-image", config?.images?.countdown);

    setVar(bodyStyle, "--concept-cover-label", toCssString(config?.cover?.openLabel || defaultCoverLabel));
}

export function applyTheme(theme = {}) {
    const themeConfig = typeof theme === "string"
        ? { primaryColor: theme }
        : theme;
    const primaryColor = themeConfig?.primaryColor || "#8fb8a8";
    const rgb = hexToRgb(primaryColor);
    const rootStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const activeConcept = applyConcept(themeConfig?.concept);
    const conceptConfig = themeConfig?.concepts?.[activeConcept] || {};

    rootStyle.setProperty("--primary-color", primaryColor);
    rootStyle.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    rootStyle.setProperty("--primary-hover", darkenHex(primaryColor, 10));

    if (activeConcept === "concept-2") {
        applyConceptTwoConfig(conceptConfig, rootStyle, bodyStyle, primaryColor);
        return;
    }

    if (activeConcept === "concept-3") {
        applyConceptThreeConfig(conceptConfig, rootStyle, bodyStyle, primaryColor);
        return;
    }

    applyConceptOneConfig(conceptConfig, rootStyle);
}
