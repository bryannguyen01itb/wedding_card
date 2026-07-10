const card = document.getElementById("openCard");
const cover = document.querySelector(".cover");
const invitation = document.querySelector(".invitation");
const invitationHeader = document.querySelector(".invitation__header");
const coverClick = document.querySelector(".cover__click");

const coverFadeDelay = 850;
const invitationShowDelay = 1450;

function updateInvitationHeader(){

    if(!invitationHeader){

        return;

    }

    invitationHeader.classList.toggle("scrolled", window.scrollY > 20);

}

window.addEventListener("scroll", updateInvitationHeader);

if(card && cover && invitation){

    card.addEventListener("click", () => {

        cover.classList.add("opening");

        card.classList.add("open");

        if(coverClick){

            coverClick.style.display = "none";

        }

        setTimeout(() => {

            cover.classList.add("hide");

        }, coverFadeDelay);

        setTimeout(() => {

            cover.style.display = "none";

            invitation.style.display = "block";

            requestAnimationFrame(() => {

                invitation.classList.add("show");

                updateInvitationHeader();

                startHeroAnimation();

            });

        }, invitationShowDelay);

        showMusic();

        playMusic();

    });

}
