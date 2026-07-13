import { createEl } from "../utils/dom.js";
import { formatDate } from "../utils/date.js";

const DEFAULT_INTRO = {
    eyebrow: "WELCOME TO OUR",
    script: "love",
    title: "STORY",
    sideText: "SAVE THE DATE"
};

const GALLERY_LAYOUT_CLASSES = [
    "gallery-poster--few",
    "gallery-poster--medium",
    "gallery-poster--full",
    "gallery-poster--many",
    "gallery-poster--fixed"
];

const FIXED_GALLERY_PHOTO_LIMIT = 7;

function normalizePhoto(item) {
    return typeof item === "string" ? { src: item, alt: "" } : item;
}

function normalizeGalleryConfig(config) {
    if (Array.isArray(config)) {
        return {
            intro: DEFAULT_INTRO,
            photos: config
                .filter(item => typeof item === "string" || item.type !== "text")
                .map(normalizePhoto)
        };
    }

    return {
        intro: { ...DEFAULT_INTRO, ...(config?.intro || {}) },
        photos: (config?.photos || []).map(normalizePhoto)
    };
}

function createIntroBlock(intro, weddingDate) {
    const introBlock = createEl("div", "gallery-intro gallery-item");
    const introParts = [
        ["div", "gallery-intro__eyebrow", intro.eyebrow],
        ["div", "gallery-intro__script", intro.script],
        ["div", "gallery-intro__title", intro.title],
        ["span", "gallery-intro__line"],
        ["div", "gallery-intro__date", formatDate(weddingDate)]
    ];

    introParts.forEach(([tag, className, text]) => {
        introBlock.appendChild(createEl(tag, className, text));
    });

    return introBlock;
}

function getGalleryLayout(photoCount, fixedLayout) {
    if (fixedLayout) return "gallery-poster--fixed";
    if (photoCount >= 10) return "gallery-poster--many";
    if (photoCount >= 8) return "gallery-poster--full";
    if (photoCount >= 6) return "gallery-poster--medium";
    return "gallery-poster--few";
}

function createGalleryPhoto(photo, index) {
    const frame = createEl("figure", `gallery-frame gallery-frame--${index + 1} gallery-item`);
    const img = document.createElement("img");

    img.src = photo.src;
    img.alt = photo.alt || "";
    img.loading = "lazy";

    frame.appendChild(img);
    return frame;
}

function addGalleryDecorations(grid, sideText) {
    grid.appendChild(createEl("div", "gallery-side-text", sideText));
    grid.appendChild(createEl("span", "gallery-fan gallery-fan--top"));
    grid.appendChild(createEl("span", "gallery-fan gallery-fan--bottom"));
}

export function renderGallery(config, weddingDate) {
    const grid = document.querySelector(".gallery-grid");
    if (!grid) return;

    const { intro, photos } = normalizeGalleryConfig(config);
    const fixedConcept = document.body.classList.contains("concept-2")
        || document.body.classList.contains("concept-3")
        || document.body.classList.contains("concept-4");
    const validPhotos = photos.filter(photo => photo?.src);
    const visiblePhotos = fixedConcept
        ? validPhotos.slice(0, FIXED_GALLERY_PHOTO_LIMIT)
        : validPhotos;
    const layoutClass = getGalleryLayout(visiblePhotos.length, fixedConcept);

    grid.textContent = "";
    grid.classList.remove(...GALLERY_LAYOUT_CLASSES);
    grid.classList.add("gallery-poster", layoutClass);
    grid.appendChild(createIntroBlock(intro, weddingDate));

    visiblePhotos.forEach((photo, index) => {
        grid.appendChild(createGalleryPhoto(photo, index));
    });

    addGalleryDecorations(grid, intro.sideText);
}
