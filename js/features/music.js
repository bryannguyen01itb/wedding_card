import { bindClick } from "../utils/dom.js";
import { wedding } from "../config.js";

const audio = document.getElementById("bgMusic");
const musicButton = document.getElementById("musicBtn");
let playing = false;

if (audio) {
    audio.src = wedding.music;
}

function setMusicPlaying(isPlaying) {
    playing = isPlaying;
    musicButton?.classList.toggle("playing", isPlaying);
}

export function showMusic() {
    musicButton?.classList.add("show");
}

export function playMusic() {
    if (!audio) return;

    audio.play()
        .then(() => setMusicPlaying(true))
        .catch(error => {
            setMusicPlaying(false);
            console.warn("Không thể tự động phát nhạc:", error);
        });
}

function pauseMusic() {
    audio?.pause();
    setMusicPlaying(false);
}

export function initMusic() {
    bindClick(musicButton, () => {
        playing ? pauseMusic() : playMusic();
    });
}
