import { renderSaveDate } from "./render.js";

/** Save-the-date / calendar module. */
export const saveDateModule = {
    id: "saveDate",
    label: "Lịch (Save the date)",
    selector: ".save-date",
    builderField: "blockSaveDate",
    defaultSkin: "concept-1",
    order: 30,
    buildable: true,
    cssFile: "css/blocks/save-date/skins.css",
    render: renderSaveDate
};
