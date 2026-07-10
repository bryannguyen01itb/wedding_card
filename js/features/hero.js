const heroItems = [
    { selector: ".text_1", delay: 300 },
    { selector: ".heart", delay: 450 },
    { selector: ".text_2", delay: 600 },
    { selector: ".info", delay: 1300 }
];

export function startHeroAnimation() {
    heroItems.forEach(({ selector, delay }) => {
        const el = document.querySelector(selector);
        if (!el) return;

        setTimeout(() => el.classList.add("show"), delay);
    });
}
