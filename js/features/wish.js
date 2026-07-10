import { wedding } from "../config.js";
import { db } from "../firebase.js";
import { createEl } from "../utils/dom.js";

const WISH_LIMIT = 3;

let allWishes = [];
let expanded = false;

const form = {
    name: document.getElementById("wishName"),
    message: document.getElementById("wishMessage"),
    button: document.getElementById("wishBtn"),
    list: document.getElementById("wishList"),
    loadMore: document.getElementById("loadMoreBtn")
};

const { wish: wishConfig } = wedding;

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
        alert(wishConfig.validation.noName);
        return false;
    }

    if (!data.message) {
        alert(wishConfig.validation.noMessage);
        return false;
    }

    return true;
}

function sendWish() {
    const data = getFormData();
    if (!validate(data)) return;

    db.collection("wishes").add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
        .then(() => {
            alert(wishConfig.messages.success);
            resetForm();
        })
        .catch(error => {
            console.error(error);
            alert(wishConfig.messages.error);
        });
}

function formatTime(createdAt) {
    if (createdAt?.toDate) return createdAt.toDate().toLocaleString("vi-VN");
    return "";
}

function createWishCard(data) {
    const name = data.name || "Khách mời";
    const side = data.side || "";
    const attendance = data.attendance || "Chưa xác nhận";
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
    card.appendChild(createEl("div", "wish-message", data.message || ""));
    card.appendChild(createEl("div", "wish-time", formatTime(data.createdAt)));

    return card;
}

function updateLoadMore() {
    if (allWishes.length <= WISH_LIMIT) {
        form.loadMore.style.display = "none";
        return;
    }

    form.loadMore.style.display = "block";
    form.loadMore.textContent = expanded
        ? wishConfig.collapse
        : `${wishConfig.loadMore} (${allWishes.length})`;
    form.loadMore.classList.toggle("collapse", expanded);
}

function render() {
    form.list.textContent = "";
    const wishes = expanded ? allWishes : allWishes.slice(0, WISH_LIMIT);
    wishes.forEach(data => form.list.appendChild(createWishCard(data)));
    updateLoadMore();
}

function loadWishes() {
    db.collection("wishes")
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {
            allWishes = snapshot.docs.map(doc => doc.data());
            render();
        });
}

export function initWish() {
    form.button?.addEventListener("click", sendWish);
    form.loadMore?.addEventListener("click", () => {
        expanded = !expanded;
        render();
    });
    loadWishes();
}
