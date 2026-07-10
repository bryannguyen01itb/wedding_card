import { wedding } from "../config.js";
import { createEl } from "../utils/dom.js";

const GIFT_ORDER = [
    { role: "groom", person: "groom" },
    { role: "bride", person: "bride" }
];

function createGiftCard(gift, label) {
    const card = createEl("div", "gift-card");
    card.innerHTML = `
        <div class="gift-name">${label}</div>
        <img class="gift-qr" src="${gift.qr}" alt="QR ${label}">
        <div class="gift-bank">${gift.bank}</div>
        <div class="gift-account-name">${gift.accountName}</div>
        <div class="copy-box copy-number">
            <span>${gift.accountNumber}</span>
            <i class="bi bi-clipboard"></i>
        </div>
    `;
    return card;
}

export function renderGift() {
    const container = document.getElementById("giftCards");
    if (!container) return;

    GIFT_ORDER.forEach(({ role, person }) => {
        container.appendChild(
            createGiftCard(wedding.gift[role], wedding[person].nickname)
        );
    });
}
