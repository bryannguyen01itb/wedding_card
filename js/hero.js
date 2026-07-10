const heroAnimationItems = [
    { selector: ".text_1", delay: 300 },
    { selector: ".heart", delay: 450 },
    { selector: ".text_2", delay: 600 },
    { selector: ".info", delay: 1300 }
];

function startHeroAnimation(){

    heroAnimationItems.forEach(item => {

        const element = document.querySelector(item.selector);

        if(!element){

            return;

        }

        setTimeout(() => {

            element.classList.add("show");

        }, item.delay);

    });

}
