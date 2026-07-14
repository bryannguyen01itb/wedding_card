/**
 * Shared skin (concept) catalog.
 * Skins are visual variants that sections can opt into.
 * Add concept-5+ here; then add CSS for sections that support it.
 */
import { registerSkin } from "./registry.js";

export const SKIN_DEFINITIONS = [
    {
        id: "concept-1",
        label: "Concept 1",
        aliases: ["1", "concept1", "classic"],
        openLabel: "Mở thiệp",
        palette: "none"
    },
    {
        id: "concept-2",
        label: "Concept 2",
        aliases: ["2", "concept2", "botanical", "botanical-airy"],
        openLabel: "open invitation",
        palette: "botanical"
    },
    {
        id: "concept-3",
        label: "Concept 3",
        aliases: ["3", "concept3", "sunset", "sunset-pop"],
        openLabel: "tap to open",
        palette: "sunset"
    },
    {
        id: "concept-4",
        label: "Concept 4",
        aliases: ["4", "concept4", "mehappy", "mehappy-soft"],
        openLabel: "Chạm để mở",
        palette: "none"
    }
];

export function registerAllSkins() {
    SKIN_DEFINITIONS.forEach(registerSkin);
}
