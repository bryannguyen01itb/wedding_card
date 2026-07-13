import { startHeroAnimation } from "./hero.js";
import { showMusic, playMusic } from "./music.js";
import { showGiftButton } from "./gift.js";
import { startInvitationAutoScroll } from "./autoScroll.js";

const INVITATION_PREPARE_DELAY = 260;
const COVER_FADE_DELAY = 520;
const COVER_REMOVE_DELAY = 980;

function dismissCover(cover) {
    cover.classList.add("is-dismissed");
    cover.setAttribute("aria-hidden", "true");
    cover.hidden = true;
    cover.style.setProperty("display", "none", "important");
}

/** Xử lý mở bìa thiệp và chuyển sang nội dung chính */
export function initCover() {
    let isOpening = false;
    const card = document.getElementById("openCard");
    const cover = document.querySelector(".cover");
    const invitation = document.querySelector(".invitation");
    const header = document.querySelector(".invitation__header");
    const coverClick = document.querySelector(".cover__click");

    function updateHeader() {
        header?.classList.toggle("scrolled", window.scrollY > 20);
    }

    window.addEventListener("scroll", updateHeader);

    if (!card || !cover || !invitation) return;

    card.addEventListener("click", () => {
        if (isOpening) return;
        isOpening = true;

        cover.classList.add("opening");
        card.classList.add("open");

        if (coverClick) coverClick.style.display = "none";

        setTimeout(() => {
            invitation.style.display = "block";

            requestAnimationFrame(() => {
                invitation.classList.add("show");
                updateHeader();
                startHeroAnimation();
                startInvitationAutoScroll();
            });
        }, INVITATION_PREPARE_DELAY);

        setTimeout(() => cover.classList.add("hide"), COVER_FADE_DELAY);

        setTimeout(() => {
            cover.classList.remove("opening", "hide");
            dismissCover(cover);
        }, COVER_REMOVE_DELAY);

        showMusic();
        showGiftButton();
        playMusic();
    });
}
