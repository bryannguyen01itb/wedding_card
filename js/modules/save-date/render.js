import { wedding } from "../../config.js";
import { setText, setOptionalText, createEl } from "../../utils/dom.js";
import { parseWeddingDate } from "../../utils/date.js";
import { resolveSectionSkin } from "../core/registry.js";

function getSaveDateSkin() {
    return resolveSectionSkin("saveDate", wedding.theme?.blocks || {});
}

function getCoupleNamesLine({ joiner = " & ", upper = true } = {}) {
    const groom = String(wedding.groom?.nickname || "").trim();
    const bride = String(wedding.bride?.nickname || "").trim();
    const line = [groom, bride].filter(Boolean).join(joiner);
    return upper ? line.toLocaleUpperCase("vi-VN") : line;
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function getWatermarkDate() {
    const date = parseWeddingDate(wedding.date);
    const dd = pad2(date.getDate());
    const mm = pad2(date.getMonth() + 1);
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
}

/** Couple names — concept 3 (box) / concept 4 (plain "and") */
function renderCoupleNamesBox() {
    const section = document.getElementById("saveDateSection");
    if (!section) return;

    let box = document.getElementById("saveDateCoupleNames");
    const skin = getSaveDateSkin();

    if (skin !== "concept-3" && skin !== "concept-4") {
        box?.remove();
        return;
    }

    if (!box) {
        box = createEl("div", "save-date-couple-names");
        box.id = "saveDateCoupleNames";
        const monthYear = section.querySelector(".month-year");
        if (monthYear) section.insertBefore(box, monthYear);
        else section.appendChild(box);
    }

    if (skin === "concept-4") {
        box.className = "save-date-couple-names save-date-couple-names--plain";
        box.textContent = getCoupleNamesLine({ joiner: " and ", upper: false });
    } else {
        box.className = "save-date-couple-names";
        box.textContent = getCoupleNamesLine({ joiner: " & ", upper: true });
    }
}

/** Concept 2: nét tim SVG + chữ "save the date" (không dùng pseudo/CSS xấu) */
function renderConcept2Extras() {
    const section = document.getElementById("saveDateSection");
    if (!section) return;

    const skin = getSaveDateSkin();
    let ornament = document.getElementById("saveDateHeartLine");
    let footer = document.getElementById("saveDateFooterScript");

    if (skin !== "concept-2") {
        ornament?.remove();
        footer?.remove();
        return;
    }

    if (!ornament) {
        ornament = createEl("div", "save-date-heart-line");
        ornament.id = "saveDateHeartLine";
        ornament.setAttribute("aria-hidden", "true");
        const monthYear = section.querySelector(".month-year");
        if (monthYear) section.insertBefore(ornament, monthYear);
        else section.prepend(ornament);
    }

    // Cánh + trái tim classic (nhìn rõ ♥), stroke = currentColor → primary
    ornament.innerHTML = `
<svg viewBox="0 0 400 64" xmlns="http://www.w3.org/2000/svg" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 40 H152"/>
    <path d="M200 54
      C200 54 154 30 154 16.5
      C154 8.5 161 4 170 4
      C179 4 189 11 200 22
      C211 11 221 4 230 4
      C239 4 246 8.5 246 16.5
      C246 30 200 54 200 54 Z"/>
    <path d="M248 40 H390"/>
  </g>
</svg>`.trim();

    if (!footer) {
        footer = createEl("div", "save-date-footer-script");
        footer.id = "saveDateFooterScript";
        section.appendChild(footer);
    }
    footer.textContent = "save the date";
}

/**
 * Concept 4 extras — element riêng (không dùng .save-title / ::before)
 * để tránh unifier/CSS cũ nhân đôi chữ "you're invited..."
 */
function renderConcept4Extras() {
    const section = document.getElementById("saveDateSection");
    if (!section) return;

    const skin = getSaveDateSkin();
    let mark = document.getElementById("saveDateWatermark");
    let eyebrow = document.getElementById("saveDateEyebrow");
    let script = document.getElementById("saveDateScript");

    if (skin !== "concept-4") {
        mark?.remove();
        eyebrow?.remove();
        script?.remove();
        return;
    }

    // 1) Eyebrow — chỉ 1 dòng, trên cùng
    if (!eyebrow) {
        eyebrow = createEl("p", "save-date-eyebrow");
        eyebrow.id = "saveDateEyebrow";
        section.prepend(eyebrow);
    }
    eyebrow.textContent = "you're invited to the wedding of";

    // 2) Watermark ngày mờ
    if (!mark) {
        mark = createEl("div", "save-date-watermark");
        mark.id = "saveDateWatermark";
        mark.setAttribute("aria-hidden", "true");
        section.insertBefore(mark, eyebrow.nextSibling);
    }
    mark.textContent = getWatermarkDate();

    // 3) Script "Save the Date" — element riêng, không dính .save-title
    if (!script) {
        script = createEl("div", "save-date-script");
        script.id = "saveDateScript";
        const titleEl = document.getElementById("saveDateTitle");
        if (titleEl) section.insertBefore(script, titleEl);
        else section.insertBefore(script, mark.nextSibling);
    }
    script.textContent = "Save the Date";
}

/** Concept 3: 3 dòng script (Save / the / Date) */
function renderConcept3Title() {
    const el = document.getElementById("saveDateTitle");
    if (!el) return;

    el.replaceChildren(
        createEl("span", "std-word std-save", "Save"),
        createEl("span", "std-word std-the", "the"),
        createEl("span", "std-word std-date", "Date")
    );
}

/** Titles + extras theo skin; calendar days: features/calendar.js */
export function renderSaveDate() {
    const skin = getSaveDateSkin();
    // Subtitle luôn lấy từ config user — không xóa khi đổi concept
    const subtitle = wedding.sectionSubtitles?.saveDate;

    if (skin === "concept-2") {
        // Title section ẩn (layout: tim + month + tuần); subtitle vẫn hiện nếu có
        setText("saveDateTitle", "");
        setOptionalText("saveDateSubtitle", subtitle);
    } else if (skin === "concept-3") {
        renderConcept3Title();
        setOptionalText("saveDateSubtitle", subtitle);
    } else if (skin === "concept-4") {
        // Title gốc ẩn — dùng .save-date-script; subtitle vẫn hiện nếu có
        setText("saveDateTitle", "");
        setOptionalText("saveDateSubtitle", subtitle);
    } else {
        setText("saveDateTitle", wedding.sections?.saveDate);
        setOptionalText("saveDateSubtitle", subtitle);
    }

    renderConcept2Extras();
    renderConcept4Extras();
    renderCoupleNamesBox();
}
