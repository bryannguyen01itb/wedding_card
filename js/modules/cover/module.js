import { renderCover } from "./render.js";

/** Cover module — opening card / invitation front. */
export const coverModule = {
    id: "cover",
    label: "Ảnh bìa thiệp",
    selector: ".cover",
    builderField: "blockCover",
    defaultSkin: "concept-1",
    order: 10,
    buildable: true,
    cssFile: "css/blocks/cover/skins.css",
    media: {
        coverImage: true,
        openLabel: true
    },
    render: renderCover
};
