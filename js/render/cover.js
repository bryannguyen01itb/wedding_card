import { wedding } from "../config.js";
import { setText, setSrc } from "../utils/dom.js";
import { formatDate } from "../utils/date.js";

export function renderHeader() {
    setText("invitationHeader", wedding.header.logo);
}

export function renderCover() {
    const { groom, bride } = wedding;

    setText("coverHeadline", wedding.cover.headline);
    setText("coverGroom", groom.nickname);
    setText("coverBride", bride.nickname);
    setText("coverDate", formatDate(wedding.date));
}

export function renderPoster() {
    const { groom, bride } = wedding;

    setSrc("posterImage", wedding.poster.image);
    setText("posterGroom", groom.nickname);
    setText("posterBride", bride.nickname);
    setText("posterDate", formatDate(wedding.date));
    setText("posterLocation", wedding.location);
}
