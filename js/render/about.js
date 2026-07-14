import { wedding } from "../config.js";
import { setText, setSrc } from "../utils/dom.js";

export function renderPerson(role, person) {
    const nameElement = document.getElementById(`${role}Name`);
    const sideLabel = role === "groom"
        ? wedding.aboutCard?.groomLabel || "NHÀ TRAI"
        : wedding.aboutCard?.brideLabel || "NHÀ GÁI";

    setSrc(`${role}Avatar`, person.avatar, role);
    setText(`${role}Name`, person.fullName);
    setText(`${role}Father`, `Con ông: ${person.father}`);
    setText(`${role}Mother`, `và bà: ${person.mother}`);

    if (nameElement) {
        nameElement.dataset.side = sideLabel;
    }
}

export function renderAboutCard() {
    const card = wedding.aboutCard || {};
    setSrc("aboutPortraitImage", card.image || wedding.poster?.image, "about");
    setText("aboutPortraitScript", card.script || "First");
    setText("aboutPortraitTitle", card.title || "Married");
}
