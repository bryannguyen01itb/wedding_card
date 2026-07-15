import { renderTimeline } from "./render.js";

/** Timeline / ceremony schedule module. */
export const timelineModule = {
    id: "timeline",
    label: "Lịch trình",
    selector: ".timeline",
    builderField: "blockTimeline",
    defaultSkin: "concept-1",
    order: 50,
    buildable: true,
    cssFile: "css/blocks/timeline/skins.css",
    // Concept 5–7 chỉ cho timeline
    skins: ["concept-1", "concept-2", "concept-3", "concept-4", "concept-5", "concept-6", "concept-7"],
    /**
     * usesCeremonyImage: concept 1–3 hiện ảnh ceremony; 4–7 CSS ẩn img → không upload.
     */
    skinOptions: {
        default: { usesCeremonyImage: true },
        "concept-1": { usesCeremonyImage: true },
        "concept-2": { usesCeremonyImage: true },
        "concept-3": { usesCeremonyImage: true },
        "concept-4": { usesCeremonyImage: false },
        "concept-5": { usesCeremonyImage: false },
        "concept-6": { usesCeremonyImage: false },
        "concept-7": { usesCeremonyImage: false }
    },
    render: renderTimeline
};
