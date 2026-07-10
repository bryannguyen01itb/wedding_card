import { bindClick } from "../utils/dom.js";

export function initGift() {
    const modal = document.getElementById("giftModal");

    function setOpen(isOpen) {
        if (!modal) return;
        modal.classList.toggle("show", isOpen);
        modal.setAttribute("aria-hidden", String(!isOpen));
        document.body.classList.toggle("modal-open", isOpen);
    }

    bindClick(document.getElementById("openGiftBox"), () => setOpen(true));
    bindClick(document.getElementById("closeGiftBox"), () => setOpen(false));
    bindClick(document.getElementById("closeGiftBackdrop"), () => setOpen(false));

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal?.classList.contains("show")) {
            setOpen(false);
        }
    });

    document.querySelectorAll(".copy-number").forEach(box => {
        box.addEventListener("click", () => {
            const span = box.querySelector("span");
            const icon = box.querySelector("i");
            if (!span || !icon) return;

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
}
