const AUTO_SCROLL_DELAY = 500;
const AUTO_SCROLL_SPEED = 1.05;
const STOP_EVENTS = ["wheel", "touchstart", "touchmove", "pointerdown", "keydown", "mousedown"];

let autoScrollFrame = 0;
let autoScrollTimer = 0;
let isAutoScrolling = false;
let autoScrollPosition = 0;

function stopAutoScroll() {
    if (!isAutoScrolling) return;

    isAutoScrolling = false;
    window.clearTimeout(autoScrollTimer);
    window.cancelAnimationFrame(autoScrollFrame);
    STOP_EVENTS.forEach(eventName => {
        window.removeEventListener(eventName, stopAutoScroll, { passive: true });
    });
}

function bindStopEvents() {
    STOP_EVENTS.forEach(eventName => {
        window.addEventListener(eventName, stopAutoScroll, { passive: true });
    });
}

function getScrollElement() {
    return document.scrollingElement || document.documentElement;
}

function getCurrentScrollY() {
    return window.scrollY || getScrollElement().scrollTop || 0;
}

function stepAutoScroll() {
    if (!isAutoScrolling) return;

    const scrollElement = getScrollElement();
    const maxScroll = scrollElement.scrollHeight - window.innerHeight;
    if (getCurrentScrollY() >= maxScroll - 2) {
        stopAutoScroll();
        return;
    }

    autoScrollPosition = Math.min(maxScroll, autoScrollPosition + AUTO_SCROLL_SPEED);
    window.scrollTo(0, autoScrollPosition);
    scrollElement.scrollTop = autoScrollPosition;
    autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
}

export function startInvitationAutoScroll() {
    stopAutoScroll();
    autoScrollPosition = getCurrentScrollY();
    isAutoScrolling = true;
    bindStopEvents();

    autoScrollTimer = window.setTimeout(() => {
        autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
    }, AUTO_SCROLL_DELAY);
}
