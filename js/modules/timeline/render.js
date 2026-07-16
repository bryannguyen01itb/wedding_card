import { wedding } from "../../config.js";
import { createEl, setText, setOptionalText } from "../../utils/dom.js";
import { formatEventTime } from "../../utils/date.js";
import { setImageWithFallback } from "../../utils/mediaFallback.js";
import { resolveSectionSkin } from "../core/registry.js";

const TIMELINE_ORDER = [
    { role: "bride", person: "bride", side: "NHÀ GÁI" },
    { role: "groom", person: "groom", side: "NHÀ TRAI" }
];

function getCeremonyMode() {
    return wedding.ceremony?.mode === "joint" ? "joint" : "separate";
}

function getTimelineSkin() {
    return resolveSectionSkin("timeline", wedding.theme?.blocks || {}, {
        ceremonyMode: getCeremonyMode()
    });
}

/** Ngày hiển thị cho từng lễ: event.date → wedding.date */
function formatCeremonyTime(event) {
    const date = event?.date || wedding.date;
    return formatEventTime(date, event?.time || "");
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
    // Thiệp cũ không ceremony.image trên Firebase → dùng ảnh mẫu project (không img/{id}/timeline)
    const src = String(wedding.ceremony?.image || "").trim() || "img/anh_2.jpg";
    setImageWithFallback(img, src, "timeline");
    img.alt = label;
    return img;
}

/** mapUrl riêng → hoặc search theo địa chỉ (joint thường chỉ nhập address). */
function resolveMapUrl(event) {
    const direct = String(event?.mapUrl || "").trim();
    if (direct) return direct;

    const address = String(event?.address || "").trim();
    if (!address) return "";

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function createMapLink(event) {
    const href = resolveMapUrl(event);
    if (!href) return null;

    const mapLink = createEl("a", "timeline-map-link");
    mapLink.href = href;
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    mapLink.innerHTML = `<i class="bi bi-map-fill" aria-hidden="true"></i><span>${wedding.ceremony?.mapButtonLabel || "Chỉ đường"}</span>`;
    return mapLink;
}

/** Footer địa chỉ + Chỉ đường — tách khỏi layout trục/sóng để luôn hiện. */
function appendJointFooter(parent, joint, prefix) {
    const footer = createEl("div", `timeline-joint-footer ${prefix}-footer`);

    if (joint.address) {
        const addr = createEl("div", `${prefix}-address timeline-joint-footer__address`);
        addr.innerHTML = `<i class="bi bi-geo-alt" aria-hidden="true"></i><span>${joint.address}</span>`;
        footer.appendChild(addr);
    }

    const mapLink = createMapLink(joint);
    if (mapLink) {
        mapLink.classList.add(`${prefix}-map`, "timeline-joint-footer__map");
        footer.appendChild(mapLink);
    }

    if (footer.childNodes.length) {
        parent.appendChild(footer);
    }
}

/** Chỉ phần giờ (bỏ "• ngày" nếu có). */
function shortTimeLabel(timeStr) {
    return String(timeStr || "").split("•")[0].trim() || "";
}

const HOUSE_ICON_BI = {
    cup: "bi-cup-hot",
    hearts: "bi-hearts",
    camera: "bi-camera",
    mic: "bi-mic",
    music: "bi-music-note-beamed",
    gift: "bi-gift",
    car: "bi-car-front",
    star: "bi-stars"
};

const HOUSE_ICON_FALLBACK = [
    "bi-cup-straw",
    "bi-house-heart",
    "bi-camera",
    "bi-mic",
    "bi-music-note-beamed",
    "bi-gift",
    "bi-car-front",
    "bi-stars"
];

function resolveHouseEventIcon(iconId, index) {
    const key = String(iconId || "").trim();
    if (key && HOUSE_ICON_BI[key]) return HOUSE_ICON_BI[key];
    if (key.startsWith("bi-")) return key;
    return HOUSE_ICON_FALLBACK[index % HOUSE_ICON_FALLBACK.length];
}

function formatHouseEventTime(ev) {
    const timeOnly = shortTimeLabel(ev?.time);
    if (!timeOnly) return "";
    if (String(ev?.time || "").includes("•")) return String(ev.time).trim();
    const date = ev?.date || wedding.date;
    return formatEventTime(date, timeOnly);
}

/**
 * N sự kiện / nhà (events[]) hoặc migrate title/time/meal cũ.
 * @param {object} house — ceremony.bride | ceremony.groom
 */
function getHouseEvents(house = {}) {
    let raw = [];

    if (Array.isArray(house.events) && house.events.length) {
        raw = house.events;
    } else {
        if (house.meal?.title || house.meal?.time) {
            raw.push({
                title: house.meal?.title || "BỮA CƠM THÂN MẬT",
                time: house.meal?.time || "",
                date: wedding.date,
                icon: "cup"
            });
        }
        if (house.title || house.time) {
            raw.push({
                title: house.title || "LỄ",
                time: house.time || "",
                date: house.date || wedding.date,
                icon: "hearts"
            });
        }
    }

    return raw.map((ev, index) => {
        const displayTime = formatHouseEventTime(ev);
        return {
            title: String(ev?.title || "").trim() || `Sự kiện ${index + 1}`,
            time: displayTime,
            timeShort: shortTimeLabel(ev?.time) || shortTimeLabel(displayTime),
            icon: resolveHouseEventIcon(ev?.icon, index)
        };
    });
}

function createTimelineContent(event) {
    const content = createEl("div", "timeline-content");
    const eventsWrap = createEl("div", "timeline-events");
    const mapLink = createMapLink(event);
    const items = getHouseEvents(event);

    // Nhiều sự kiện → grid co giãn (concept 1–4)
    if (items.length > 2) {
        eventsWrap.classList.add("timeline-events--multi");
    }

    items.forEach(item => {
        eventsWrap.appendChild(createTimelineEvent(item.title, item.time));
    });
    content.appendChild(eventsWrap);
    if (event.address) {
        content.appendChild(createIconRow("timeline-row timeline-address", "bi-geo-alt-fill", event.address));
    }
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
    const items = getHouseEvents(event);

    items.forEach(item => {
        ritual.appendChild(createRitualStep(item.icon, item.title, item.time));
    });

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
    const items = getHouseEvents(event);
    const place = event.address || "";

    items.forEach((item, index) => {
        list.appendChild(createItineraryRow(
            item.icon,
            item.title,
            item.time,
            "",
            index % 2 === 0
        ));
    });

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
    const items = getHouseEvents(event);

    items.forEach(item => {
        list.appendChild(createLineStep(item.icon, item.title, item.time));
    });

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

/**
 * Joint concept 1 — trục dọc kiểu thiệp (icon | chấm | giờ + tên).
 * Render N sự kiện từ ceremony.joint.events[].
 */
function createJoint1Step(icon, title, time) {
    const step = createEl("div", "timeline-joint1-step");

    const iconWrap = createEl("div", "timeline-joint1-icon");
    iconWrap.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;

    const rail = createEl("div", "timeline-joint1-rail");
    rail.appendChild(createEl("span", "timeline-joint1-dot"));

    const body = createEl("div", "timeline-joint1-body");
    body.appendChild(createEl("div", "timeline-joint1-time", time));
    body.appendChild(createEl("div", "timeline-joint1-title", title));

    step.appendChild(iconWrap);
    step.appendChild(rail);
    step.appendChild(body);
    return step;
}

function resolveJointEventIcon(iconId, index) {
    return resolveHouseEventIcon(iconId, index);
}

/** Hiển thị giờ+ngày cho 1 event joint. */
function formatJointEventTime(ev) {
    return formatHouseEventTime(ev);
}

/**
 * N sự kiện joint (events[]) hoặc migrate title/time/meal cũ.
 * @returns {{ joint: object, events: { title: string, time: string, timeShort: string, icon: string }[] }}
 */
function getJointEvents() {
    const joint = wedding.ceremony?.joint || {};
    let raw = [];

    if (Array.isArray(joint.events) && joint.events.length) {
        raw = joint.events;
    } else {
        // Legacy: meal → ceremony
        if (joint.meal?.title || joint.meal?.time) {
            raw.push({
                title: joint.meal?.title || "TIỆC CƯỚI",
                time: joint.meal?.time || "",
                date: wedding.date,
                icon: "cup"
            });
        }
        if (joint.title || joint.time) {
            raw.push({
                title: joint.title || "LỄ THÀNH HÔN",
                time: joint.time || "",
                date: joint.date || wedding.date,
                icon: "hearts"
            });
        }
    }

    const events = raw.map((ev, index) => {
        const displayTime = formatJointEventTime(ev);
        return {
            title: String(ev?.title || "").trim() || `Sự kiện ${index + 1}`,
            time: displayTime,
            timeShort: shortTimeLabel(ev?.time) || shortTimeLabel(displayTime),
            icon: resolveJointEventIcon(ev?.icon, index)
        };
    });

    return { joint, events };
}

function createJoint1Card() {
    const { joint, events } = getJointEvents();
    const card = createEl("div", "timeline-card timeline-card--joint-1");
    const list = createEl("div", "timeline-joint1");

    events.forEach(event => {
        list.appendChild(createJoint1Step(event.icon, event.title, event.time));
    });

    card.appendChild(list);
    appendJointFooter(card, joint, "timeline-joint1");
    return card;
}

/**
 * Joint concept 2 — đường sóng ngang (reference: wave + dots).
 * Xen kẽ: chẵn = giờ trên / tên dưới; lẻ = tên trên / giờ dưới.
 */
function createJoint2Card() {
    const { joint, events } = getJointEvents();
    const card = createEl("div", "timeline-card timeline-card--joint-2");
    const wrap = createEl("div", "timeline-joint2");
    const track = createEl("div", "timeline-joint2-track");

    // Sóng SVG (viewBox co giãn theo width)
    const wave = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    wave.setAttribute("class", "timeline-joint2-wave");
    wave.setAttribute("viewBox", "0 0 320 48");
    wave.setAttribute("preserveAspectRatio", "none");
    wave.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // Sóng êm 2–3 nhịp — khớp 2–3 mốc sự kiện
    path.setAttribute(
        "d",
        "M 8 24 C 48 4, 72 44, 112 24 S 176 4, 208 24 S 264 44, 312 24"
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.4");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    wave.appendChild(path);
    track.appendChild(wave);

    const nodes = createEl("div", "timeline-joint2-nodes");
    const count = Math.max(events.length, 1);
    // Nhiều mốc → thu chữ / giãn đều
    if (count >= 5) {
        nodes.classList.add("timeline-joint2-nodes--dense");
    }
    events.forEach((event, index) => {
        // chẵn: giờ trên / tên dưới · lẻ: tên trên / giờ dưới
        const flip = index % 2 === 1;
        const node = createEl(
            "div",
            `timeline-joint2-node ${flip ? "timeline-joint2-node--flip" : ""}`
        );
        node.style.flex = "1 1 0";
        node.style.maxWidth = `${100 / count}%`;

        const timeEl = createEl("div", "timeline-joint2-time", event.timeShort || shortTimeLabel(event.time));
        const dot = createEl("div", "timeline-joint2-dot");
        const titleEl = createEl("div", "timeline-joint2-title", event.title || "");

        if (flip) {
            node.appendChild(titleEl);
            node.appendChild(dot);
            node.appendChild(timeEl);
        } else {
            node.appendChild(timeEl);
            node.appendChild(dot);
            node.appendChild(titleEl);
        }
        nodes.appendChild(node);
    });
    track.appendChild(nodes);
    wrap.appendChild(track);
    card.appendChild(wrap);
    appendJointFooter(card, joint, "timeline-joint2");
    return card;
}

/**
 * Joint concept 3 — trục giữa, sự kiện xen kẽ trái/phải + icon (như thiệp itinerary).
 * Chẵn: trái · Lẻ: phải. Bữa tiệc → lễ.
 */
function createJoint3Step(icon, title, time, side) {
    const isLeft = side === "left";
    const step = createEl(
        "div",
        `timeline-joint3-step timeline-joint3-step--${isLeft ? "left" : "right"}`
    );

    const text = createEl("div", "timeline-joint3-text");
    text.appendChild(createEl("div", "timeline-joint3-time", shortTimeLabel(time) || time));
    text.appendChild(createEl("div", "timeline-joint3-title", title));

    const iconWrap = createEl("div", "timeline-joint3-icon");
    iconWrap.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;

    const rail = createEl("div", "timeline-joint3-rail");
    rail.appendChild(createEl("span", "timeline-joint3-dot"));

    const left = createEl("div", "timeline-joint3-pane timeline-joint3-pane--left");
    const right = createEl("div", "timeline-joint3-pane timeline-joint3-pane--right");

    if (isLeft) {
        left.appendChild(text);
        left.appendChild(iconWrap);
    } else {
        right.appendChild(iconWrap);
        right.appendChild(text);
    }

    step.appendChild(left);
    step.appendChild(rail);
    step.appendChild(right);
    return step;
}

function createJoint3Card() {
    const { joint, events } = getJointEvents();
    const card = createEl("div", "timeline-card timeline-card--joint-3");
    const list = createEl("div", "timeline-joint3");

    events.forEach((event, index) => {
        const side = index % 2 === 0 ? "left" : "right";
        list.appendChild(createJoint3Step(
            event.icon,
            event.title,
            event.timeShort || event.time,
            side
        ));
    });

    card.appendChild(list);
    appendJointFooter(card, joint, "timeline-joint3");
    return card;
}

/** Fallback joint (chưa chọn / skin lạ). */
function createJointCardDefault() {
    const { joint, events } = getJointEvents();
    const card = createEl("div", "timeline-card timeline-card--joint");
    card.appendChild(createEl("div", "timeline-side-badge", "CHUNG"));

    const content = createEl("div", "timeline-content");
    const eventsWrap = createEl("div", "timeline-events");

    events.forEach(event => {
        eventsWrap.appendChild(createTimelineEvent(event.title, event.time));
    });
    content.appendChild(eventsWrap);
    card.appendChild(content);
    appendJointFooter(card, joint, "timeline-joint");
    return card;
}

function createJointCard(skin) {
    if (skin === "joint-3") return createJoint3Card();
    if (skin === "joint-2") return createJoint2Card();
    if (skin === "joint-1" || !skin) return createJoint1Card();
    return createJointCardDefault();
}

export function renderTimeline() {
    setText("timelineTitle", wedding.sections?.timeline);
    setOptionalText("timelineSubtitle", wedding.sectionSubtitles?.timeline);

    const container = document.getElementById("timelineCards");
    if (!container) return;

    const mode = getCeremonyMode();
    const skin = getTimelineSkin();
    container.textContent = "";
    container.classList.toggle("timeline-cards--joint", mode === "joint");
    container.classList.toggle("timeline-cards--joint-1", mode === "joint" && (skin === "joint-1" || !skin));
    container.classList.toggle("timeline-cards--joint-2", mode === "joint" && skin === "joint-2");
    container.classList.toggle("timeline-cards--joint-3", mode === "joint" && skin === "joint-3");
    container.classList.toggle("timeline-cards--ritual", mode === "separate" && skin === "concept-5");
    container.classList.toggle("timeline-cards--itin", mode === "separate" && skin === "concept-6");
    container.classList.toggle("timeline-cards--line", mode === "separate" && skin === "concept-7");

    if (mode === "joint") {
        container.appendChild(createJointCard(skin));
        return;
    }

    TIMELINE_ORDER.forEach(({ role, person, side }, index) => {
        const event = wedding.ceremony[role];
        if (!event) return;

        let card;
        if (skin === "concept-5") {
            card = createRitualCard(event, side);
        } else if (skin === "concept-6") {
            card = createItineraryCard(event, side);
        } else if (skin === "concept-7") {
            card = createLineCard(event, side);
        } else {
            card = createTimelineCard(event, wedding[person].nickname, side);
            // Concept 2: card thứ 2 đảo ảnh (is-side-flip)
            if (skin === "concept-2" && index > 0) {
                card.classList.add("is-side-flip");
            }
        }
        container.appendChild(card);
    });
}
