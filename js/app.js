import { loadWeddingConfig } from "./services/weddingData.js";
import { renderContent } from "./render/index.js";
import { initCover } from "./features/cover.js";
import { initMusic, playMusic } from "./features/music.js";
import { initScrollReveal } from "./features/scrollReveal.js";
import { initCalendar } from "./features/calendar.js";
import { initCountdown } from "./features/countdown.js";
import { initGift } from "./features/gift.js";
import { initWish } from "./features/wish.js";
import { initHeaderMenu } from "./features/headerMenu.js";
import { updateLinkPreview } from "./utils/meta.js";

function showWeddingError(error) {
    const isNotFound = error?.code === "not-found";
    const title = isNotFound ? "Không tìm thấy thiệp cưới" : "Chưa tải được thiệp cưới";
    const message = isNotFound
        ? "Đường dẫn thiệp này không còn tồn tại hoặc weddingId đã được đổi."
        : "Vui lòng thử tải lại trang sau ít phút.";

    document.title = title;
    document.body.classList.remove("concept-loading");
    document.body.innerHTML = `
        <main class="wedding-error" role="main">
            <div class="wedding-error__card">
                <i class="bi bi-heartbreak-fill" aria-hidden="true"></i>
                <h1>${title}</h1>
                <p>${message}</p>
            </div>
        </main>
    `;
}

function restoreBuilderPreviewState() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") !== "builder") return;

    let state = null;
    try {
        state = JSON.parse(localStorage.getItem("weddingBuilderPreviewState") || "null");
    } catch (error) {
        state = null;
    }

    if (!state?.opened) return;

    const cover = document.querySelector(".cover");
    const invitation = document.querySelector(".invitation");
    const header = document.querySelector(".invitation__header");
    const musicButton = document.getElementById("musicBtn");
    const giftButton = document.getElementById("floatingGiftBtn");

    if (cover) {
        cover.classList.add("is-dismissed");
        cover.setAttribute("aria-hidden", "true");
        cover.hidden = true;
        cover.style.setProperty("display", "none", "important");
    }

    if (invitation) {
        invitation.style.display = "block";
        invitation.classList.add("show");
    }

    header?.classList.toggle("scrolled", Number(state.scrollY || 0) > 20 || Boolean(state.target));
    musicButton?.classList.add("show");
    giftButton?.classList.add("show");

    if (state.target) {
        window.setTimeout(playMusic, 120);
    }

    requestAnimationFrame(() => {
        const targetElement = state.target ? document.querySelector(state.target) : null;
        if (targetElement) {
            targetElement.scrollIntoView({ block: "start" });
            return;
        }

        window.scrollTo(0, Number(state.scrollY || 0));
    });
}

async function bootstrap() {
    try {
        await loadWeddingConfig();

        // 1. Render nội dung từ config đã tải
        updateLinkPreview();
        renderContent();

        // 2. Khởi tạo tính năng tương tác
        initCover();
        initHeaderMenu();
        initMusic();
        initCalendar();
        initCountdown();
        initScrollReveal();
        initGift();
        initWish();
        restoreBuilderPreviewState();
    } catch (error) {
        showWeddingError(error);
    }
}

bootstrap();
