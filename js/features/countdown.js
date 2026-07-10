import { wedding } from "../config.js";

const target = new Date(wedding.date).getTime();
const elements = {
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds")
};

function setValue(key, value) {
    if (elements[key]) {
        elements[key].textContent = String(value).padStart(2, "0");
    }
}

function update() {
    const distance = Math.max(target - Date.now(), 0);
    const dayMs = 86400000;
    const hourMs = 3600000;
    const minuteMs = 60000;

    setValue("days", Math.floor(distance / dayMs));
    setValue("hours", Math.floor((distance % dayMs) / hourMs));
    setValue("minutes", Math.floor((distance % hourMs) / minuteMs));
    setValue("seconds", Math.floor((distance % minuteMs) / 1000));
}

export function initCountdown() {
    update();
    setInterval(update, 1000);
}
