const giftModal = document.getElementById("giftModal");

const openGiftBox = document.getElementById("openGiftBox");

const closeGiftBox = document.getElementById("closeGiftBox");

const closeGiftBackdrop = document.getElementById("closeGiftBackdrop");

function setGiftModalState(isOpen){

    if(!giftModal){

        return;

    }

    giftModal.classList.toggle("show", isOpen);

    giftModal.setAttribute("aria-hidden", String(!isOpen));

    document.body.classList.toggle("modal-open", isOpen);

}

function bindClick(element, handler){

    if(element){

        element.addEventListener("click", handler);

    }

}

bindClick(openGiftBox, () => setGiftModalState(true));

bindClick(closeGiftBox, () => setGiftModalState(false));

bindClick(closeGiftBackdrop, () => setGiftModalState(false));

document.addEventListener("keydown", event => {

    if(event.key === "Escape" && giftModal?.classList.contains("show")){

        setGiftModalState(false);

    }

});

document.querySelectorAll(".copy-number").forEach(box => {

    box.addEventListener("click", () => {

        const span = box.querySelector("span");

        const icon = box.querySelector("i");

        if(!span || !icon){

            return;

        }

        const oldText = span.textContent;

        const oldClass = icon.className;

        navigator.clipboard.writeText(oldText);

        span.textContent = "✓ Đã sao chép";

        icon.className = "bi bi-check";

        setTimeout(() => {

            span.textContent = oldText;

            icon.className = oldClass;

        }, 1800);

    });

});
