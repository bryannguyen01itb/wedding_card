import { setText, setSrc } from "../utils/dom.js";

export function renderPerson(role, person) {
    setSrc(`${role}Avatar`, person.avatar);
    setText(`${role}Name`, person.fullName);
    setText(`${role}Father`, `Con ông: ${person.father}`);
    setText(`${role}Mother`, `và bà: ${person.mother}`);
}
