/**
 * Core registry for invitation modules (sections) and skins (concepts).
 *
 * Adding a new section later:
 *   1. Create folder js/modules/<name>/{module.js,render.js}
 *   2. Register in js/modules/index.js (SECTION_MODULES)
 *   3. Add CSS under css/blocks/<name>/ and import in css/blocks/index.css
 *   4. Builder dropdowns auto-pick buildable sections
 *
 * Adding a new skin/concept later:
 *   1. Add entry in js/modules/core/skins.js
 *   2. Add CSS rules in each section's css/blocks/<name>/skins.css
 *   3. Optionally set per-section skinOptions in that module.js
 */

const skins = new Map();
const sections = new Map();
const aliasToSkinId = new Map();

function assertId(id, kind) {
    const value = String(id || "").trim();
    if (!value) {
        throw new Error(`[modules] ${kind} id is required`);
    }
    return value;
}

export function normalizeToken(value, fallback = "default") {
    return String(value || fallback)
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || fallback;
}

/**
 * @param {object} skin
 * @param {string} skin.id - e.g. "concept-1"
 * @param {string} skin.label - builder label
 * @param {string[]} [skin.aliases]
 * @param {string} [skin.openLabel] - default cover open label
 * @param {"none"|"botanical"|"sunset"} [skin.palette]
 */
export function registerSkin(skin) {
    const id = assertId(skin?.id, "skin");
    const entry = {
        id,
        label: skin.label || id,
        aliases: Array.isArray(skin.aliases) ? skin.aliases : [],
        openLabel: skin.openLabel || "Mở thiệp",
        palette: skin.palette || "none",
        ...skin
    };

    skins.set(id, entry);
    aliasToSkinId.set(id, id);
    entry.aliases.forEach(alias => {
        aliasToSkinId.set(String(alias).trim().toLowerCase(), id);
    });

    return entry;
}

/**
 * @param {object} section
 * @param {string} section.id - e.g. "cover", "gallery"
 * @param {string} section.label - builder label
 * @param {string} section.selector - DOM selector for the section root
 * @param {string} section.builderField - form field name in builder
 * @param {string} [section.defaultSkin]
 * @param {string[]} [section.skins] - allowed skin ids; default = all registered skins
 * @param {object} [section.skinOptions] - per-skin metadata, e.g. gallery photoLimit
 * @param {object} [section.media] - which concept media keys this section consumes
 * @param {string} [section.cssFile] - ownership hint for maintainers
 * @param {boolean} [section.buildable=true] - show in builder skin selects
 * @param {boolean} [section.applySkin=true] - attach block-skin classes
 * @param {Function} [section.render] - optional render(wedding) hook
 */
export function registerSection(section) {
    const id = assertId(section?.id, "section");
    const entry = {
        id,
        label: section.label || id,
        selector: section.selector || "",
        builderField: section.builderField || `block${id.charAt(0).toUpperCase()}${id.slice(1)}`,
        defaultSkin: section.defaultSkin || "concept-1",
        skins: Array.isArray(section.skins) ? section.skins : null,
        skinOptions: section.skinOptions || {},
        media: section.media || {},
        cssFile: section.cssFile || "",
        buildable: section.buildable !== false,
        applySkin: section.applySkin !== false,
        render: typeof section.render === "function" ? section.render : null,
        order: Number.isFinite(section.order) ? section.order : sections.size,
        ...section
    };

    sections.set(id, entry);
    return entry;
}

export function getBuildableSections() {
    return getRegisteredSections().filter(section => section.buildable);
}

export function getRegisteredSkins() {
    return [...skins.values()];
}

export function getSkin(id) {
    return skins.get(normalizeSkinId(id)) || null;
}

export function getRegisteredSections() {
    return [...sections.values()].sort((a, b) => a.order - b.order);
}

export function getSection(id) {
    return sections.get(String(id || "").trim()) || null;
}

export function normalizeSkinId(value, fallback = "concept-1") {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return fallback;

    if (aliasToSkinId.has(raw)) {
        return aliasToSkinId.get(raw);
    }

    // Accept unknown future ids if they look like tokens (concept-5, floral, ...)
    const token = normalizeToken(raw, "");
    if (token && skins.has(token)) {
        return token;
    }

    // Keep stable fallback for legacy/unknown config so cards never break.
    return skins.has(fallback) ? fallback : (getRegisteredSkins()[0]?.id || "concept-1");
}

/** Skins 1–4 cho section thường. Section đặc biệt (vd gallery) tự khai báo `skins: [...]`. */
const DEFAULT_SECTION_SKIN_IDS = ["concept-1", "concept-2", "concept-3", "concept-4"];

export function getSectionSkinIds(sectionId) {
    const section = getSection(sectionId);
    const fallbackList = DEFAULT_SECTION_SKIN_IDS.filter(id => skins.has(id));

    if (!section) return fallbackList;

    if (Array.isArray(section.skins) && section.skins.length) {
        return section.skins
            .map(id => normalizeSkinId(id, section.defaultSkin))
            .filter((id, index, list) => list.indexOf(id) === index);
    }

    // Không trả về toàn bộ skin đã đăng ký — tránh concept gallery-only lộ sang cover/poster/...
    return fallbackList;
}

export function getSectionSkinOptions(sectionId, skinId) {
    const section = getSection(sectionId);
    if (!section) return {};

    const normalized = resolveSectionSkin(sectionId, { [sectionId]: skinId });
    return {
        ...(section.skinOptions?.default || {}),
        ...(section.skinOptions?.[normalized] || {})
    };
}

export function resolveSectionSkin(sectionId, blocks = {}) {
    const section = getSection(sectionId);
    const fallback = section?.defaultSkin || "concept-1";
    const raw = normalizeSkinId(blocks?.[sectionId], fallback);
    const allowed = getSectionSkinIds(sectionId);

    if (allowed.includes(raw)) return raw;
    return allowed.includes(fallback) ? fallback : (allowed[0] || "concept-1");
}

export function getBodyBlockClass(sectionId, skinId) {
    return `block-${normalizeToken(sectionId)}-${normalizeToken(skinId)}`;
}

export function getElementSkinClass(skinId) {
    return `block-skin-${normalizeToken(skinId)}`;
}

export function getAllElementSkinClasses() {
    return getRegisteredSkins().map(skin => getElementSkinClass(skin.id));
}

export function getDefaultBlocksConfig() {
    const blocks = {};
    getRegisteredSections()
        .filter(section => section.buildable !== false)
        .forEach(section => {
            blocks[section.id] = section.defaultSkin;
        });
    return blocks;
}

export function getBuilderFieldMap() {
    const map = {};
    getRegisteredSections()
        .filter(section => section.buildable !== false)
        .forEach(section => {
            map[section.builderField] = section.id;
        });
    return map;
}

export function getPreviewTargetMap() {
    const map = {};
    getRegisteredSections()
        .filter(section => section.buildable !== false)
        .forEach(section => {
            if (section.builderField && section.selector) {
                map[section.builderField] = section.selector;
            }
        });
    return map;
}

/** Clear registry — mainly for tests. */
export function clearRegistry() {
    skins.clear();
    sections.clear();
    aliasToSkinId.clear();
}
