/** Titles are now owned by each section module's render(). */
export { renderThanks } from "../modules/thanks/render.js";
export { renderSaveDate } from "../modules/save-date/render.js";
export { renderCountdown } from "../modules/countdown/render.js";

/** @deprecated Use per-module render functions instead. */
export function renderSectionTitles() {
    // Kept as a no-op-safe aggregate for any leftover callers.
    // Prefer renderContent() which runs every module.render.
    console.warn("[wedding] renderSectionTitles() is deprecated — use module render pipeline");
}
