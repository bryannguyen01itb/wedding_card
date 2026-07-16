import { startHeroAnimation } from "./hero.js";
import { showMusic, playMusic } from "./music.js";
import { showGiftButton } from "./gift.js";
import { startInvitationAutoScroll } from "./autoScroll.js";

const INVITATION_PREPARE_DELAY = 260;
const COVER_FADE_DELAY = 520;
const COVER_REMOVE_DELAY = 980;

/** Module-level: soft preview “về cover” phải reset — không kẹt isOpening forever */
let isOpening = false;
let coverBound = false;

function dismissCover(cover) {
    if (!cover) return;
    cover.classList.add("is-dismissed");
    cover.setAttribute("aria-hidden", "true");
    cover.hidden = true;
    cover.style.setProperty("display", "none", "important");
}

/**
 * Builder soft-refresh / “Xem preview” về bìa:
 * cho phép bấm mở thiệp lại (reset cờ isOpening + UI cover).
 */
export function resetCoverOpenState() {
    isOpening = false;

    const cover = document.querySelector(".cover");
    const card = document.getElementById("openCard");
    const coverClick = document.querySelector(".cover__click");
    const invitation = document.querySelector(".invitation");

    if (cover) {
        cover.classList.remove("is-dismissed", "opening", "hide");
        cover.removeAttribute("aria-hidden");
        cover.hidden = false;
        cover.style.removeProperty("display");
    }
    card?.classList.remove("open");
    if (coverClick) coverClick.style.display = "";

    if (invitation) {
        invitation.style.display = "none";
        invitation.classList.remove("show");
    }
}

function openInvitationFromCover() {
    const cover = document.querySelector(".cover");
    const card = document.getElementById("openCard");
    const invitation = document.querySelector(".invitation");
    const header = document.querySelector(".invitation__header");
    const coverClick = document.querySelector(".cover__click");

    if (!cover || !card || !invitation) return;
    if (isOpening) return;
    isOpening = true;

    cover.classList.add("opening");
    card.classList.add("open");

    if (coverClick) coverClick.style.display = "none";

    window.setTimeout(() => {
        invitation.style.display = "block";

        requestAnimationFrame(() => {
            invitation.classList.add("show");
            header?.classList.toggle("scrolled", window.scrollY > 20);
            startHeroAnimation();
            startInvitationAutoScroll();
        });
    }, INVITATION_PREPARE_DELAY);

    window.setTimeout(() => cover.classList.add("hide"), COVER_FADE_DELAY);

    window.setTimeout(() => {
        cover.classList.remove("opening", "hide");
        dismissCover(cover);
        // Cho phép mở lại nếu soft preview reset cover sau này
        // (isOpening giữ true đến khi resetCoverOpenState)
    }, COVER_REMOVE_DELAY);

    showMusic();
    showGiftButton();
    playMusic();
}

/** Xử lý mở bìa thiệp — delegation, sống sót soft re-render */
export function initCover() {
    if (coverBound) return;
    coverBound = true;

    const header = document.querySelector(".invitation__header");
    function updateHeader() {
        header?.classList.toggle("scrolled", window.scrollY > 20);
    }
    window.addEventListener("scroll", updateHeader, { passive: true });

    document.addEventListener("click", event => {
        const card = event.target.closest?.("#openCard");
        if (!card) return;
        // Chỉ khi cover đang hiện (chưa dismiss)
        const cover = document.querySelector(".cover");
        if (!cover || cover.classList.contains("is-dismissed") || cover.hidden) return;
        event.preventDefault();
        openInvitationFromCover();
    });
}
