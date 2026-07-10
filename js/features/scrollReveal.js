const REVEAL_SELECTOR = [
    ".save-date .animate-item",
    ".section-divider",
    ".about .about-title",
    ".about .person",
    ".timeline .section-title",
    ".timeline .timeline-card",
    ".gallery .section-title",
    ".wish .section-title",
    ".wish .wish-form",
    ".wish .wish-list",
    ".wish .load-more",
    ".gift .section-title",
    ".gift .gift-desc",
    ".gift .gift-box",
    ".countdown .section-title",
    ".countdown .count-item",
    ".thanks .thanks-heart",
    ".thanks .thanks-title",
    ".thanks .thanks-content",
    ".thanks .thanks-sign"
].join(",");

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

export function initScrollReveal() {
    const items = document.querySelectorAll(REVEAL_SELECTOR);

    items.forEach((item, index) => {
        item.classList.add("scroll-reveal");
        item.style.setProperty("--reveal-delay", `${Math.min(index % 3, 2) * SECTION_STAGGER}ms`);
    });

    observeOnce(items, { threshold: 0.12, rootMargin: ROOT_MARGIN });

    const galleryItems = document.querySelectorAll(".gallery-item");

    galleryItems.forEach((item, index) => {
        const direction = index === 0 || index % 2 === 1 ? "from-left" : "from-right";
        item.classList.add("gallery-reveal", direction);
        item.style.setProperty("--gallery-delay", `${Math.min(index % 4, 3) * GALLERY_STAGGER}ms`);
    });

    observeOnce(galleryItems, { threshold: 0.18, rootMargin: ROOT_MARGIN });
}
