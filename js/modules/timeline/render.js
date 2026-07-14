import { wedding } from "../../config.js";
import { createEl, setText, setOptionalText } from "../../utils/dom.js";
import { formatEventTime } from "../../utils/date.js";
import { setImageWithFallback } from "../../utils/mediaFallback.js";
import { resolveSectionSkin } from "../core/registry.js";

const TIMELINE_ORDER = [
    { role: "bride", person: "bride", side: "NHÀ GÁI" },
    { role: "groom", person: "groom", side: "NHÀ TRAI" }
];

function getTimelineSkin() {
    return resolveSectionSkin("timeline", wedding.theme?.blocks || {});
}

function createIconRow(className, icon, text) {
    const row = createEl("div", className);
    row.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span>${text}</span>`;
    return row;
}

function createTimelineEvent(title, time) {
    const event = createEl("div", "timeline-event");
    event.appendChild(createEl("div", "timeline-name", title));
    event.appendChild(createIconRow("timeline-row", "bi-clock-fill", time));
    return event;
}

function createTimelineImage(label) {
    const img = document.createElement("img");
    setImageWithFallback(img, wedding.ceremony.image, "timeline");
    img.alt = label;
    return img;
}

function createMapLink(event) {
    if (!event.mapUrl) return null;

    const mapLink = createEl("a", "timeline-map-link");
    mapLink.href = event.mapUrl;
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    mapLink.innerHTML = `<i class="bi bi-map-fill" aria-hidden="true"></i><span>${wedding.ceremony.mapButtonLabel || "Chỉ đường"}</span>`;
    return mapLink;
}

function createTimelineContent(event) {
    const content = createEl("div", "timeline-content");
    const events = createEl("div", "timeline-events");
    const mapLink = createMapLink(event);

    events.appendChild(createTimelineEvent(event.meal.title, event.meal.time));
    events.appendChild(createTimelineEvent(event.title, formatEventTime(wedding.date, event.time)));
    content.appendChild(events);
    content.appendChild(createIconRow("timeline-row timeline-address", "bi-geo-alt-fill", event.address));
    if (mapLink) content.appendChild(mapLink);

    return content;
}

function createTimelineCard(event, label, side) {
    const card = createEl("div", "timeline-card");
    card.appendChild(createEl("div", "timeline-side-badge", side));
    card.appendChild(createTimelineImage(label));
    card.appendChild(createTimelineContent(event));
    return card;
}

/** Concept 5: timeline dọc — icon → giờ → tên */
function createRitualStep(icon, title, time) {
    const step = createEl("div", "timeline-ritual-step");

    const iconWrap = createEl("div", "timeline-ritual-icon");
    iconWrap.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;

    const body = createEl("div", "timeline-ritual-body");
    body.appendChild(createEl("div", "timeline-ritual-time", time));
    body.appendChild(createEl("div", "timeline-ritual-title", title));

    step.appendChild(iconWrap);
    step.appendChild(body);
    return step;
}

function createRitualCard(event, side) {
    const card = createEl("div", "timeline-card timeline-card--ritual");
    card.appendChild(createEl("div", "timeline-side-badge", side));

    const ritual = createEl("div", "timeline-ritual");
    const mealTime = event.meal?.time || "";
    const mealTitle = event.meal?.title || "BỮA CƠM THÂN MẬT";
    const ceremonyTime = formatEventTime(wedding.date, event.time);
    const ceremonyTitle = event.title || "LỄ";

    ritual.appendChild(createRitualStep("bi-house-heart", ceremonyTitle, ceremonyTime));
    ritual.appendChild(createRitualStep("bi-cup-straw", mealTitle, mealTime));

    if (event.address) {
        const addr = createEl("div", "timeline-ritual-address");
        addr.innerHTML = `<i class="bi bi-geo-alt" aria-hidden="true"></i><span>${event.address}</span>`;
        ritual.appendChild(addr);
    }

    const mapLink = createMapLink(event);
    if (mapLink) {
        mapLink.classList.add("timeline-ritual-map");
        ritual.appendChild(mapLink);
    }

    card.appendChild(ritual);
    return card;
}

/**
 * Concept 6: itinerary xen kẽ icon trái/phải (kiểu thiệp)
 * 2 mục: lễ + bữa cơm / nhà
 * @param {boolean} iconOnLeft
 */
function createItineraryRow(icon, title, time, place, iconOnLeft) {
    const row = createEl(
        "div",
        `timeline-itin-row ${iconOnLeft ? "timeline-itin-row--icon-left" : "timeline-itin-row--icon-right"}`
    );

    const main = createEl("div", "timeline-itin-main");
    main.appendChild(createEl("div", "timeline-itin-title", title));
    main.appendChild(createEl("div", "timeline-itin-meta", time));
    if (place) {
        main.appendChild(createEl("div", "timeline-itin-place", place));
    }

    const iconWrap = createEl("div", "timeline-itin-icon");
    iconWrap.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;

    if (iconOnLeft) {
        row.appendChild(iconWrap);
        row.appendChild(main);
    } else {
        row.appendChild(main);
        row.appendChild(iconWrap);
    }

    return row;
}

function createItineraryCard(event, side) {
    const card = createEl("div", "timeline-card timeline-card--itin");
    card.appendChild(createEl("div", "timeline-side-badge", side));

    const list = createEl("div", "timeline-itin");
    const mealTime = event.meal?.time || "";
    const mealTitle = event.meal?.title || "BỮA CƠM THÂN MẬT";
    const ceremonyTime = formatEventTime(wedding.date, event.time);
    const ceremonyTitle = event.title || "LỄ";
    const place = event.address || "";

    // Lễ + bữa cơm — không gắn địa chỉ vào từng row (tránh lặp 2 lần / nhà)
    list.appendChild(createItineraryRow("bi-heart", ceremonyTitle, ceremonyTime, "", true));
    list.appendChild(createItineraryRow("bi-cup-straw", mealTitle, mealTime, "", false));

    // Mỗi nhà chỉ 1 dòng địa chỉ
    if (place) {
        const addr = createEl("div", "timeline-itin-address");
        addr.innerHTML = `<i class="bi bi-geo-alt" aria-hidden="true"></i><span>${place}</span>`;
        list.appendChild(addr);
    }

    const mapLink = createMapLink(event);
    if (mapLink) {
        mapLink.classList.add("timeline-itin-map");
        list.appendChild(mapLink);
    }

    card.appendChild(list);
    return card;
}

/**
 * Concept 7: line schedule — icon | chấm trục | giờ + title
 * 2 mục: lễ + bữa cơm / nhà
 */
function createLineStep(icon, title, time) {
    const step = createEl("div", "timeline-line-step");

    const iconWrap = createEl("div", "timeline-line-icon");
    iconWrap.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;

    const rail = createEl("div", "timeline-line-rail");
    rail.appendChild(createEl("span", "timeline-line-dot"));

    const body = createEl("div", "timeline-line-body");
    body.appendChild(createEl("div", "timeline-line-time", time));
    body.appendChild(createEl("div", "timeline-line-title", title));

    step.appendChild(iconWrap);
    step.appendChild(rail);
    step.appendChild(body);
    return step;
}

function createLineCard(event, side) {
    const card = createEl("div", "timeline-card timeline-card--line");
    card.appendChild(createEl("div", "timeline-side-badge", side));

    const list = createEl("div", "timeline-line");
    const mealTime = event.meal?.time || "";
    const mealTitle = event.meal?.title || "BỮA CƠM THÂN MẬT";
    const ceremonyTime = formatEventTime(wedding.date, event.time);
    const ceremonyTitle = event.title || "LỄ";

    list.appendChild(createLineStep("bi-heart", ceremonyTitle, ceremonyTime));
    list.appendChild(createLineStep("bi-cup-straw", mealTitle, mealTime));

    if (event.address) {
        const addr = createEl("div", "timeline-line-address");
        addr.innerHTML = `<i class="bi bi-geo-alt" aria-hidden="true"></i><span>${event.address}</span>`;
        list.appendChild(addr);
    }

    const mapLink = createMapLink(event);
    if (mapLink) {
        mapLink.classList.add("timeline-line-map");
        list.appendChild(mapLink);
    }

    card.appendChild(list);
    return card;
}

export function renderTimeline() {
    setText("timelineTitle", wedding.sections?.timeline);
    setOptionalText("timelineSubtitle", wedding.sectionSubtitles?.timeline);

    const container = document.getElementById("timelineCards");
    if (!container) return;

    const skin = getTimelineSkin();
    container.textContent = "";
    container.classList.toggle("timeline-cards--ritual", skin === "concept-5");
    container.classList.toggle("timeline-cards--itin", skin === "concept-6");
    container.classList.toggle("timeline-cards--line", skin === "concept-7");

    TIMELINE_ORDER.forEach(({ role, person, side }) => {
        const event = wedding.ceremony[role];
        if (!event) return;

        if (skin === "concept-5") {
            container.appendChild(createRitualCard(event, side));
        } else if (skin === "concept-6") {
            container.appendChild(createItineraryCard(event, side));
        } else if (skin === "concept-7") {
            container.appendChild(createLineCard(event, side));
        } else {
            container.appendChild(createTimelineCard(event, wedding[person].nickname, side));
        }
    });
}
