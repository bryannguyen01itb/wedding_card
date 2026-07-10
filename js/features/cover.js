import { startHeroAnimation } from "./hero.js";
import { showMusic, playMusic } from "./music.js";

const COVER_FADE_DELAY = 850;
const INVITATION_SHOW_DELAY = 1450;

/** Xử lý mở bìa thiệp và chuyển sang nội dung chính */
export function initCover() {
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
        cover.classList.add("opening");
        card.classList.add("open");

        if (coverClick) coverClick.style.display = "none";

        setTimeout(() => cover.classList.add("hide"), COVER_FADE_DELAY);

        setTimeout(() => {
            cover.style.display = "none";
            invitation.style.display = "block";

            requestAnimationFrame(() => {
                invitation.classList.add("show");
                updateHeader();
                startHeroAnimation();
            });
        }, INVITATION_SHOW_DELAY);

        showMusic();
        playMusic();
    });
}
