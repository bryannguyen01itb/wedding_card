/**
 * Menu header thiệp — mobile-safe.
 * Panel gắn document.body + position:fixed theo viewport
 * (tránh overflow-x:hidden / transform ancestor clip menu).
 */

let lastToggleAt = 0;
const TOGGLE_DEBOUNCE_MS = 320;

function getHeaderEls() {
    return {
        header: document.querySelector(".invitation__header"),
        toggle: document.getElementById("invitationMenuToggle"),
        menu: document.getElementById("invitationMenu")
    };
}

/** Căn panel fixed theo mép dưới header (viewport coords). */
function positionMenuPanel(header, menu) {
    if (!header || !menu) return;
    const rect = header.getBoundingClientRect();
    const gap = 6;
    const side = 10;
    const left = Math.round(Math.max(side, rect.left + side));
    const width = Math.round(Math.max(120, rect.width - side * 2));
    const top = Math.round(rect.bottom + gap);

    menu.style.position = "fixed";
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.width = `${width}px`;
    menu.style.right = "auto";
    menu.style.bottom = "auto";
    menu.style.zIndex = "10060";
    menu.style.maxHeight = "min(70vh, 420px)";
}

function clearMenuInlinePosition(menu) {
    if (!menu) return;
    menu.style.position = "";
    menu.style.top = "";
    menu.style.left = "";
    menu.style.width = "";
    menu.style.right = "";
    menu.style.bottom = "";
    menu.style.zIndex = "";
    menu.style.maxHeight = "";
}

/** Đưa panel ra body khi mở — thoát clip của .container / transform. */
function mountMenuToBody(menu) {
    if (!menu || menu.parentElement === document.body) return;
    menu.dataset.menuHome = "header";
    document.body.appendChild(menu);
}

function restoreMenuToHeader(header, menu) {
    if (!menu || !header) return;
    if (menu.parentElement === header) return;
    // Chèn sau toggle (cùng thứ tự renderHeader)
    const toggle = document.getElementById("invitationMenuToggle");
    if (toggle && toggle.parentElement === header) {
        toggle.insertAdjacentElement("afterend", menu);
    } else {
        header.appendChild(menu);
    }
    delete menu.dataset.menuHome;
}

function setMenuOpen(header, toggle, menu, isOpen) {
    if (!header || !menu) return;

    header.classList.toggle("menu-open", isOpen);

    if (toggle) {
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Đóng menu" : "Mở menu");
    }

    if (isOpen) {
        mountMenuToBody(menu);
        positionMenuPanel(header, menu);
        menu.classList.add("is-open");
        menu.setAttribute("aria-hidden", "false");
    } else {
        menu.classList.remove("is-open");
        menu.setAttribute("aria-hidden", "true");
        clearMenuInlinePosition(menu);
        restoreMenuToHeader(header, menu);
    }
}

function scrollToSection(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeMenu() {
    const { header, toggle, menu } = getHeaderEls();
    if (header?.classList.contains("menu-open") || menu?.classList.contains("is-open")) {
        setMenuOpen(header, toggle, menu, false);
    }
}

/**
 * Soft re-render header: đóng + gỡ panel mồ côi trên body
 * (tránh #invitationMenu trùng id sau renderHeader).
 */
export function resetHeaderMenu() {
    const orphan = document.body.querySelector(":scope > #invitationMenu, :scope > .invitation-menu");
    if (orphan) {
        orphan.classList.remove("is-open");
        clearMenuInlinePosition(orphan);
        orphan.remove();
    }
    const header = document.querySelector(".invitation__header");
    header?.classList.remove("menu-open");
    const toggle = document.getElementById("invitationMenuToggle");
    if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Mở menu");
    }
}

function toggleMenu() {
    const { header, toggle, menu } = getHeaderEls();
    if (!header || !toggle || !menu) return;
    const open = !header.classList.contains("menu-open");
    setMenuOpen(header, toggle, menu, open);
}

function canToggleNow() {
    const now = Date.now();
    if (now - lastToggleAt < TOGGLE_DEBOUNCE_MS) return false;
    lastToggleAt = now;
    return true;
}

/**
 * Event delegation — sống sót soft re-render header.
 * Dùng click (capture) + touchend fallback, debounce chống double-fire.
 */
export function initHeaderMenu() {
    if (document.documentElement.dataset.headerMenuBound === "1") return;
    document.documentElement.dataset.headerMenuBound = "1";

    const onActivateToggle = event => {
        if (!event.target.closest?.("#invitationMenuToggle")) return;
        event.preventDefault();
        event.stopPropagation();
        if (!canToggleNow()) return;
        toggleMenu();
    };

    // capture=true: nhận trước layer khác; click ổn định trên button iOS/Android
    document.addEventListener("click", event => {
        const { header, toggle, menu } = getHeaderEls();
        if (!header || !toggle || !menu) return;

        if (event.target.closest?.("#invitationMenuToggle")) {
            onActivateToggle(event);
            return;
        }

        const item = event.target.closest?.(".invitation-menu__item");
        if (item && menu.contains(item)) {
            event.preventDefault();
            event.stopPropagation();
            const targetId = item.dataset.target;
            setMenuOpen(header, toggle, menu, false);
            if (targetId) scrollToSection(targetId);
            return;
        }

        if (header.classList.contains("menu-open")) {
            const insideToggle = toggle.contains(event.target);
            const insideMenu = menu.contains(event.target);
            if (!insideToggle && !insideMenu) {
                setMenuOpen(header, toggle, menu, false);
            }
        }
    }, true);

    // touchend fallback: WebView / iOS đôi khi trễ hoặc miss click
    document.addEventListener(
        "touchend",
        event => {
            const t = event.target.closest?.("#invitationMenuToggle");
            if (!t) return;
            // Nếu click sẽ fire sau → debounce chặn double
            onActivateToggle(event);
        },
        { passive: false, capture: true }
    );

    window.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
    });

    const repositionIfOpen = () => {
        const { header, menu } = getHeaderEls();
        if (header?.classList.contains("menu-open") && menu) {
            positionMenuPanel(header, menu);
        }
    };

    window.addEventListener("resize", repositionIfOpen, { passive: true });
    window.addEventListener("scroll", repositionIfOpen, { passive: true, capture: true });
    // visualViewport: mobile URL bar show/hide
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", repositionIfOpen, { passive: true });
        window.visualViewport.addEventListener("scroll", repositionIfOpen, { passive: true });
    }
}
