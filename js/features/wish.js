import { db } from "../firebase.js";
import { createEl } from "../utils/dom.js";

let allWishes = [];
let expanded = false;

const form = {
    name: document.getElementById("wishName"),
    message: document.getElementById("wishMessage"),
    button: document.getElementById("wishBtn"),
    list: document.getElementById("wishList"),
    loadMore: document.getElementById("loadMoreBtn")
};

function getChecked(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function resetForm() {
    form.name.value = "";
    form.message.value = "";
    const defaultAttendance = document.querySelector('input[name="attendance"][value="Có tham gia"]');
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
    if (!data.name) { alert("Vui lòng nhập tên."); return false; }
    if (!data.message) { alert("Vui lòng nhập lời chúc."); return false; }
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
            alert("Đã gửi lời chúc!");
            resetForm();
        })
        .catch(error => {
            console.error(error);
            alert("Gửi thất bại.");
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
    const attending = attendance === "Có tham gia";

    const card = createEl("div", "wish-card");
    const header = createEl("div", "wish-header");
    const userInfo = createEl("div", "user-info");

    header.appendChild(createEl("div", "avatar", name.charAt(0).toUpperCase()));
    userInfo.appendChild(createEl("div", "user-name", name));
    userInfo.appendChild(createEl("div", "user-side", side));
    userInfo.appendChild(createEl(`attendance-badge ${attending ? "attending" : "absent"}`, attendance));
    header.appendChild(userInfo);

    card.appendChild(header);
    card.appendChild(createEl("div", "wish-message", data.message || ""));
    card.appendChild(createEl("div", "wish-time", formatTime(data.createdAt)));

    return card;
}

function updateLoadMore() {
    if (allWishes.length <= 3) {
        form.loadMore.style.display = "none";
        return;
    }

    form.loadMore.style.display = "block";
    form.loadMore.textContent = expanded
        ? "Thu gọn"
        : `Xem tất cả lời chúc (${allWishes.length})`;
    form.loadMore.classList.toggle("collapse", expanded);
}

function render() {
    form.list.textContent = "";
    const wishes = expanded ? allWishes : allWishes.slice(0, 3);
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
