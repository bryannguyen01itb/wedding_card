import { wedding } from "../../config.js";
import { setText } from "../../utils/dom.js";

function setOptionalText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    const text = String(value || "").trim();
    element.textContent = text;
    element.hidden = !text;
}

/** Titles/labels only — tick logic lives in features/countdown.js */
export function renderCountdown() {
    const countdown = wedding.sections?.countdown || {};
    const labels = countdown.labels || {};

    setText("countdownTitle", countdown.title);
    setOptionalText("countdownSubtitle", wedding.sectionSubtitles?.countdown);
    setText("countdownDaysLabel", labels.days);
    setText("countdownHoursLabel", labels.hours);
    setText("countdownMinutesLabel", labels.minutes);
    setText("countdownSecondsLabel", labels.seconds);
}
