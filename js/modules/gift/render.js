import { wedding } from "../../config.js";
import { createEl, setText, setOptionalText } from "../../utils/dom.js";
import { setImageWithFallback } from "../../utils/mediaFallback.js";
import { copyGiftAccountFromBox } from "../../features/gift.js";

const GIFT_ORDER = [
    { role: "groom", person: "groom" },
    { role: "bride", person: "bride" }
];

function createGiftCard(gift = {}, label, role) {
    const card = createEl("div", "gift-card");
    const qr = document.createElement("img");
    qr.className = "gift-qr";
    qr.alt = `QR ${label}`;
    setImageWithFallback(qr, gift.qr, `qr-${role}`);

    card.appendChild(createEl("div", "gift-name", label));
    card.appendChild(qr);
    card.appendChild(createEl("div", "gift-bank", gift.bank || ""));
    card.appendChild(createEl("div", "gift-account-name", gift.accountName || ""));

    const account = String(gift.accountNumber || "").trim();
    // <button> — click/keyboard rõ hơn div; data-account không phụ thuộc text span
    const copyBox = document.createElement("button");
    copyBox.type = "button";
    copyBox.className = "copy-box copy-number";
    copyBox.setAttribute("data-account", account);
    copyBox.setAttribute("aria-label", account ? `Copy số tài khoản ${account}` : "Chưa có số tài khoản");
    copyBox.title = account ? "Bấm để copy số tài khoản" : "Chưa có số tài khoản";
    copyBox.disabled = !account;
    copyBox.innerHTML = `<span data-copy-label>${account || "—"}</span><i class="bi bi-clipboard" aria-hidden="true"></i>`;

    // Handler trực tiếp + delegation (double-safe với soft re-render)
    copyBox.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        copyGiftAccountFromBox(copyBox);
    });

    card.appendChild(copyBox);
    return card;
}

export function renderGift() {
    const giftSection = wedding.sections?.gift || {};
    setText("giftTitle", giftSection.title);
    setOptionalText("giftDesc", giftSection.description);
    setText("giftOpenLabel", giftSection.openLabel);
    setOptionalText("giftSubtitle", wedding.sectionSubtitles?.gift);

    const container = document.getElementById("giftCards");
    if (!container) return;

    container.textContent = "";
    GIFT_ORDER.forEach(({ role, person }) => {
        const gift = wedding.gift?.[role] || {};
        const label = wedding[person]?.nickname || (role === "groom" ? "Chú rể" : "Cô dâu");
        container.appendChild(createGiftCard(gift, label, role));
    });
}
