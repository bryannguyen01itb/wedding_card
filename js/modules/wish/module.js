import { renderWishForm } from "./render.js";

/** Wish module — fixed concept-1 chrome (not buildable). */
export const wishModule = {
    id: "wish",
    label: "Nhắn gửi yêu thương",
    selector: ".wish",
    builderField: "blockWish",
    defaultSkin: "concept-1",
    order: 100,
    buildable: false,
    applySkin: false,
    cssFile: "css/blocks/wish/skins.css",
    skins: ["concept-1"],
    render: renderWishForm
};
