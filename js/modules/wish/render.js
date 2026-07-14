import { wedding } from "../../config.js";
import { $, setText, createEl } from "../../utils/dom.js";

function setOptionalText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    const text = String(value || "").trim();
    element.textContent = text;
    element.hidden = !text;
}

function createRadioOption({ name, value, icon, color, default: isDefault }) {
    const label = createEl("label", "side-card");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    if (isDefault) input.checked = true;

    const content = createEl("span", "side-content");
    const iconEl = createEl("div", "side-icon");

    if (icon.startsWith("bi-")) {
        iconEl.innerHTML = `<i class="bi ${icon}"${color ? ` style="color: ${color};"` : ""}></i>`;
    } else {
        iconEl.textContent = icon;
    }

    content.appendChild(iconEl);
    content.appendChild(createEl("div", "side-text", value));

    label.appendChild(input);
    label.appendChild(content);
    return label;
}

function renderRadioGroup(containerId, name, options) {
    const container = $(containerId);
    if (!container) return;

    container.textContent = "";
    options.forEach(option => {
        container.appendChild(createRadioOption({ name, ...option }));
    });
}

export function renderWishForm() {
    const { wish } = wedding;

    setText("wishTitle", wedding.sections?.wish);
    setOptionalText("wishSubtitle", wedding.sectionSubtitles?.wish);

    const nameInput = $("wishName");
    const messageInput = $("wishMessage");

    if (nameInput) nameInput.placeholder = wish.namePlaceholder;
    if (messageInput) messageInput.placeholder = wish.messagePlaceholder;

    setText("wishAttendanceLabel", wish.attendanceLabel);
    setText("wishBtn", wish.submit);
    setText("loadMoreBtn", wish.loadMore);

    renderRadioGroup("wishSideGroup", "side", wish.sides);
    renderRadioGroup("wishAttendanceGroup", "attendance", wish.attendance);
}
