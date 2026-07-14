import { wedding } from "../../config.js";
import { setText, setSplitName, setOptionalText } from "../../utils/dom.js";


function setOptionalHtml(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    const html = String(value || "").trim();
    element.innerHTML = html;
    element.hidden = !html;
}

export function renderThanks() {
    const { sections, groom, bride } = wedding;

    setText("thanksTitle", sections.thanks.title);
    setOptionalText("thanksSubtitle", wedding.sectionSubtitles?.thanks);
    setOptionalHtml("thanksContent", (sections.thanks.paragraphs || []).join("<br><br>"));
    setSplitName("thanksGroom", groom.nickname);
    setSplitName("thanksBride", bride.nickname);
}
