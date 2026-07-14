import { renderAbout } from "./render.js";

/**
 * About module — couple intro.
 * concept 1/4 use aboutCard portrait; concept 2/3 use groom/bride avatars.
 */
export const aboutModule = {
    id: "about",
    label: "Đôi nét về chúng tôi",
    selector: ".about",
    builderField: "blockAbout",
    defaultSkin: "concept-1",
    order: 40,
    buildable: true,
    cssFile: "css/blocks/about/skins.css",
    skinOptions: {
        "concept-1": { layout: "portrait-card", usesAboutCardImage: true },
        "concept-2": { layout: "dual-avatar", usesPersonAvatars: true },
        "concept-3": { layout: "dual-avatar", usesPersonAvatars: true },
        "concept-4": { layout: "portrait-card", usesAboutCardImage: true }
    },
    render: renderAbout
};
