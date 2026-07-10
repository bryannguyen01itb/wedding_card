import { wedding } from "../config.js";
import { setText, setSrc, setHtml, createEl } from "../utils/dom.js";
import { formatDate, formatEventTime } from "../utils/date.js";
import { applyTheme } from "../utils/theme.js";

function renderPerson(type, person) {
    setSrc(`${type}Avatar`, person.avatar);
    setText(`${type}Name`, person.fullName);
    setText(`${type}Father`, `Con ông: ${person.father}`);
    setText(`${type}Mother`, `và bà: ${person.mother}`);
}

function createTimelineEvent(title, time) {
    const event = createEl("div", "timeline-event");
    event.appendChild(createEl("div", "timeline-name", title));

    const row = createEl("div", "timeline-row");
    row.innerHTML = `<i class="bi bi-clock-fill"></i><span>${time}</span>`;
    event.appendChild(row);

    return event;
}

function renderTimelineCard(type, event, label) {
    const card = createEl("div", "timeline-card");

    const img = document.createElement("img");
    img.src = wedding.ceremony.image;
    img.alt = label;
    card.appendChild(img);

    const content = createEl("div", "timeline-content");
    const events = createEl("div", "timeline-events");

    events.appendChild(createTimelineEvent(event.meal.title, event.meal.time));
    events.appendChild(createTimelineEvent(event.title, formatEventTime(wedding.date, event.time)));
    content.appendChild(events);

    const address = createEl("div", "timeline-row timeline-address");
    address.innerHTML = `<i class="bi bi-geo-alt-fill"></i><span>${event.address}</span>`;
    content.appendChild(address);

    card.appendChild(content);
    return card;
}

function renderTimeline() {
    const container = document.getElementById("timelineCards");
    if (!container) return;

    container.appendChild(renderTimelineCard("bride", wedding.ceremony.bride, "Cô dâu"));
    container.appendChild(renderTimelineCard("groom", wedding.ceremony.groom, "Chú rể"));
}

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

function renderGallery(items) {
    const grid = document.querySelector(".gallery-grid");
    if (!grid) return;

    grid.textContent = "";

    items.forEach(item => {
        const normalized = typeof item === "string" ? { type: "image", src: item } : item;
        const tile = createEl("div", `gallery-item ${normalized.type === "text" ? "gallery-text" : "gallery-photo"}`);

        if (normalized.size) {
            tile.classList.add(`gallery-item--${normalized.size}`);
        }

        tile.appendChild(normalized.type === "text"
            ? createGalleryText(normalized)
            : createGalleryImage(normalized));

        grid.appendChild(tile);
    });
}

function renderGiftCard(type, gift, label) {
    const card = createEl("div", "gift-card");
    card.innerHTML = `
        <div class="gift-name">${label}</div>
        <img class="gift-qr" src="${gift.qr}" alt="QR ${label}">
        <div class="gift-bank">${gift.bank}</div>
        <div class="gift-account-name">${gift.accountName}</div>
        <div class="copy-box copy-number">
            <span>${gift.accountNumber}</span>
            <i class="bi bi-clipboard"></i>
        </div>
    `;
    return card;
}

function renderGift() {
    const container = document.getElementById("giftCards");
    if (!container) return;

    container.appendChild(renderGiftCard("groom", wedding.gift.groom, "CHÚ RỂ"));
    container.appendChild(renderGiftCard("bride", wedding.gift.bride, "CÔ DÂU"));
}

function renderHeader() {
    setText("invitationHeader", wedding.header.logo);
}

function renderCover() {
    const date = formatDate(wedding.date);
    const { groom, bride } = wedding;

    setText("coverHeadline", wedding.cover.headline);
    setText("coverGroom", groom.nickname);
    setText("coverBride", bride.nickname);
    setText("coverDate", date);
}

function renderPoster() {
    const date = formatDate(wedding.date);
    const { groom, bride } = wedding;

    setSrc("posterImage", wedding.poster.image);
    setText("posterGroom", groom.nickname);
    setText("posterBride", bride.nickname);
    setText("posterDate", date);
    setText("posterLocation", wedding.location);
}

function renderSections() {
    const { sections } = wedding;

    setText("saveDateTitle", sections.saveDate);
    setText("aboutTitle", sections.about);
    setText("timelineTitle", sections.timeline);
    setText("galleryTitle", sections.gallery);
    setText("wishTitle", sections.wish);
    setText("giftTitle", sections.gift.title);
    setText("giftDesc", sections.gift.description);
    setText("giftOpenLabel", sections.gift.openLabel);
    setText("countdownTitle", sections.countdown);
    setText("thanksTitle", sections.thanks.title);
    setHtml("thanksContent", sections.thanks.paragraphs.join("<br><br>"));
}

function renderThanksSign() {
    setText("thanksGroom", wedding.groom.nickname);
    setText("thanksBride", wedding.bride.nickname);
}

export function renderContent() {
    applyTheme(wedding.theme?.primaryColor);

    renderHeader();
    renderCover();
    renderPoster();
    renderSections();
    renderThanksSign();
    renderPerson("groom", wedding.groom);
    renderPerson("bride", wedding.bride);
    renderTimeline();
    renderGallery(wedding.gallery);
    renderGift();
}

export { wedding };
