/**
 * Orchestrates rendering for every registered module.
 * Order is explicit for layout stability; each module owns its own DOM fill.
 */
import { wedding } from "../config.js";
import { bootstrapModules, getRegisteredSections } from "./index.js";
import { applyTheme } from "../utils/theme.js";
import { renderHeader } from "./shell/header.js";
import { injectThemeFontStyles } from "../utils/fonts.js";
import { normalizeToken } from "./core/registry.js";

export function renderContent() {
    bootstrapModules();
    applyTheme(wedding.theme, {
        ceremonyMode: wedding.ceremony?.mode === "joint" ? "joint" : "separate"
    });
    renderHeader();

    getRegisteredSections().forEach(section => {
        if (typeof section.render === "function") {
            section.render(wedding);
        }
    });

    // Re-apply fonts after modules fill names (cover/poster) — style tag always last
    const fonts = wedding.theme?.fonts || {};
    injectThemeFontStyles(
        normalizeToken(fonts.body || "quicksand"),
        normalizeToken(fonts.nickname || "great-vibes")
    );

    requestAnimationFrame(() => {
        document.body.classList.remove("concept-loading");
    });
}
