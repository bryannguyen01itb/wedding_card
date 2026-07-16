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
    },
    {
        id: "concept-5",
        /* Poster: góc dưới phải · Gallery: journey · Timeline: ritual */
        label: "Concept 5",
        aliases: ["5", "concept5", "journey", "editorial"],
        openLabel: "Open",
        palette: "none"
    },
    {
        id: "concept-6",
        label: "Concept 6",
        aliases: ["6", "concept6", "itinerary", "weekend"],
        openLabel: "Open",
        palette: "none"
    },
    {
        id: "concept-7",
        label: "Concept 7",
        aliases: ["7", "concept7", "line", "schedule"],
        openLabel: "Open",
        palette: "none"
    },
    {
        id: "joint-1",
        label: "Chung · Concept 1 (trục dọc)",
        aliases: ["joint1", "joint-line", "joint-timeline"],
        openLabel: "Open",
        palette: "none"
    },
    {
        id: "joint-2",
        label: "Chung · Concept 2 (đường sóng)",
        aliases: ["joint2", "joint-wave", "joint-wavy"],
        openLabel: "Open",
        palette: "none"
    },
    {
        id: "joint-3",
        label: "Chung · Concept 3 (trục xen kẽ)",
        aliases: ["joint3", "joint-split", "joint-zigzag"],
        openLabel: "Open",
        palette: "none"
    }
];

export function registerAllSkins() {
    SKIN_DEFINITIONS.forEach(registerSkin);
}
