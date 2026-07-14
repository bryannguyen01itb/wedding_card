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
    render: renderTimeline
};
