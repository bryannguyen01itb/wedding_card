function setMenuOpen(header, toggle, isOpen) {
    header.classList.toggle("menu-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Đóng menu" : "Mở menu");
}

function scrollToSection(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function initHeaderMenu() {
    const header = document.querySelector(".invitation__header");
    const toggle = document.getElementById("invitationMenuToggle");
    const menu = document.getElementById("invitationMenu");

    if (!header || !toggle || !menu) return;

    toggle.addEventListener("click", event => {
        event.stopPropagation();
        setMenuOpen(header, toggle, !header.classList.contains("menu-open"));
    });

    menu.addEventListener("click", event => {
        const item = event.target.closest(".invitation-menu__item");
        if (!item) return;

        scrollToSection(item.dataset.target);
        setMenuOpen(header, toggle, false);
    });

    document.addEventListener("click", event => {
        if (!header.contains(event.target)) {
            setMenuOpen(header, toggle, false);
        }
    });

    window.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            setMenuOpen(header, toggle, false);
        }
    });
}
