import { wedding } from "../config.js";
import { applyTheme } from "../utils/theme.js";
import { renderHeader, renderCover, renderPoster } from "./cover.js";
import { renderSectionTitles, renderThanks } from "./sections.js";
import { renderPerson } from "./about.js";
import { renderTimeline } from "./timeline.js";
import { renderGallery } from "./gallery.js";
import { renderGift } from "./gift.js";
import { renderWishForm } from "./wish.js";

/** Đổ toàn bộ nội dung từ config.js vào trang */
export function renderContent() {
    applyTheme(wedding.theme?.primaryColor);

    renderHeader();
    renderCover();
    renderPoster();
    renderSectionTitles();
    renderThanks();
    renderPerson("groom", wedding.groom);
    renderPerson("bride", wedding.bride);
    renderTimeline();
    renderGallery(wedding.gallery);
    renderGift();
    renderWishForm();
}
