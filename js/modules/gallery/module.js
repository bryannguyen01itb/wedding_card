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
        }
    },
    render: renderGallerySection
};
