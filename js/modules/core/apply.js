/**
 * Apply registered section skins to the DOM.
 * Isolated from color/palette helpers in utils/theme.js.
 */
import {
    getRegisteredSections,
    getAllElementSkinClasses,
    getElementSkinClass,
    getBodyBlockClass,
    normalizeSkinId,
    normalizeToken,
    getSkin,
    resolveSectionSkin
} from "./registry.js";

const FONT_CLASS_PREFIXES = ["font-body-", "font-nickname-"];

function collectBodyBlockPrefixes() {
    return getRegisteredSections().map(section => `block-${normalizeToken(section.id)}-`);
}

function removePrefixedClasses(element, prefixes) {
    [...element.classList].forEach(className => {
        if (prefixes.some(prefix => className.startsWith(prefix))) {
            element.classList.remove(className);
        }
    });
}

/**
 * Attach block-skin-* on each section root and block-<section>-<skin> on body.
 */
export function applyModuleClasses(themeConfig = {}) {
    const body = document.body;
    const blocks = themeConfig.blocks || {};
    const fonts = themeConfig.fonts || {};
    const skinClasses = getAllElementSkinClasses();
    const bodyPrefixes = [...collectBodyBlockPrefixes(), ...FONT_CLASS_PREFIXES];

    removePrefixedClasses(body, bodyPrefixes);

    getRegisteredSections().forEach(section => {
        if (!section.selector || section.applySkin === false) return;

        const skinId = resolveSectionSkin(section.id, blocks);
        document.querySelectorAll(section.selector).forEach(element => {
            element.classList.remove(...skinClasses);
            element.classList.add(getElementSkinClass(skinId));
        });

        body.classList.add(getBodyBlockClass(section.id, skinId));
    });

    // Forward-compatible: honour extra block keys not yet in this build's registry.
    Object.entries(blocks).forEach(([sectionId, option]) => {
        if (getRegisteredSections().some(section => section.id === sectionId)) return;
        body.classList.add(getBodyBlockClass(sectionId, normalizeSkinId(option)));
    });

    body.classList.add(`font-body-${normalizeToken(fonts.body)}`);
    body.classList.add(`font-nickname-${normalizeToken(fonts.nickname)}`);
}

/**
 * Resolve open-label for the active cover skin (config override → skin default).
 */
export function resolveCoverOpenLabel(themeConfig = {}) {
    const blocks = themeConfig.blocks || {};
    const skinId = resolveSectionSkin("cover", blocks);
    const skin = getSkin(skinId);
    const conceptConfig = themeConfig?.concepts?.[skinId] || {};
    return conceptConfig?.cover?.openLabel || skin?.openLabel || "Mở thiệp";
}

/**
 * Resolve concept media blob for a section's active skin.
 */
export function getActiveConceptConfig(themeConfig = {}, sectionId) {
    const skinId = resolveSectionSkin(sectionId, themeConfig.blocks || {});
    return {
        skinId,
        skin: getSkin(skinId),
        config: themeConfig?.concepts?.[skinId] || {}
    };
}
