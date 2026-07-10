import { wedding } from "../config.js";

const MONTH_NAMES = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

export function initCalendar() {
    const date = new Date(wedding.date);
    const monthEl = document.getElementById("month");
    const yearEl = document.getElementById("year");
    const daysEl = document.getElementById("calendarDays");

    if (!monthEl || !yearEl || !daysEl) return;

    const selectedDay = date.getDate();
    const selectedMonth = date.getMonth();
    const selectedYear = date.getFullYear();

    monthEl.textContent = MONTH_NAMES[selectedMonth];
    yearEl.textContent = selectedYear;
    daysEl.textContent = "";

    const startOffset = (new Date(selectedYear, selectedMonth, 1).getDay() + 6) % 7;
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
