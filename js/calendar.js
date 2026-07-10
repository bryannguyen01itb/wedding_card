const calendarDate = new Date(wedding.date);

const selectedDay = calendarDate.getDate();

const selectedMonth = calendarDate.getMonth();

const selectedYear = calendarDate.getFullYear();

const monthNames = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

const monthElement = document.getElementById("month");

const yearElement = document.getElementById("year");

const calendarElement = document.getElementById("calendarDays");

if(monthElement && yearElement && calendarElement){

    monthElement.textContent = monthNames[selectedMonth];

    yearElement.textContent = selectedYear;

    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);

    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    calendarElement.textContent = "";

    for(let index = 0; index < startOffset; index++){

        calendarElement.appendChild(document.createElement("span"));

    }

    for(let day = 1; day <= totalDays; day++){

        const dayElement = document.createElement("span");

        dayElement.textContent = day;

        if(day === selectedDay){

            dayElement.classList.add("active");

        }

        calendarElement.appendChild(dayElement);

    }

}
