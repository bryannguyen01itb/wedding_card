import { renderCountdown } from "./render.js";

/** Countdown module — days until the wedding. */
export const countdownModule = {
    id: "countdown",
    label: "Đếm ngược",
    selector: ".countdown",
    builderField: "blockCountdown",
    defaultSkin: "concept-1",
    order: 70,
    buildable: true,
    cssFile: "css/blocks/countdown/skins.css",
    media: {
        countdownImage: true
    },
    render: renderCountdown
};
