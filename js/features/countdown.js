import { wedding } from "../config.js";
import { parseWeddingDate } from "../utils/date.js";

const ELEMENT_IDS = {
    days: "days",
    hours: "hours",
    minutes: "minutes",
    seconds: "seconds"
};

let timerId = 0;

function getElements() {
    return {
        days: document.getElementById(ELEMENT_IDS.days),
        hours: document.getElementById(ELEMENT_IDS.hours),
        minutes: document.getElementById(ELEMENT_IDS.minutes),
        seconds: document.getElementById(ELEMENT_IDS.seconds)
    };
}

function setValue(elements, key, value) {
    const el = elements[key];
    if (!el) return;
    const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    el.textContent = String(safe).padStart(2, "0");
}

function resolveTargetTime() {
    const raw = wedding?.date;
    if (raw == null || raw === "") return NaN;
    const date = parseWeddingDate(raw);
    const time = date?.getTime?.();
    return Number.isFinite(time) ? time : NaN;
}

function update() {
    const elements = getElements();
    const target = resolveTargetTime();
    if (!Number.isFinite(target)) {
        setValue(elements, "days", 0);
        setValue(elements, "hours", 0);
        setValue(elements, "minutes", 0);
        setValue(elements, "seconds", 0);
        return;
    }

    const distance = Math.max(target - Date.now(), 0);
    const dayMs = 86400000;
    const hourMs = 3600000;
    const minuteMs = 60000;

    setValue(elements, "days", distance / dayMs);
    setValue(elements, "hours", (distance % dayMs) / hourMs);
    setValue(elements, "minutes", (distance % hourMs) / minuteMs);
    setValue(elements, "seconds", (distance % minuteMs) / 1000);
}

export function initCountdown() {
    if (timerId) {
        window.clearInterval(timerId);
        timerId = 0;
    }
    update();
    timerId = window.setInterval(update, 1000);
}
