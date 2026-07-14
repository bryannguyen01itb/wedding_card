/**
 * Orchestrates rendering for every registered module.
 * Order is explicit for layout stability; each module owns its own DOM fill.
 */
import { wedding } from "../config.js";
import { bootstrapModules, getRegisteredSections } from "./index.js";
import { applyTheme } from "../utils/theme.js";
import { renderHeader } from "./shell/header.js";

export function renderContent() {
    bootstrapModules();
    applyTheme(wedding.theme);
    renderHeader();

    getRegisteredSections().forEach(section => {
        if (typeof section.render === "function") {
            section.render(wedding);
        }
    });

    requestAnimationFrame(() => {
        document.body.classList.remove("concept-loading");
    });
}
