import { loadWeddingConfig, getWeddingIdFromUrl, getAccessTokenFromUrl } from "./services/weddingData.js";
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

function isBuilderPreview() {
    return new URLSearchParams(window.location.search).get("preview") === "builder";
}

/** Trang chủ (không có ?wedding=) → landing quảng cáo, không mở thiệp demo. */
function showLandingPage() {
    document.title = "Thiệp cưới online — Tạo thiệp trong vài phút";
    document.documentElement.classList.add("landing-html");
    document.body.classList.remove("concept-loading");
    document.body.className = "landing-page";
    document.body.innerHTML = `
        <main class="landing" role="main">
            <div class="landing__glow" aria-hidden="true"></div>
            <section class="landing__hero">
                <p class="landing__eyebrow">Wedding Card Online</p>
                <h1>Thiệp cưới online đẹp — tạo nhanh, gửi link ngay</h1>
                <p class="landing__lead">
                    Tự chọn giao diện từng phần, nhập thông tin, upload ảnh/QR và nhận link thiệp.
                    Dùng được trên máy tính và điện thoại. Xem preview trước khi lưu.
                </p>
                <div class="landing__actions">
                    <a class="landing__cta" href="builder/">Tạo thiệp ngay</a>
                </div>
                <ul class="landing__features">
                    <li><i class="bi bi-chat-heart-fill" aria-hidden="true"></i> Gửi lời chúc, xác nhận tham dự</li>
                    <li><i class="bi bi-palette" aria-hidden="true"></i> Ghép concept theo block</li>
                    <li><i class="bi bi-qr-code" aria-hidden="true"></i> QR mừng cưới &amp; Maps</li>
                    <li><i class="bi bi-music-note-beamed" aria-hidden="true"></i> Nhạc nền thiệp</li>
                </ul>
            </section>
            <section class="landing__card">
                <div class="landing__phone" aria-hidden="true">
                    <img src="img/preview.jpeg" alt="">
                </div>
                <p class="landing__note">Đã có link thiệp? Mở đúng đường dẫn admin gửi (có <code>?wedding=...</code>).</p>
            </section>
        </main>
    `;
}

function showWeddingError(error) {
    const code = error?.code;
    const isNotFound = code === "not-found";
    const isLocked = code === "payment-locked";
    const title = isLocked
        ? "Thiệp chưa được mở khóa"
        : isNotFound
            ? "Không tìm thấy thiệp cưới"
            : "Chưa tải được thiệp cưới";
    const message = isLocked
        ? (error.message || "Vui lòng hoàn tất thanh toán. Link thiệp chính thức chỉ hoạt động sau khi admin xác nhận.")
        : isNotFound
            ? "Đường dẫn thiệp này không còn tồn tại, sai mã truy cập, hoặc weddingId đã được đổi."
            : "Vui lòng thử tải lại trang sau ít phút.";

    document.title = title;
    document.body.classList.remove("concept-loading");
    document.body.innerHTML = `
        <main class="wedding-error" role="main">
            <div class="wedding-error__card">
                <i class="bi bi-${isLocked ? "lock-fill" : "heartbreak-fill"}" aria-hidden="true"></i>
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

    // Có target section (about, gallery…) thì luôn mở thiệp, kể cả flag opened bị thiếu
    const hasTarget = Boolean(state?.target);
    const shouldOpen = Boolean(state?.opened || hasTarget);
    if (!shouldOpen) return;

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

    header?.classList.toggle("scrolled", Number(state.scrollY || 0) > 20 || hasTarget);
    musicButton?.classList.add("show");
    giftButton?.classList.add("show");

    if (hasTarget) {
        window.setTimeout(playMusic, 120);
    }

    const scrollToPreviewTarget = () => {
        const targetElement = hasTarget ? document.querySelector(state.target) : null;
        if (targetElement) {
            targetElement.scrollIntoView({ block: "start" });
            return true;
        }
        if (!hasTarget) {
            window.scrollTo(0, Number(state.scrollY || 0));
            return true;
        }
        return false;
    };

    // Thử vài lần vì layout concept/skin có thể render xong sau 1 frame
    requestAnimationFrame(() => {
        if (scrollToPreviewTarget()) return;
        window.setTimeout(() => {
            if (scrollToPreviewTarget()) return;
            window.setTimeout(scrollToPreviewTarget, 200);
        }, 80);
    });
}

async function bootstrap() {
    try {
        // Không có weddingId / access token (?t=) và không phải preview builder → trang quảng cáo
        const hasInviteQuery = Boolean(getWeddingIdFromUrl() || getAccessTokenFromUrl());
        if (!hasInviteQuery && !isBuilderPreview()) {
            showLandingPage();
            return;
        }

        await loadWeddingConfig();

        updateLinkPreview();
        renderContent();

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
