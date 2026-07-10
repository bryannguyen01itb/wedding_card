import { wedding } from "../config.js";
import { setText, setHtml, setSplitName } from "../utils/dom.js";

export function renderSectionTitles() {
    const { sections } = wedding;

    setText("saveDateTitle", sections.saveDate);
    setText("aboutTitle", sections.about);
    setText("timelineTitle", sections.timeline);
    setText("galleryTitle", sections.gallery);
    setText("wishTitle", sections.wish);
    setText("giftTitle", sections.gift.title);
    setText("giftDesc", sections.gift.description);
    setText("giftOpenLabel", sections.gift.openLabel);
    setText("countdownTitle", sections.countdown.title);

    const labels = sections.countdown.labels;
    setText("countdownDaysLabel", labels.days);
    setText("countdownHoursLabel", labels.hours);
    setText("countdownMinutesLabel", labels.minutes);
    setText("countdownSecondsLabel", labels.seconds);
}

export function renderThanks() {
    const { sections, groom, bride } = wedding;

    setText("thanksTitle", sections.thanks.title);
    setHtml("thanksContent", sections.thanks.paragraphs.join("<br><br>"));
    setSplitName("thanksGroom", groom.nickname);
    setSplitName("thanksBride", bride.nickname);
}
