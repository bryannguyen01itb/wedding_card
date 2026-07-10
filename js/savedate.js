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

function revealItem(item){

    item.classList.add("is-visible");

}

function isInRevealRange(item){

    const rect = item.getBoundingClientRect();

    return rect.top < window.innerHeight * 0.82 && rect.bottom > 0;

}

function revealVisibleItems(items){

    items.forEach(item => {

        if(!item.classList.contains("is-visible") && isInRevealRange(item)){

            revealItem(item);

        }

    });

}

function observeOnce(items, options){

    if(!("IntersectionObserver" in window)){

        revealVisibleItems(items);

        window.addEventListener("scroll", () => revealVisibleItems(items), { passive: true });

        window.addEventListener("resize", () => revealVisibleItems(items));

        return;

    }

    const observer = new IntersectionObserver(entries => {

        entries.forEach(entry => {

            if(entry.isIntersecting){

                revealItem(entry.target);

                observer.unobserve(entry.target);

            }

        });

    }, options);

    items.forEach(item => observer.observe(item));

    requestAnimationFrame(() => revealVisibleItems(items));

}

const scrollRevealItems = document.querySelectorAll(revealSelector);

scrollRevealItems.forEach((item, index) => {

    item.classList.add("scroll-reveal");

    item.style.setProperty("--reveal-delay", `${Math.min(index % 3, 2) * 55}ms`);

});

observeOnce(scrollRevealItems, {
    threshold: 0.12,
    rootMargin: "0px 0px -20px 0px"
});

const galleryItems = document.querySelectorAll(".gallery-item");

galleryItems.forEach((item, index) => {

    const direction = index === 0 || index % 2 === 1 ? "from-left" : "from-right";

    item.classList.add("gallery-reveal", direction);

});

observeOnce(galleryItems, {
    threshold: 0.18,
    rootMargin: "0px 0px -20px 0px"
});
