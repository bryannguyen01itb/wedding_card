import { wedding } from "../../config.js";
import { setText, setSplitName } from "../../utils/dom.js";
import { formatDate } from "../../utils/date.js";

export function renderCover() {
    const { groom, bride } = wedding;

    setText("coverHeadline", wedding.cover.headline);
    setSplitName("coverGroom", groom.nickname);
    setSplitName("coverBride", bride.nickname);
    setText("coverDate", formatDate(wedding.date));
}
