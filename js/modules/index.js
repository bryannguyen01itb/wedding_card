/**
 * Invitation module system entrypoint.
 *
 * Folder layout (one section = one folder):
 *   js/modules/<section>/{module.js, render.js}
 *   css/blocks/<section>/skins.css
 *
 * Register new sections only here — never hardcode section lists elsewhere.
 */
import {
    registerSection,
    getRegisteredSections,
    getBuildableSections,
    getSection,
    getRegisteredSkins,
    getSkin,
    normalizeSkinId,
    normalizeToken,
    getSectionSkinIds,
    getSectionSkinOptions,
    resolveSectionSkin,
    getBodyBlockClass,
    getElementSkinClass,
    getAllElementSkinClasses,
    getBuilderFieldMap,
    getPreviewTargetMap,
    getDefaultBlocksConfig
} from "./core/registry.js";
import { registerAllSkins, SKIN_DEFINITIONS } from "./core/skins.js";
import { coverModule } from "./cover/module.js";
import { posterModule } from "./poster/module.js";
import { saveDateModule } from "./save-date/module.js";
import { aboutModule } from "./about/module.js";
import { timelineModule } from "./timeline/module.js";
import { galleryModule } from "./gallery/module.js";
import { countdownModule } from "./countdown/module.js";
import { dividerModule } from "./divider/module.js";
import { giftModule } from "./gift/module.js";
import { wishModule } from "./wish/module.js";
import { thanksModule } from "./thanks/module.js";

/** Buildable block sections + fixed chrome modules (gift/wish/thanks). */
const SECTION_MODULES = [
    coverModule,
    posterModule,
    saveDateModule,
    aboutModule,
    timelineModule,
    galleryModule,
    countdownModule,
    dividerModule,
    giftModule,
    wishModule,
    thanksModule
];

let bootstrapped = false;

export function bootstrapModules() {
    if (bootstrapped) return;
    registerAllSkins();
    SECTION_MODULES.forEach(registerSection);
    bootstrapped = true;
}

// Auto-bootstrap on first import.
bootstrapModules();

export {
    registerSection,
    getRegisteredSections,
    getBuildableSections,
    getSection,
    getRegisteredSkins,
    getSkin,
    normalizeSkinId,
    normalizeToken,
    getSectionSkinIds,
    getSectionSkinOptions,
    resolveSectionSkin,
    getBodyBlockClass,
    getElementSkinClass,
    getAllElementSkinClasses,
    getBuilderFieldMap,
    getPreviewTargetMap,
    getDefaultBlocksConfig,
    SKIN_DEFINITIONS,
    SECTION_MODULES
};

// renderContent lives in ./render-all.js (imported by js/render/index.js / app).

/**
 * Build blocks config from builder form fields.
 * Only buildable sections are written into theme.blocks.
 */
export function blocksFromBuilderFields(fields = {}) {
    const blocks = {};
    getBuildableSections().forEach(section => {
        const raw = fields[section.builderField] ?? fields[section.id];
        blocks[section.id] = normalizeSkinId(raw, section.defaultSkin);
    });
    return blocks;
}

/**
 * Fill builder <select name="block…"> options from the registry.
 * @param {ParentNode} [root]
 * @param {{ ceremonyMode?: string }} [context] — filter skin timeline theo mode
 */
export function populateBuilderBlockSelects(root = document, context = {}) {
    getBuildableSections().forEach(section => {
        const select = root.querySelector(`select[name="${section.builderField}"]`);
        if (!select) return;

        const current = select.value;
        const skinIds = getSectionSkinIds(section.id, context);
        select.textContent = "";

        if (!skinIds.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = section.id === "timeline"
                ? "Chưa có concept tổ chức chung (sẽ thêm sau)"
                : "Chưa có concept";
            select.appendChild(option);
            select.disabled = true;
            select.value = "";
            return;
        }

        select.disabled = false;
        skinIds.forEach(skinId => {
            const skin = getSkin(skinId);
            const option = document.createElement("option");
            option.value = skinId;
            option.textContent = skin?.label || skinId;
            select.appendChild(option);
        });

        if (current && skinIds.includes(normalizeSkinId(current, section.defaultSkin))) {
            select.value = normalizeSkinId(current, section.defaultSkin);
        } else {
            select.value = skinIds.includes(section.defaultSkin)
                ? section.defaultSkin
                : skinIds[0];
        }
    });
}
