/**
 * Font stacks for theme.fonts.body / theme.fonts.nickname.
 * Applied via late <style> inject + inline style on name nodes so cover/poster cannot pin Great Vibes.
 */

export const BODY_FONT_STACKS = {
    quicksand: '"Quicksand", sans-serif',
    lora: '"Lora", Georgia, serif',
    nunito: '"Nunito Sans", sans-serif',
    montserrat: '"Montserrat", sans-serif',
    poppins: '"Poppins", sans-serif',
    raleway: '"Raleway", sans-serif',
    "josefin-sans": '"Josefin Sans", sans-serif',
    cormorant: '"Cormorant Garamond", Georgia, serif',
    "source-serif": '"Source Serif 4", Georgia, serif',
    roboto: '"Roboto", system-ui, sans-serif',
    "open-sans": '"Open Sans", system-ui, sans-serif'
};

export const NICKNAME_FONT_STACKS = {
    "great-vibes": '"Great Vibes", cursive',
    "dancing-script": '"Dancing Script", cursive',
    parisienne: '"Parisienne", cursive',
    allura: '"Allura", cursive',
    "alex-brush": '"Alex Brush", cursive',
    sacramento: '"Sacramento", cursive',
    "pinyon-script": '"Pinyon Script", cursive',
    tangerine: '"Tangerine", cursive',
    satisfy: '"Satisfy", cursive',
    "mr-de-haviland": '"Mr De Haviland", cursive',
    "playwrite-vn": '"Playwrite VN", cursive',
    pacifico: '"Pacifico", cursive',
    lobster: '"Lobster", cursive',
    lora: '"Lora", Georgia, serif'
};

const STYLE_ID = "theme-font-overrides";

const NICKNAME_NODE_SELECTOR = [
    ".man_name",
    ".women_name",
    ".text_1",
    ".text_2",
    ".poster-name",
    ".invitation__logo",
    "#thanksGroom",
    "#thanksBride",
    "#coverGroom",
    "#coverBride",
    "#posterGroom",
    "#posterBride"
].join(", ");

const NICKNAME_CSS_SELECTORS = [
    "body .man_name",
    "body .women_name",
    "body .text_1",
    "body .text_2",
    "body .poster-name",
    "body .invitation__logo",
    "body #thanksGroom",
    "body #thanksBride",
    "body #coverGroom",
    "body #coverBride",
    "body #posterGroom",
    "body #posterBride",
    "body .cover .cover__footer .man_name",
    "body .cover .cover__footer .women_name",
    "body .cover.block-skin-concept-1 .cover__footer .man_name",
    "body .cover.block-skin-concept-1 .cover__footer .women_name",
    "body .cover.block-skin-concept-2 .cover__footer .man_name",
    "body .cover.block-skin-concept-2 .cover__footer .women_name",
    "body .cover.block-skin-concept-3 .cover__footer .man_name",
    "body .cover.block-skin-concept-3 .cover__footer .women_name",
    "body .cover.block-skin-concept-4 .cover__footer .man_name",
    "body .cover.block-skin-concept-4 .cover__footer .women_name",
    "body .couple .text_1",
    "body .couple .text_2"
].join(",\n");

function resolveStacks(bodyId, nicknameId) {
    const bodyStack = BODY_FONT_STACKS[bodyId] || BODY_FONT_STACKS.quicksand;
    const nickStack = NICKNAME_FONT_STACKS[nicknameId] || NICKNAME_FONT_STACKS["great-vibes"];
    return { bodyStack, nickStack };
}

/** Inline style on each name node — highest priority, survives skin CSS */
function applyInlineNicknameFont(nickStack) {
    document.querySelectorAll(NICKNAME_NODE_SELECTOR).forEach(el => {
        el.style.setProperty("font-family", nickStack, "important");
    });
}

/**
 * Inject/replace final stylesheet + inline styles so nickname pick always wins.
 */
export function injectThemeFontStyles(bodyId, nicknameId) {
    const { bodyStack, nickStack } = resolveStacks(bodyId, nicknameId);

    let el = document.getElementById(STYLE_ID);
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }

    el.textContent = `
/* theme fonts — ${bodyId} / ${nicknameId} */
body {
  --font-body: ${bodyStack};
  --font-heading: ${bodyStack};
  --font-nickname: ${nickStack};
  font-family: ${bodyStack};
}
${NICKNAME_CSS_SELECTORS} {
  font-family: ${nickStack} !important;
}
`.trim();

    applyInlineNicknameFont(nickStack);

    // Preload active nickname face so first paint is correct
    const family = nickStack.split(",")[0].replace(/["']/g, "").trim();
    if (family && document.fonts?.load) {
        document.fonts.load(`48px "${family}"`).catch(() => {});
    }
}
