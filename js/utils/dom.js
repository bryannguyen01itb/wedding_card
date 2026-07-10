export function $(id) {
    return document.getElementById(id);
}

export function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

export function setSrc(id, value) {
    const el = $(id);
    if (el) el.src = value;
}

export function bindClick(element, handler) {
    element?.addEventListener("click", handler);
}

export function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}
