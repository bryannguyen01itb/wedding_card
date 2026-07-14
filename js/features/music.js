import { bindClick } from "../utils/dom.js";
import { wedding } from "../config.js";
import { localMusicFallback, shouldTryRemoteFallback } from "../utils/mediaFallback.js";

const audio = document.getElementById("bgMusic");
const musicButton = document.getElementById("musicBtn");
let playing = false;

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

function useMusicSource(src) {
    if (!audio || !src) return;
    audio.src = src;
    audio.load();
}

export function initMusic() {
    if (audio && wedding.music) {
        useMusicSource(wedding.music);
        audio.addEventListener("error", () => {
            const fallback = localMusicFallback();
            if (fallback && shouldTryRemoteFallback(audio.currentSrc || audio.src)) {
                console.warn("Nhac remote loi, thu fallback local:", fallback);
                useMusicSource(fallback);
            }
        });
    }

    bindClick(musicButton, () => {
        playing ? pauseMusic() : playMusic();
    });
}
