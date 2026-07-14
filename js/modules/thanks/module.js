import { renderThanks } from "./render.js";

/** Thanks module — fixed concept-1 chrome (not buildable). */
export const thanksModule = {
    id: "thanks",
    label: "Lời cảm ơn",
    selector: ".thanks",
    builderField: "blockThanks",
    defaultSkin: "concept-1",
    order: 110,
    buildable: false,
    applySkin: false,
    cssFile: "css/blocks/thanks/skins.css",
    skins: ["concept-1"],
    render: renderThanks
};
