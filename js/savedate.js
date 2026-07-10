const revealSelector = [
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

function observeOnce(items, options){

    const observer = new IntersectionObserver(entries => {

        entries.forEach(entry => {

            if(entry.isIntersecting){

                entry.target.classList.add("is-visible");

                observer.unobserve(entry.target);

            }

        });

    }, options);

    items.forEach(item => observer.observe(item));

}

const scrollRevealItems = document.querySelectorAll(revealSelector);

scrollRevealItems.forEach((item, index) => {

    item.classList.add("scroll-reveal");

    item.style.setProperty("--reveal-delay", `${Math.min(index % 3, 2) * 55}ms`);

});

observeOnce(scrollRevealItems, {
    threshold: 0.18,
    rootMargin: "0px 0px -8% 0px"
});

const galleryItems = document.querySelectorAll(".gallery-item");

galleryItems.forEach((item, index) => {

    const direction = index === 0 || index % 2 === 1 ? "from-left" : "from-right";

    item.classList.add("gallery-reveal", direction);

});

observeOnce(galleryItems, {
    threshold: 0.28,
    rootMargin: "0px 0px -6% 0px"
});
