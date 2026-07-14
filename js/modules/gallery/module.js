import { renderGallerySection } from "./render.js";

/**
 * Gallery module — wedding photo album.
 * Skin options control layout behaviour so render code stays generic.
 */
export const galleryModule = {
    id: "gallery",
    label: "Album ảnh cưới",
    selector: ".gallery",
    builderField: "blockGallery",
    defaultSkin: "concept-1",
    order: 60,
    buildable: true,
    cssFile: "css/blocks/gallery/skins.css",
    // Concept 5 chỉ cho gallery — không hiện ở cover/poster/...
    skins: ["concept-1", "concept-2", "concept-3", "concept-4", "concept-5"],
    skinOptions: {
        default: {
            photoLimit: null,
            fixedLayout: false
        },
        "concept-1": {
            photoLimit: null,
            fixedLayout: false
        },
        "concept-2": {
            photoLimit: 7,
            fixedLayout: true
        },
        "concept-3": {
            photoLimit: 7,
            fixedLayout: true
        },
        "concept-4": {
            photoLimit: 7,
            fixedLayout: true
        },
        "concept-5": {
            photoLimit: 7,
            fixedLayout: true,
            layoutClass: "gallery-poster--journey",
            hideDecorations: true
        }
    },
    render: renderGallerySection
};
