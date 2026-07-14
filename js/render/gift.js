import { wedding } from "../config.js";
import { createEl } from "../utils/dom.js";
import { setImageWithFallback } from "../utils/mediaFallback.js";

const GIFT_ORDER = [
    { role: "groom", person: "groom" },
    { role: "bride", person: "bride" }
];

function createGiftCard(gift, label, role) {
    const card = createEl("div", "gift-card");
    const qr = document.createElement("img");
    qr.className = "gift-qr";
    qr.alt = `QR ${label}`;
    setImageWithFallback(qr, gift.qr, `qr-${role}`);

    card.appendChild(createEl("div", "gift-name", label));
    card.appendChild(qr);
    card.appendChild(createEl("div", "gift-bank", gift.bank));
    card.appendChild(createEl("div", "gift-account-name", gift.accountName));
    const copyBox = createEl("div", "copy-box copy-number");
    copyBox.innerHTML = `<span>${gift.accountNumber}</span><i class="bi bi-clipboard"></i>`;
    card.appendChild(copyBox);
    return card;
}

export function renderGift() {
    const container = document.getElementById("giftCards");
    if (!container) return;

    GIFT_ORDER.forEach(({ role, person }) => {
        container.appendChild(
            createGiftCard(wedding.gift[role], wedding[person].nickname, role)
        );
    });
}
