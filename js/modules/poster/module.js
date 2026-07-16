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
    /**
     * c5 = mép sóng chéo + text/date/location góc dưới trái
     * c6 = nền primary tint, tên giữa header–ảnh, ảnh chạm đáy; ẩn date/location
     * (CSS only — renderPoster dùng chung mọi concept)
     */
    skins: ["concept-1", "concept-2", "concept-3", "concept-4", "concept-5", "concept-6"],
    render: renderPoster
};
