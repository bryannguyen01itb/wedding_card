import { wedding } from "../config.js";
import { parseWeddingDate } from "../utils/date.js";
import { resolveSectionSkin } from "../modules/core/registry.js";

const MONTH_NAMES_SHORT = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

const MONTH_NAMES_FULL = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

const WEEK_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** getDay() 0=Sun … 6=Sat — khớp style design (Mon Tue …) */
const WEEKDAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(value) {
    return String(value).padStart(2, "0");
}

/**
 * Detect save-date concept-2 (tim trên ngày active).
 * Ưu tiên class DOM (sau applyTheme) — chắc hơn chỉ đọc blocks khi soft re-render.
 */
function isSaveDateHeartCalendar() {
    const section = document.querySelector(".save-date");
    if (section?.classList.contains("block-skin-concept-2")) return true;
    if (document.body.classList.contains("block-save-date-concept-2")) return true;

    const fromBlocks = resolveSectionSkin("saveDate", wedding.theme?.blocks || {});
    return fromBlocks === "concept-2";
}

function getSaveDateSkin() {
    const section = document.querySelector(".save-date");
    if (section) {
        const match = [...section.classList].find(c => c.startsWith("block-skin-concept-"));
        if (match) return match.replace("block-skin-", "");
    }
    return resolveSectionSkin("saveDate", wedding.theme?.blocks || {});
}

function renderWeekHeader(weekEl, labels) {
    if (!weekEl) return;
    weekEl.textContent = "";
    labels.forEach(label => {
        weekEl.appendChild(Object.assign(document.createElement("span"), { textContent: label }));
    });
}

/**
 * Concept 2: 7 ô, ngày cưới (active + tim) luôn index 3 (GIỮA).
 * offset -3..+3; header nhãn theo đúng thứ của từng ô.
 *
 * vd active = Sat 12 → Wed 9 · Thu 10 · Fri 11 · Sat 12 · Sun 13 · Mon 14 · Tue 15
 * vd active = Mon → Fri Sat Sun Mon Tue Wed Thu
 */
function renderHeartWeekCentered(daysEl, weekEl, selected) {
    const selectedMonth = selected.getMonth();
    const headerLabels = [];

    if (weekEl) weekEl.textContent = "";
    daysEl.textContent = "";

    for (let offset = -3; offset <= 3; offset++) {
        const cell = new Date(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate() + offset
        );
        const label = WEEKDAY_LABELS_EN[cell.getDay()];
        headerLabels.push(label);

        if (weekEl) {
            weekEl.appendChild(
                Object.assign(document.createElement("span"), { textContent: label })
            );
        }

        const dayEl = document.createElement("span");
        dayEl.textContent = String(cell.getDate());
        if (cell.getMonth() !== selectedMonth) {
            dayEl.classList.add("other-month");
        }
        // Ô giữa luôn là ngày cưới
        if (offset === 0) {
            dayEl.classList.add("active");
        }
        daysEl.appendChild(dayEl);
    }

    return headerLabels;
}

export function initCalendar() {
    const date = parseWeddingDate(wedding.date);
    const monthEl = document.getElementById("month");
    const yearEl = document.getElementById("year");
    const daysEl = document.getElementById("calendarDays");
    const weekEl = document.querySelector(".save-date .calendar .week")
        || document.querySelector("#saveDateSection .week");
    const monthYearEl = document.querySelector(".save-date .month-year");
    const dotEl = document.querySelector(".save-date .month-year .dot");

    if (!monthEl || !yearEl || !daysEl) return;

    const skin = getSaveDateSkin();
    const isHeartCal = isSaveDateHeartCalendar() || skin === "concept-2";
    const isTypographyDate = skin === "concept-3";
    const isOverlayPoster = skin === "concept-4";

    const selectedDay = date.getDate();
    const selectedMonth = date.getMonth();
    const selectedYear = date.getFullYear();

    if (isTypographyDate) {
        monthEl.textContent = pad2(selectedDay);
        if (dotEl) {
            dotEl.textContent = pad2(selectedMonth + 1);
            dotEl.classList.add("save-date-date-part");
        }
        yearEl.textContent = String(selectedYear).slice(-2);
        monthYearEl?.classList.add("save-date-date-row");
        monthYearEl?.classList.remove("save-date-full-date");
        daysEl.textContent = "";
        if (weekEl) weekEl.textContent = "";
        return;
    }

    if (isOverlayPoster) {
        monthEl.textContent = `${MONTH_NAMES_FULL[selectedMonth]} ${selectedDay}, ${selectedYear}`;
        if (dotEl) {
            dotEl.textContent = "";
            dotEl.classList.remove("save-date-date-part");
        }
        yearEl.textContent = "";
        monthYearEl?.classList.remove("save-date-date-row");
        monthYearEl?.classList.add("save-date-full-date");
        daysEl.textContent = "";
        if (weekEl) weekEl.textContent = "";
        return;
    }

    monthYearEl?.classList.remove("save-date-date-row");
    monthYearEl?.classList.remove("save-date-full-date");
    if (dotEl) {
        dotEl.textContent = "•";
        dotEl.classList.remove("save-date-date-part");
    }

    monthEl.textContent = isHeartCal
        ? MONTH_NAMES_FULL[selectedMonth]
        : MONTH_NAMES_SHORT[selectedMonth];
    yearEl.textContent = selectedYear;
    daysEl.textContent = "";

    // Concept 2 (tim): canh GIỮA — không còn tuần Mon→Sun cố định
    if (isHeartCal) {
        const selected = new Date(selectedYear, selectedMonth, selectedDay);
        renderHeartWeekCentered(daysEl, weekEl, selected);
        return;
    }

    // Concept 1: full tháng, Mon → Sun
    renderWeekHeader(weekEl, WEEK_MON_FIRST);

    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const startOffset = (firstDay + 6) % 7;
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    for (let i = 0; i < startOffset; i++) {
        daysEl.appendChild(document.createElement("span"));
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayEl = document.createElement("span");
        dayEl.textContent = day;
        if (day === selectedDay) dayEl.classList.add("active");
        daysEl.appendChild(dayEl);
    }
}
