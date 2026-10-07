import { setWeddingConfig } from "../js/config.js";
import { renderContent } from "../js/render/index.js";
import { initCalendar } from "../js/features/calendar.js";
import { initCountdown } from "../js/features/countdown.js";

/** Render the saved invitation without starting Firebase or public-page listeners. */
export function renderKeepsake({ config, wishes }) {
    setWeddingConfig(config);
    renderContent();
    initCalendar();
    initCountdown();
    document.body.classList.remove("concept-loading");
    document.title = `Thiệp kỷ niệm — ${config.groom?.nickname || "Chú rể"} & ${config.bride?.nickname || "Cô dâu"}`;
    const audio = document.getElementById("bgMusic");
    audio.preload = "none";
    audio.setAttribute("src", config.music || "");

    document.querySelector(".wish-form")?.remove();
    document.getElementById("loadMoreBtn")?.remove();
    const list = document.getElementById("wishList");
    if (list) {
        list.textContent = "";
        for (const wish of wishes) {
            const card = document.createElement("article");
            card.className = "wish-card";
            for (const [className, text] of [
                ["user-name", wish.name || "Khách mời"],
                ["user-side", wish.side || ""],
                ["attendance-badge", wish.attendance || ""],
                ["wish-message", wish.message || ""],
                ["wish-time", wish.createdAt || ""]
            ]) {
                const item = document.createElement("div");
                item.className = className;
                item.textContent = text;
                card.appendChild(item);
            }
            list.appendChild(card);
        }
        if (!wishes.length) list.textContent = "Chưa có lời chúc tại thời điểm lưu thiệp.";
    }
}
