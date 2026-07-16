import { bindClick } from "../utils/dom.js";

const floatingGiftButton = document.getElementById("floatingGiftBtn");

export function showGiftButton() {
    floatingGiftButton?.classList.add("show");
}

/**
 * Copy đồng bộ trong user-gesture (click).
 * clipboard API async trong iframe preview hay fail sau await → mất gesture.
 */
function copyTextReliable(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    // 1) execCommand — đồng bộ, ổn định trong iframe + click
    try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.setAttribute("aria-hidden", "true");
        ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, value.length);
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) return true;
    } catch {
        /* fall through */
    }

    // 2) Clipboard API (async — chỉ khi sync fail; vẫn trong cùng tick handler nếu không await trước)
    if (navigator.clipboard?.writeText) {
        // fire-and-forget; UI feedback caller quyết định sau sync path
        navigator.clipboard.writeText(value).catch(() => {});
        // Không chắc thành công — coi là attempted
        return true;
    }

    return false;
}

function flashCopied(box) {
    const span = box.querySelector("[data-copy-label], span");
    const icon = box.querySelector("i");
    if (!span) return;

    const oldText = span.textContent;
    const oldClass = icon?.className || "bi bi-clipboard";
    span.textContent = "✓ Đã sao chép";
    if (icon) icon.className = "bi bi-check-lg";
    box.classList.add("is-copied");

    window.clearTimeout(box._copyFlashTimer);
    box._copyFlashTimer = window.setTimeout(() => {
        span.textContent = oldText;
        if (icon) icon.className = oldClass;
        box.classList.remove("is-copied");
    }, 1800);
}

/** Gọi từ click handler / render (export cho renderGift). */
export function copyGiftAccountFromBox(box) {
    if (!box) return false;
    const value = String(
        box.getAttribute("data-account")
        || box.dataset?.account
        || box.querySelector("[data-copy-label], span")?.textContent
        || ""
    ).trim();

    if (!value || value === "✓ Đã sao chép") return false;

    const ok = copyTextReliable(value);
    if (ok) {
        flashCopied(box);
    } else {
        const span = box.querySelector("[data-copy-label], span");
        if (span) {
            const old = span.textContent;
            span.textContent = "Không copy được";
            window.setTimeout(() => { span.textContent = old; }, 1600);
        }
    }
    return ok;
}

function onGiftCopyClick(event) {
    const box = event.target.closest?.(".copy-number, .copy-box[data-account], button.copy-box");
    if (!box) return;
    if (!box.closest("#giftCards, #giftModal, .gift-modal, .gift")) return;
    event.preventDefault();
    event.stopPropagation();
    copyGiftAccountFromBox(box);
}

export function initGift() {
    const modal = document.getElementById("giftModal");

    if (modal && modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    function setOpen(isOpen) {
        if (!modal) return;
        modal.classList.toggle("show", isOpen);
        modal.setAttribute("aria-hidden", String(!isOpen));
        document.body.classList.toggle("modal-open", isOpen);
    }

    bindClick(document.getElementById("openGiftBox"), () => setOpen(true));
    bindClick(floatingGiftButton, () => setOpen(true));
    bindClick(document.getElementById("closeGiftBox"), () => setOpen(false));
    bindClick(document.getElementById("closeGiftBackdrop"), () => setOpen(false));

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal?.classList.contains("show")) {
            setOpen(false);
        }
    });

    // Delegation 1 lần — sống qua soft re-render
    if (document.documentElement.dataset.giftCopyBound !== "1") {
        document.documentElement.dataset.giftCopyBound = "1";
        // capture=true: ăn click trước layer khác (nếu có)
        document.addEventListener("click", onGiftCopyClick, true);
        document.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const box = event.target.closest?.(".copy-number, .copy-box[data-account]");
            if (!box) return;
            event.preventDefault();
            copyGiftAccountFromBox(box);
        }, true);
    }
}
