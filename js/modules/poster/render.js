import { wedding } from "../../config.js";
import { setText, setSrc } from "../../utils/dom.js";
import { formatDate } from "../../utils/date.js";
import { getInviteSideFromUrl, resolvePosterLocation } from "../../utils/location.js";

export function renderPoster() {
    const { groom, bride } = wedding;
    const side = getInviteSideFromUrl();

    setSrc("posterImage", wedding.poster.image, "poster");
    setText("posterGroom", groom.nickname);
    setText("posterBride", bride.nickname);
    setText("posterDate", formatDate(wedding.date));
    // Location theo nhà trai/gái (?side=groom|bride), không dùng 1 location cố định
    setText("posterLocation", resolvePosterLocation(wedding, side));
}
