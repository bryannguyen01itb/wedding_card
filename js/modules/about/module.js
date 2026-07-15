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
        // Builder ẩn/hiện ô upload theo flags này (tránh upload Cloudinary thừa)
        "concept-1": {
            layout: "portrait-card",
            usesAboutCardImage: true,
            usesPersonAvatars: false
        },
        "concept-2": {
            layout: "dual-avatar",
            usesAboutCardImage: false,
            usesPersonAvatars: true
        },
        "concept-3": {
            layout: "dual-avatar",
            usesAboutCardImage: false,
            usesPersonAvatars: true
        },
        "concept-4": {
            layout: "portrait-card",
            usesAboutCardImage: true,
            usesPersonAvatars: false
        }
    },
    render: renderAbout
};
