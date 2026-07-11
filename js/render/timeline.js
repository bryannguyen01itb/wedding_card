import { wedding } from "../config.js";
import { createEl } from "../utils/dom.js";
import { formatEventTime } from "../utils/date.js";

const TIMELINE_ORDER = [
    { role: "bride", person: "bride", side: "NHÀ GÁI" },
    { role: "groom", person: "groom", side: "NHÀ TRAI" }
];

function createTimelineEvent(title, time) {
    const event = createEl("div", "timeline-event");
    event.appendChild(createEl("div", "timeline-name", title));

    const row = createEl("div", "timeline-row");
    row.innerHTML = `<i class="bi bi-clock-fill"></i><span>${time}</span>`;
    event.appendChild(row);

    return event;
}

function createTimelineCard(event, label, side) {
    const card = createEl("div", "timeline-card");
    card.appendChild(createEl("div", "timeline-side-badge", side));

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

    if (event.mapUrl) {
        const mapLink = createEl("a", "timeline-map-link");
        mapLink.href = event.mapUrl;
        mapLink.target = "_blank";
        mapLink.rel = "noopener noreferrer";
        mapLink.innerHTML = `<i class="bi bi-map-fill"></i><span>${wedding.ceremony.mapButtonLabel || "Chỉ đường"}</span>`;
        content.appendChild(mapLink);
    }

    card.appendChild(content);
    return card;
}

export function renderTimeline() {
    const container = document.getElementById("timelineCards");
    if (!container) return;

    TIMELINE_ORDER.forEach(({ role, person, side }) => {
        container.appendChild(
            createTimelineCard(wedding.ceremony[role], wedding[person].nickname, side)
        );
    });
}
