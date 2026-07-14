import { wedding } from "../config.js";
import { createEl } from "../utils/dom.js";
import { formatEventTime } from "../utils/date.js";
import { setImageWithFallback } from "../utils/mediaFallback.js";

const TIMELINE_ORDER = [
    { role: "bride", person: "bride", side: "NHÀ GÁI" },
    { role: "groom", person: "groom", side: "NHÀ TRAI" }
];

function createIconRow(className, icon, text) {
    const row = createEl("div", className);
    row.innerHTML = `<i class="bi ${icon}"></i><span>${text}</span>`;
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
    mapLink.innerHTML = `<i class="bi bi-map-fill"></i><span>${wedding.ceremony.mapButtonLabel || "Chỉ đường"}</span>`;
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

export function renderTimeline() {
    const container = document.getElementById("timelineCards");
    if (!container) return;

    TIMELINE_ORDER.forEach(({ role, person, side }) => {
        container.appendChild(createTimelineCard(wedding.ceremony[role], wedding[person].nickname, side));
    });
}
