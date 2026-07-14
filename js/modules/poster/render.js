import { wedding } from "../../config.js";
import { setText, setSrc } from "../../utils/dom.js";
import { formatDate } from "../../utils/date.js";

export function renderPoster() {
    const { groom, bride } = wedding;

    setSrc("posterImage", wedding.poster.image, "poster");
    setText("posterGroom", groom.nickname);
    setText("posterBride", bride.nickname);
    setText("posterDate", formatDate(wedding.date));
    setText("posterLocation", wedding.location);
}
