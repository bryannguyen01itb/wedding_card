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

function pad2(value) {
    return String(value).padStart(2, "0");
}

function getSaveDateSkin() {
    return resolveSectionSkin("saveDate", wedding.theme?.blocks || {});
}

function renderWeekHeader(weekEl, labels) {
    if (!weekEl) return;
    weekEl.textContent = "";
    labels.forEach(label => {
        weekEl.appendChild(Object.assign(document.createElement("span"), { textContent: label }));
    });
}

export function initCalendar() {
    const date = parseWeddingDate(wedding.date);
    const monthEl = document.getElementById("month");
    const yearEl = document.getElementById("year");
    const daysEl = document.getElementById("calendarDays");
    const weekEl = document.querySelector(".save-date .calendar .week");
    const monthYearEl = document.querySelector(".save-date .month-year");
    const dotEl = document.querySelector(".save-date .month-year .dot");

    if (!monthEl || !yearEl || !daysEl) return;

    const skin = getSaveDateSkin();
    const isHeartCal = skin === "concept-2";
    const isTypographyDate = skin === "concept-3";
    const isOverlayPoster = skin === "concept-4";

    const selectedDay = date.getDate();
    const selectedMonth = date.getMonth();
    const selectedYear = date.getFullYear();

    if (isTypographyDate) {
        // 30 11 24
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
        // JANUARY 8, 2025 — một dòng dưới tên cặp
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

    // Mon → Sun (concept 2 + default)
    renderWeekHeader(weekEl, WEEK_MON_FIRST);

    // Concept 2: chỉ 1 hàng tuần chứa ngày cưới (Mon→Sun), không full tháng
    if (isHeartCal) {
        const selected = new Date(selectedYear, selectedMonth, selectedDay);
        // getDay(): 0=Sun … 6=Sat → offset về Thứ 2
        const mondayOffset = (selected.getDay() + 6) % 7;
        const weekStart = new Date(selected);
        weekStart.setDate(selectedDay - mondayOffset);

        for (let i = 0; i < 7; i++) {
            const cell = new Date(weekStart);
            cell.setDate(weekStart.getDate() + i);
            const dayEl = document.createElement("span");
            dayEl.textContent = String(cell.getDate());
            if (cell.getMonth() !== selectedMonth) {
                dayEl.classList.add("other-month");
            }
            if (
                cell.getDate() === selectedDay
                && cell.getMonth() === selectedMonth
                && cell.getFullYear() === selectedYear
            ) {
                dayEl.classList.add("active");
            }
            daysEl.appendChild(dayEl);
        }
        return;
    }

    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const startOffset = (firstDay + 6) % 7; // Mon-first
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
