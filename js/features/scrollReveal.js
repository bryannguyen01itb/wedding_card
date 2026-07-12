const SECTION_REVEAL_SELECTORS = {
    saveDate: [".save-date .animate-item"],
    divider: [".section-divider"],
    about: [
        ".about .about-title",
        ".about .section-subtitle:not([hidden])",
        ".about .about-portrait",
        ".about .person"
    ],
    timeline: [
        ".timeline .section-title",
        ".timeline .section-subtitle:not([hidden])",
        ".timeline .timeline-card"
    ],
    gallery: [
        ".gallery .section-title",
        ".gallery .section-subtitle:not([hidden])"
    ],
    wish: [
        ".wish .section-title",
        ".wish .section-subtitle:not([hidden])",
        ".wish .wish-form",
        ".wish .wish-list",
        ".wish .load-more"
    ],
    gift: [
        ".gift .section-title",
        ".gift .section-subtitle:not([hidden])",
        ".gift .gift-desc",
        ".gift .gift-box"
    ],
    countdown: [
        ".countdown .section-title",
        ".countdown .section-subtitle:not([hidden])",
        ".countdown .count-item"
    ],
    thanks: [
        ".thanks .thanks-heart",
        ".thanks .thanks-title",
        ".thanks .section-subtitle:not([hidden])",
        ".thanks .thanks-content",
        ".thanks .thanks-sign"
    ]
};

const REVEAL_SELECTOR = Object.values(SECTION_REVEAL_SELECTORS).flat().join(",");
const SECTION_STAGGER = 55;
const GALLERY_STAGGER = 60;
const REVEAL_RATIO = 0.82;
const ROOT_MARGIN = "0px 0px -20px 0px";

function revealItem(item) {
    item.classList.add("is-visible");
}

function isInRange(item) {
    const rect = item.getBoundingClientRect();
    return rect.top < window.innerHeight * REVEAL_RATIO && rect.bottom > 0;
}

function revealVisible(items) {
    items.forEach(item => {
        if (!item.classList.contains("is-visible") && isInRange(item)) {
            revealItem(item);
        }
    });
}

function observeOnce(items, options) {
    if (!("IntersectionObserver" in window)) {
        revealVisible(items);
        window.addEventListener("scroll", () => revealVisible(items), { passive: true });
        window.addEventListener("resize", () => revealVisible(items));
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                revealItem(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, options);

    items.forEach(item => observer.observe(item));
    requestAnimationFrame(() => revealVisible(items));
}

function prepareRevealItems(items, className, delayVar, delayStep, delayCycle) {
    items.forEach((item, index) => {
        item.classList.add(className);
        item.style.setProperty(delayVar, `${Math.min(index % delayCycle, delayCycle - 1) * delayStep}ms`);
    });
}

function prepareGalleryItems(items) {
    items.forEach((item, index) => {
        const direction = index === 0 || index % 2 === 1 ? "from-left" : "from-right";
        item.classList.add("gallery-reveal", direction);
        item.style.setProperty("--gallery-delay", `${Math.min(index % 4, 3) * GALLERY_STAGGER}ms`);
    });
}

export function initScrollReveal() {
    const sectionItems = document.querySelectorAll(REVEAL_SELECTOR);
    const galleryItems = document.querySelectorAll(".gallery-item");

    prepareRevealItems(sectionItems, "scroll-reveal", "--reveal-delay", SECTION_STAGGER, 3);
    observeOnce(sectionItems, { threshold: 0.12, rootMargin: ROOT_MARGIN });

    prepareGalleryItems(galleryItems);
    observeOnce(galleryItems, { threshold: 0.18, rootMargin: ROOT_MARGIN });
}
