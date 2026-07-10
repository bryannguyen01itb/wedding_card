import { renderContent } from "./render/content.js";
import { initCover } from "./features/main.js";
import { initMusic } from "./features/music.js";
import { initScrollReveal } from "./features/scrollReveal.js";
import { initCalendar } from "./features/calendar.js";
import { initCountdown } from "./features/countdown.js";
import { initGift } from "./features/gift.js";
import { initWish } from "./features/wish.js";

renderContent();
initCover();
initMusic();
initCalendar();
initCountdown();
initScrollReveal();
initGift();
initWish();
