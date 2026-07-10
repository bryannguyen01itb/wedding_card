import { createEl } from "../utils/dom.js";

function createGalleryImage(item) {
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.alt || "";
    return img;
}

function createGalleryText(item) {
    const content = createEl("div", "gallery-text__content");
    content.appendChild(createEl("div", "gallery-text__title", item.title || ""));
    content.appendChild(createEl("div", "gallery-text__subtitle", item.subtitle || ""));
    return content;
}

export function renderGallery(items) {
    const grid = document.querySelector(".gallery-grid");
    if (!grid) return;

    grid.textContent = "";

    items.forEach(item => {
        const normalized = typeof item === "string" ? { type: "image", src: item } : item;
        const tile = createEl(
            "div",
            `gallery-item ${normalized.type === "text" ? "gallery-text" : "gallery-photo"}`
        );

        if (normalized.size) {
            tile.classList.add(`gallery-item--${normalized.size}`);
        }

        tile.appendChild(
            normalized.type === "text"
                ? createGalleryText(normalized)
                : createGalleryImage(normalized)
        );

        grid.appendChild(tile);
    });
}
