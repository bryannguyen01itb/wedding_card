import { loadWeddingConfig, getWeddingIdFromUrl, getAccessTokenFromUrl } from "./services/weddingData.js";
import { renderContent } from "./render/index.js";
import { initCover, resetCoverOpenState } from "./features/cover.js?v=cover-reset-1";
import { initMusic, playMusic } from "./features/music.js";
import { initScrollReveal } from "./features/scrollReveal.js";
import { initCalendar } from "./features/calendar.js";
import { initCountdown } from "./features/countdown.js";
import { initGift } from "./features/gift.js";
import { initWish } from "./features/wish.js";
import { initHeaderMenu, resetHeaderMenu } from "./features/headerMenu.js?v=menu-m3";
import { updateLinkPreview } from "./utils/meta.js";
import { wedding } from "./config.js";

/** postMessage type từ builder — soft update preview (không reload iframe). */
export const BUILDER_PREVIEW_SOFT_MSG = "wedding-builder-preview-soft";

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

/** Soft refresh: hiện lại màn cover (vd nút “Xem preview” / “Xem từ đầu”). */
function showCoverForBuilderPreview() {
    // Quan trọng: reset isOpening — không reset thì bấm cover lần 2 bị chặn
    resetCoverOpenState();

    const header = document.querySelector(".invitation__header");
    const musicButton = document.getElementById("musicBtn");
    const giftButton = document.getElementById("floatingGiftBtn");
    const audio = document.getElementById("bgMusic");

    header?.classList.remove("scrolled", "menu-open");
    musicButton?.classList.remove("show", "playing");
    giftButton?.classList.remove("show");
    if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
    }
    window.scrollTo(0, 0);
}

function restoreBuilderPreviewState(options = {}) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") !== "builder") return;

    let state = null;
    try {
        if (options.previewState) {
            state = options.previewState;
        } else {
            // dynamic import tránh circular; sync fallback localStorage legacy
            const ptab = new URLSearchParams(window.location.search).get("ptab") || "";
            if (ptab) {
                state = JSON.parse(localStorage.getItem(`weddingBuilderPreviewState:${ptab}`) || "null");
            }
            if (!state) {
                state = JSON.parse(
                    sessionStorage.getItem("weddingBuilderPreviewState")
                    || localStorage.getItem("weddingBuilderPreviewState")
                    || "null"
                );
            }
        }
    } catch (error) {
        state = null;
    }

    // Soft update: chỉ tin postMessage/localStorage (URL ?section= không đổi khi soft
    // → nếu fallback URL sẽ kẹt section cũ, không “về cover” được).
    const messageTarget = String(options.previewState?.target || "").trim();
    const sectionParam = String(params.get("section") || "").trim().replace(/^\./, "");
    const urlTarget = sectionParam ? `.${sectionParam}` : "";
    const stateTarget = String(state?.target || "").trim();
    const target = options.soft
        ? (messageTarget || stateTarget)
        : (messageTarget || stateTarget || urlTarget);
    const hasTarget = Boolean(target);
    const urlOpen = params.get("open") === "1" || Boolean(urlTarget);
    const stateOpen = Boolean(state?.opened || hasTarget || options.previewState?.opened);
    // Soft: localStorage/message; hard load lần đầu: URL cũng đủ
    const shouldOpen = options.soft
        ? stateOpen
        : (urlOpen || stateOpen);

    const cover = document.querySelector(".cover");
    const invitation = document.querySelector(".invitation");
    const header = document.querySelector(".invitation__header");
    const musicButton = document.getElementById("musicBtn");
    const giftButton = document.getElementById("floatingGiftBtn");

    if (!shouldOpen) {
        // Soft “về cover” sau khi đã mở thiệp
        if (options.soft) showCoverForBuilderPreview();
        return;
    }

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

    header?.classList.toggle("scrolled", Number(state?.scrollY || 0) > 20 || hasTarget);
    musicButton?.classList.add("show");
    giftButton?.classList.add("show");

    // Soft: không auto-play lại nhạc mỗi lần gõ chữ (chỉ hard load / nhảy section lần đầu)
    if (hasTarget && !options.soft) {
        window.setTimeout(playMusic, 120);
    }

    const scrollToPreviewTarget = () => {
        if (target) {
            const targetElement = document.querySelector(target);
            if (targetElement) {
                targetElement.scrollIntoView({ block: "start" });
                return true;
            }
            return false;
        }
        window.scrollTo(0, Number(state?.scrollY || 0));
        return true;
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

/** Cập nhật src nhạc nếu đổi — không hard-reload cả iframe. */
function softSyncMusicSource() {
    const audio = document.getElementById("bgMusic");
    if (!audio) return;
    const next = String(wedding.music || "").trim();
    if (!next) return;
    const current = String(audio.getAttribute("src") || audio.src || "").trim();
    if (!current) {
        audio.src = next;
        audio.load();
        return;
    }
    try {
        const a = new URL(audio.currentSrc || audio.src, location.href).href;
        const b = new URL(next, location.href).href;
        if (a === b) return;
    } catch {
        if (current === next) return;
    }
    const wasPlaying = !audio.paused;
    audio.src = next;
    audio.load();
    if (wasPlaying) {
        audio.play().catch(() => {});
    }
}

let softPreviewTimer = 0;
let softPreviewInFlight = false;

/**
 * Soft refresh preview builder: đọc localStorage → re-render DOM.
 * Ảnh/src trùng không gán lại → browser/Cloudinary không tải lại.
 */
async function softRefreshBuilderPreview(messageData = {}) {
    if (!isBuilderPreview()) return;
    if (softPreviewInFlight) {
        // Gộp request đang chạy: schedule thêm 1 lần sau
        window.clearTimeout(softPreviewTimer);
        softPreviewTimer = window.setTimeout(() => {
            softRefreshBuilderPreview(messageData);
        }, 80);
        return;
    }

    softPreviewInFlight = true;
    try {
        await loadWeddingConfig();
        updateLinkPreview();
        document.body.classList.remove("concept-loading");
        // Gỡ panel menu gắn body (nếu đang mở) trước khi renderHeader rebuild
        resetHeaderMenu();
        renderContent();
        // Calendar/date UI không auto theo wedding live binding — render lại
        initCalendar();
        // renderHeader() rebuild DOM — menu dùng delegation (init 1 lần) vẫn ăn
        softSyncMusicSource();
        restoreBuilderPreviewState({
            soft: true,
            previewState: messageData.previewState || null
        });
        // Cover phải bấm được sau soft “về bìa”
        const ps = messageData.previewState;
        const backToCover = ps && !ps.opened && !ps.target;
        if (backToCover) {
            resetCoverOpenState();
        }
    } catch (error) {
        console.warn("[preview] soft refresh failed:", error);
        document.body.classList.remove("concept-loading");
    } finally {
        softPreviewInFlight = false;
    }
}

function scheduleSoftRefreshBuilderPreview(messageData = {}) {
    window.clearTimeout(softPreviewTimer);
    softPreviewTimer = window.setTimeout(() => {
        softRefreshBuilderPreview(messageData);
    }, 40);
}

function bindBuilderPreviewSoftListeners() {
    if (!isBuilderPreview()) return;

    // Chỉ postMessage từ parent cùng tab (không storage event — tránh 2 tab builder đụng preview)
    window.addEventListener("message", event => {
        if (event.origin && event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data.type !== BUILDER_PREVIEW_SOFT_MSG) return;
        scheduleSoftRefreshBuilderPreview(data);
    });
}

async function bootstrap() {
    try {
        const builderPreview = isBuilderPreview();
        // Không có weddingId / access token (?t=32hex) và không phải preview → landing
        const hasInviteQuery = Boolean(getWeddingIdFromUrl() || getAccessTokenFromUrl());
        if (!hasInviteQuery && !builderPreview) {
            showLandingPage();
            return;
        }

        // preview=builder: loadWeddingConfig dùng storage bridge / thiệp mẫu
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
        // Mở đúng section preview TRƯỚC mọi thứ phụ
        restoreBuilderPreviewState();

        // Preview builder: KHÔNG initWish (tránh onSnapshot Firestore → spam unavailable)
        if (!builderPreview) {
            initWish();
        }

        if (builderPreview) {
            bindBuilderPreviewSoftListeners();
            requestAnimationFrame(() => restoreBuilderPreviewState());
            window.setTimeout(() => restoreBuilderPreviewState(), 300);
        }
    } catch (error) {
        console.error("[app] bootstrap failed:", error);
        showWeddingError(error);
    } finally {
        // Tránh iframe trắng vĩnh viễn nếu lỗi trước khi renderContent gỡ class
        document.body.classList.remove("concept-loading");
    }
}

bootstrap();
