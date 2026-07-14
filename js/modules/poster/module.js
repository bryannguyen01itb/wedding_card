import { renderPoster } from "./render.js";

/** Poster module — hero image after opening the card. */
export const posterModule = {
    id: "poster",
    label: "Ảnh poster thiệp",
    selector: ".poster",
    builderField: "blockPoster",
    defaultSkin: "concept-1",
    order: 20,
    buildable: true,
    cssFile: "css/blocks/poster/skins.css",
    render: renderPoster
};
