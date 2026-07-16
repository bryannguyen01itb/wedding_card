import { wedding } from "../config.js";
import { db } from "../firebase.js";
import { createEl } from "../utils/dom.js";
import {
    WISH_LIMITS,
    assertWishPayload,
    canSendWishNow,
    markWishSent
} from "../utils/security.js";

const WISH_LIMIT = 3;

let allWishes = [];
let expanded = false;
let sending = false;

const form = {
    name: document.getElementById("wishName"),
    message: document.getElementById("wishMessage"),
    button: document.getElementById("wishBtn"),
    list: document.getElementById("wishList"),
    loadMore: document.getElementById("loadMoreBtn")
};

const { wish: wishConfig } = wedding;

function getWishesCollection() {
    return db
        .collection("weddings")
        .doc(wedding.weddingId)
        .collection("wishes");
}

let toastTimer;

function showWishToast(message, type = "success") {
    let toast = document.getElementById("wishToast");

    if (!toast) {
        toast = createEl("div", "wish-toast");
        toast.id = "wishToast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `wish-toast ${type}`;

    window.clearTimeout(toastTimer);
    requestAnimationFrame(() => toast.classList.add("show"));

    toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

function getChecked(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function getDefaultValue(options) {
    return options.find(option => option.default)?.value || options[0]?.value || "";
}

function resetForm() {
    form.name.value = "";
    form.message.value = "";

    const defaultSide = document.querySelector(`input[name="side"][value="${getDefaultValue(wishConfig.sides)}"]`);
    const defaultAttendance = document.querySelector(`input[name="attendance"][value="${getDefaultValue(wishConfig.attendance)}"]`);

    if (defaultSide) defaultSide.checked = true;
    if (defaultAttendance) defaultAttendance.checked = true;
}

function getFormData() {
    return {
        name: form.name.value.trim(),
        side: getChecked("side"),
        attendance: getChecked("attendance"),
        message: form.message.value.trim()
    };
}

function validate(data) {
    if (!data.name) {
        showWishToast(wishConfig.validation.noName, "error");
        return false;
    }

    if (!data.message) {
        showWishToast(wishConfig.validation.noMessage, "error");
        return false;
    }

    if (data.name.length > WISH_LIMITS.nameMax) {
        showWishToast(`Tên tối đa ${WISH_LIMITS.nameMax} ký tự.`, "error");
        return false;
    }

    if (data.message.length > WISH_LIMITS.messageMax) {
        showWishToast(`Lời chúc tối đa ${WISH_LIMITS.messageMax} ký tự.`, "error");
        return false;
    }

    return true;
}

function bindInputLimits() {
    if (form.name) {
        form.name.maxLength = WISH_LIMITS.nameMax;
        form.name.setAttribute("maxlength", String(WISH_LIMITS.nameMax));
    }
    if (form.message) {
        form.message.maxLength = WISH_LIMITS.messageMax;
        form.message.setAttribute("maxlength", String(WISH_LIMITS.messageMax));
    }
}

async function sendWish() {
    if (sending) return;

    const raw = getFormData();
    if (!validate(raw)) return;

    const rate = canSendWishNow();
    if (!rate.ok) {
        showWishToast(rate.error || "Gửi quá nhanh, thử lại sau.", "error");
        return;
    }

    const checked = assertWishPayload(raw);
    if (!checked.ok) {
        showWishToast(checked.error || wishConfig.validation.noMessage, "error");
        return;
    }

    sending = true;
    if (form.button) form.button.disabled = true;

    try {
        await getWishesCollection().add({
            ...checked.data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        markWishSent();
        showWishToast(wishConfig.messages.success, "success");
        resetForm();
    } catch (error) {
        console.error(error);
        showWishToast(wishConfig.messages.error, "error");
    } finally {
        sending = false;
        if (form.button) form.button.disabled = false;
    }
}

function formatTime(createdAt) {
    if (createdAt?.toDate) return createdAt.toDate().toLocaleString("vi-VN");
    return "";
}

function createWishCard(data) {
    // textContent via createEl — không innerHTML user input (chống XSS)
    const name = String(data.name || "Khách mời").slice(0, WISH_LIMITS.nameMax);
    const side = String(data.side || "").slice(0, WISH_LIMITS.sideMax);
    const attendance = String(data.attendance || "Chưa xác nhận").slice(0, WISH_LIMITS.attendanceMax);
    const message = String(data.message || "").slice(0, WISH_LIMITS.messageMax);
    const attending = attendance === getDefaultValue(wishConfig.attendance);

    const card = createEl("div", "wish-card");
    const pinIcon = createEl("div", "wish-pin");
    const header = createEl("div", "wish-header");
    const userInfo = createEl("div", "user-info");

    const pinSymbol = document.createElement("i");
    pinSymbol.className = "bi bi-quote";
    pinIcon.appendChild(pinSymbol);
    card.appendChild(pinIcon);

    header.appendChild(createEl("div", "avatar", name.charAt(0).toUpperCase()));
    userInfo.appendChild(createEl("div", "user-name", name));
    userInfo.appendChild(createEl("div", "user-side", side));
    userInfo.appendChild(
        createEl("div", `attendance-badge ${attending ? "attending" : "absent"}`, attendance)
    );
    header.appendChild(userInfo);

    card.appendChild(header);
    card.appendChild(createEl("div", "wish-message", message));
    card.appendChild(createEl("div", "wish-time", formatTime(data.createdAt)));

    return card;
}

function updateLoadMore() {
    const btn = form.loadMore;
    if (!btn) return;

    // Không có lời chúc / không vượt limit → ẩn hẳn nút "Xem thêm"
    if (!allWishes.length || allWishes.length <= WISH_LIMIT) {
        btn.hidden = true;
        btn.style.display = "none";
        btn.setAttribute("aria-hidden", "true");
        return;
    }

    btn.hidden = false;
    btn.style.display = "";
    btn.removeAttribute("aria-hidden");
    btn.textContent = expanded
        ? wishConfig.collapse
        : `${wishConfig.loadMore} (${allWishes.length})`;
    btn.classList.toggle("collapse", expanded);
}

function render() {
    form.list.textContent = "";
    const wishes = expanded ? allWishes : allWishes.slice(0, WISH_LIMIT);
    wishes.forEach(data => form.list.appendChild(createWishCard(data)));
    updateLoadMore();
}

function isBuilderPreview() {
    try {
        return new URLSearchParams(window.location.search).get("preview") === "builder";
    } catch (_) {
        return false;
    }
}

function loadWishes() {
    // Preview builder: tuyệt đối không onSnapshot
    if (isBuilderPreview()) {
        allWishes = [];
        render();
        return;
    }

    try {
        getWishesCollection()
            .orderBy("createdAt", "desc")
            .onSnapshot(snapshot => {
                allWishes = snapshot.docs.map(doc => doc.data());
                render();
            }, err => {
                console.warn("[wish] Firestore listen failed (offline?):", err?.code || err);
                allWishes = [];
                render();
            });
    } catch (err) {
        console.warn("[wish] loadWishes skipped:", err);
        allWishes = [];
        render();
    }
}

export function initWish() {
    // Preview builder: app.js thường không gọi; chặn kép nếu vẫn gọi
    if (isBuilderPreview()) {
        allWishes = [];
        try {
            render();
        } catch (_) {
            /* DOM chưa sẵn */
        }
        return;
    }

    bindInputLimits();
    form.button?.addEventListener("click", sendWish);
    form.loadMore?.addEventListener("click", () => {
        expanded = !expanded;
        render();
    });
    loadWishes();
}
