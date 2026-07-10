import { renderContent } from "./render/index.js";
import { initCover } from "./features/cover.js";
import { initMusic } from "./features/music.js";
import { initScrollReveal } from "./features/scrollReveal.js";
import { initCalendar } from "./features/calendar.js";
import { initCountdown } from "./features/countdown.js";
import { initGift } from "./features/gift.js";
import { initWish } from "./features/wish.js";
import { initHeaderMenu } from "./features/headerMenu.js";

// 1. Render nội dung từ config vào DOM
renderContent();

// 2. Khởi tạo tính năng tương tác
initCover();
initHeaderMenu();
initMusic();
initCalendar();
initCountdown();
initScrollReveal();
initGift();
initWish();
