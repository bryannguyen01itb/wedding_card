import { wedding } from "../config.js";
import { setText, setSplitName } from "../utils/dom.js";

function setOptionalText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    const text = Array.isArray(value)
        ? value.filter(Boolean).join("\n")
        : String(value || "").trim();
    element.textContent = text;
    element.hidden = !text;
}

function setOptionalHtml(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    const html = String(value || "").trim();
    element.innerHTML = html;
    element.hidden = !html;
}

export function renderSectionTitles() {
    const { sections, sectionSubtitles = {} } = wedding;

    setText("saveDateTitle", sections.saveDate);
    setText("aboutTitle", sections.about);
    setText("timelineTitle", sections.timeline);
    setText("galleryTitle", sections.gallery);
    setText("wishTitle", sections.wish);
    setText("giftTitle", sections.gift.title);
    setOptionalText("giftDesc", sections.gift.description);
    setText("giftOpenLabel", sections.gift.openLabel);
    setText("countdownTitle", sections.countdown.title);

    setOptionalText("saveDateSubtitle", sectionSubtitles.saveDate);
    setOptionalText("aboutSubtitle", sectionSubtitles.about);
    setOptionalText("timelineSubtitle", sectionSubtitles.timeline);
    setOptionalText("gallerySubtitle", sectionSubtitles.gallery);
    setOptionalText("wishSubtitle", sectionSubtitles.wish);
    setOptionalText("giftSubtitle", sectionSubtitles.gift);
    setOptionalText("countdownSubtitle", sectionSubtitles.countdown);

    const labels = sections.countdown.labels;
    setText("countdownDaysLabel", labels.days);
    setText("countdownHoursLabel", labels.hours);
    setText("countdownMinutesLabel", labels.minutes);
    setText("countdownSecondsLabel", labels.seconds);
}

export function renderThanks() {
    const { sections, groom, bride } = wedding;

    setText("thanksTitle", sections.thanks.title);
    setOptionalText("thanksSubtitle", wedding.sectionSubtitles?.thanks);
    setOptionalHtml("thanksContent", (sections.thanks.paragraphs || []).join("<br><br>"));
    setSplitName("thanksGroom", groom.nickname);
    setSplitName("thanksBride", bride.nickname);
}
