import { wedding } from "../../config.js";
import { setText } from "../../utils/dom.js";

function setOptionalText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    const text = String(value || "").trim();
    element.textContent = text;
    element.hidden = !text;
}

/** Titles only — calendar days are filled by features/calendar.js */
export function renderSaveDate() {
    setText("saveDateTitle", wedding.sections?.saveDate);
    setOptionalText("saveDateSubtitle", wedding.sectionSubtitles?.saveDate);
}
