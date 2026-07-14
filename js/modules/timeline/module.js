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
    render: renderTimeline
};
