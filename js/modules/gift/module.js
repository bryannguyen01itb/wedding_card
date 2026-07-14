import { renderGift } from "./render.js";

/**
 * Gift module — fixed concept-1 chrome (not buildable).
 * Registered so ownership is clear; skin stays concept-1.
 */
export const giftModule = {
    id: "gift",
    label: "Hộp mừng cưới",
    selector: ".gift",
    builderField: "blockGift",
    defaultSkin: "concept-1",
    order: 90,
    buildable: false,
    applySkin: false,
    cssFile: "css/blocks/gift/skins.css",
    skins: ["concept-1"],
    render: renderGift
};
