import { wedding } from "../../config.js";
import { setText, setOptionalText } from "../../utils/dom.js";


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
