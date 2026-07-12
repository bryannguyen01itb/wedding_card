import { wedding } from "../config.js";
import { setText, setSrc, setSplitName, createEl } from "../utils/dom.js";
import { formatDate } from "../utils/date.js";

const MENU_SECTIONS = [
    ["saveDateSection", () => wedding.sections.saveDate],
    ["aboutSection", () => wedding.sections.about],
    ["timelineSection", () => wedding.sections.timeline],
    ["gallerySection", () => wedding.sections.gallery],
    ["wishSection", () => wedding.sections.wish],
    ["giftSection", () => wedding.sections.gift.title],
    ["countdownSection", () => wedding.sections.countdown.title],
    ["thanksSection", () => wedding.sections.thanks.title]
];

function createMenuButton() {
    const button = createEl("button", "invitation-menu__toggle");
    button.type = "button";
    button.id = "invitationMenuToggle";
    button.setAttribute("aria-label", "Mở menu");
    button.setAttribute("aria-expanded", "false");
    button.appendChild(Object.assign(document.createElement("i"), { className: "bi bi-list" }));
    return button;
}

function createMenuItem(target, label) {
    const item = createEl("button", "invitation-menu__item", label);
    item.type = "button";
    item.dataset.target = target;
    return item;
}

function createMenuPanel() {
    const panel = createEl("nav", "invitation-menu");
    panel.id = "invitationMenu";
    panel.setAttribute("aria-label", "Menu điều hướng thiệp cưới");

    MENU_SECTIONS.forEach(([target, getLabel]) => {
        panel.appendChild(createMenuItem(target, getLabel()));
    });

    return panel;
}

export function renderHeader() {
    const header = document.getElementById("invitationHeader");
    if (!header) return;

    header.textContent = "";
    header.appendChild(createMenuButton());
    header.appendChild(createMenuPanel());
    header.appendChild(createEl("div", "invitation__logo", wedding.header.logo));
}

export function renderCover() {
    const { groom, bride } = wedding;

    setText("coverHeadline", wedding.cover.headline);
    setSplitName("coverGroom", groom.nickname);
    setSplitName("coverBride", bride.nickname);
    setText("coverDate", formatDate(wedding.date));
}

export function renderPoster() {
    const { groom, bride } = wedding;

    setSrc("posterImage", wedding.poster.image);
    setText("posterGroom", groom.nickname);
    setText("posterBride", bride.nickname);
    setText("posterDate", formatDate(wedding.date));
    setText("posterLocation", wedding.location);
}
