const countdownTarget = new Date(wedding.date).getTime();

const countdownElements = {
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds")
};

function setCountdownValue(key, value){

    if(countdownElements[key]){

        countdownElements[key].textContent = String(value).padStart(2, "0");

    }

}

function updateCountdown(){

    const now = Date.now();

    const distance = Math.max(countdownTarget - now, 0);

    const dayMs = 1000 * 60 * 60 * 24;

    const hourMs = 1000 * 60 * 60;

    const minuteMs = 1000 * 60;

    setCountdownValue("days", Math.floor(distance / dayMs));

    setCountdownValue("hours", Math.floor((distance % dayMs) / hourMs));

    setCountdownValue("minutes", Math.floor((distance % hourMs) / minuteMs));

    setCountdownValue("seconds", Math.floor((distance % minuteMs) / 1000));

}

updateCountdown();

setInterval(updateCountdown, 1000);
