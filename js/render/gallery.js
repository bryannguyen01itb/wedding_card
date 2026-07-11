import { createEl } from "../utils/dom.js";
import { formatDate } from "../utils/date.js";

const DEFAULT_INTRO = {
    eyebrow: "WELCOME TO OUR",
    script: "love",
    title: "STORY",
    sideText: "SAVE THE DATE"
};

function normalizePhoto(item) {
    if (typeof item === "string") {
        return { src: item, alt: "" };
    }

    return item;
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

    introBlock.appendChild(createEl("div", "gallery-intro__eyebrow", intro.eyebrow));
    introBlock.appendChild(createEl("div", "gallery-intro__script", intro.script));
    introBlock.appendChild(createEl("div", "gallery-intro__title", intro.title));
    introBlock.appendChild(createEl("span", "gallery-intro__line"));
    introBlock.appendChild(createEl("div", "gallery-intro__date", formatDate(weddingDate)));

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

export function renderGallery(config, weddingDate) {
    const grid = document.querySelector(".gallery-grid");
    if (!grid) return;

    const { intro, photos } = normalizeGalleryConfig(config);
    const fixedConcept = document.body.classList.contains("concept-4");
    const allVisiblePhotos = photos.filter(photo => photo?.src);
    const visiblePhotos = fixedConcept ? allVisiblePhotos.slice(0, 7) : allVisiblePhotos;
    const layoutClass = getGalleryLayout(visiblePhotos.length, fixedConcept);

    grid.textContent = "";
    grid.classList.remove(
        "gallery-poster--few",
        "gallery-poster--medium",
        "gallery-poster--full",
        "gallery-poster--many",
        "gallery-poster--fixed"
    );
    grid.classList.add("gallery-poster", layoutClass);

    grid.appendChild(createIntroBlock(intro, weddingDate));

    visiblePhotos.forEach((photo, index) => {
        grid.appendChild(createGalleryPhoto(photo, index));
    });

    const sideText = createEl("div", "gallery-side-text", intro.sideText);
    const fanTop = createEl("span", "gallery-fan gallery-fan--top");
    const fanBottom = createEl("span", "gallery-fan gallery-fan--bottom");

    grid.appendChild(sideText);
    grid.appendChild(fanTop);
    grid.appendChild(fanBottom);
}
