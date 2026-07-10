import { wedding } from "../config.js";
import { setText, setSrc } from "../utils/dom.js";
import { formatDate } from "../utils/date.js";

const MENU_ITEMS = [
    { target: "saveDateSection", label: () => wedding.sections.saveDate },
    { target: "aboutSection", label: () => wedding.sections.about },
    { target: "timelineSection", label: () => wedding.sections.timeline },
    { target: "gallerySection", label: () => wedding.sections.gallery },
    { target: "wishSection", label: () => wedding.sections.wish },
    { target: "giftSection", label: () => wedding.sections.gift.title },
    { target: "countdownSection", label: () => wedding.sections.countdown.title },
    { target: "thanksSection", label: () => wedding.sections.thanks.title }
];

function createMenuButton() {
    const button = document.createElement("button");
    button.className = "invitation-menu__toggle";
    button.type = "button";
    button.id = "invitationMenuToggle";
    button.setAttribute("aria-label", "Mở menu");
    button.setAttribute("aria-expanded", "false");

    const icon = document.createElement("i");
    icon.className = "bi bi-list";
    button.appendChild(icon);

    return button;
}

function createMenuPanel() {
    const panel = document.createElement("nav");
    panel.className = "invitation-menu";
    panel.id = "invitationMenu";
    panel.setAttribute("aria-label", "Menu điều hướng thiệp cưới");

    MENU_ITEMS.forEach(item => {
        const link = document.createElement("button");
        link.className = "invitation-menu__item";
        link.type = "button";
        link.dataset.target = item.target;
        link.textContent = item.label();
        panel.appendChild(link);
    });

    return panel;
}

export function renderHeader() {
    const header = document.getElementById("invitationHeader");
    if (!header) return;

    header.textContent = "";
    header.appendChild(createMenuButton());
    header.appendChild(createMenuPanel());
    header.appendChild(Object.assign(document.createElement("div"), {
        className: "invitation__logo",
        textContent: wedding.header.logo
    }));
}

export function renderCover() {
    const { groom, bride } = wedding;

    setText("coverHeadline", wedding.cover.headline);
    setText("coverGroom", groom.nickname);
    setText("coverBride", bride.nickname);
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
