const SITE_ROOT = new URL("../", import.meta.url);
const FETCH_TIMEOUT_MS = 45_000;

function safeJSON(value) {
    return (JSON.stringify(value) ?? "null").replace(/</g, "\\u003c");
}

async function fetchResource(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Read the body within the timeout too (large music files).
        return { blob: await response.blob(), url: response.url || String(url) };
    } catch (error) {
        throw new Error(`Không tải được tài nguyên: ${url}. ${error.name === "AbortError" ? "Hết thời gian chờ." : error.message}`);
    } finally {
        clearTimeout(timer);
    }
}

function blobAsDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Không đọc được tài nguyên để đóng gói."));
        reader.readAsDataURL(blob);
    });
}

async function normalizeAssetBlob(blob, url) {
    if (!blob.size) throw new Error(`Tài nguyên ảnh/nhạc/font rỗng: ${url}`);
    // Font endpoints can label binary responses as text/html for fetch requests.
    // Recognize the bytes before rejecting the advertised MIME type, and use a
    // font MIME type in the embedded data URL so offline browsers can load it.
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const signature = String.fromCharCode(...header);
    let fontType = {
        wOFF: "font/woff",
        wOF2: "font/woff2",
        OTTO: "font/otf",
        true: "font/ttf",
        ttcf: "font/collection"
    }[signature];
    if (header.length === 4 && header[0] === 0 && header[1] === 1 && header[2] === 0 && header[3] === 0) {
        fontType = "font/ttf";
    }
    if (fontType) return new Blob([blob], { type: fontType });
    if (/^(text\/html|application\/json)\b/i.test(blob.type)) {
        throw new Error(`Tài nguyên ảnh/nhạc/font không hợp lệ (${blob.type}): ${url}`);
    }
    return blob;
}

function createAssetStore(onProgress) {
    const cache = new Map();
    let completed = 0;
    return async (value, base) => {
        if (!value || value.startsWith("data:") || value.startsWith("#")) return value;
        // Some section CSS uses ../../img from css/blocks/<section>/.
        // Those project fallbacks belong to the site's img/ root.
        const projectAsset = value.match(/^(?:\.\.?\/)*(img|music)\/(.+)$/);
        const url = projectAsset
            ? new URL(`${projectAsset[1]}/${projectAsset[2]}`, SITE_ROOT).href
            : new URL(value, base).href;
        if (!/^https?:/.test(url)) throw new Error(`Tài nguyên không được hỗ trợ: ${url}`);
        if (!cache.has(url)) {
            cache.set(url, (async () => {
                const { blob } = await fetchResource(url);
                const data = await blobAsDataURL(await normalizeAssetBlob(blob, url));
                completed++;
                onProgress(`Đã đóng gói ${completed} tài nguyên…`);
                return data;
            })());
        }
        return cache.get(url);
    };
}

async function replaceAsync(source, pattern, replace) {
    let result = "";
    let end = 0;
    // Sequential replacements bound memory and concurrent media downloads.
    for (const match of source.matchAll(pattern)) {
        result += source.slice(end, match.index) + await replace(match);
        end = match.index + match[0].length;
    }
    return result + source.slice(end);
}

async function inlineCSS(css, base, asset, usedFonts, ancestors = []) {
    // Ignore comments, including documentation mentioning @import.
    css = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // Google Fonts includes many families; keep every subset/weight of fonts used.
    css = css.replace(/@font-face\s*\{[^}]*\}/gi, rule => {
        const family = rule.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.replace(/["']/g, "").trim().toLowerCase();
        return !family || usedFonts.has(family) ? rule : "";
    });
    css = await replaceAsync(css, /@import\s+(?:url\(\s*)?(["'])(.*?)\1\s*\)?\s*([^;]*);/gi, async match => {
        const url = new URL(match[2], base).href;
        if (ancestors.includes(url)) throw new Error("CSS có vòng lặp @import.");
        const resource = await fetchResource(url);
        const nested = await inlineCSS(await resource.blob.text(), resource.url, asset, usedFonts, [...ancestors, url]);
        return match[3].trim() ? `@media ${match[3]} {${nested}}` : nested;
    });
    if (/@import\b/i.test(css)) throw new Error("Có CSS @import chưa được hỗ trợ; chưa xuất bản thiệp.");
    return replaceAsync(css, /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, async match => {
        const value = (match[1] ?? match[2] ?? match[3]).trim();
        const data = await asset(value, base);
        return `url("${data.replace(/"/g, "%22")}")`;
    });
}

async function createRenderFrame(template, input) {
    const parsed = new DOMParser().parseFromString(template, "text/html");
    parsed.querySelectorAll("script, base, link[rel=preconnect]").forEach(el => el.remove());
    const base = parsed.createElement("base");
    base.href = SITE_ROOT.href;
    parsed.head.prepend(base);
    // External font CSS is packaged later; do not wait on it to render the frame.
    parsed.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        if (new URL(link.getAttribute("href"), SITE_ROOT).origin !== SITE_ROOT.origin) {
            link.rel = "keepsake-stylesheet";
        }
    });
    const frame = document.createElement("iframe");
    frame.title = "Chuẩn bị thiệp kỷ niệm";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:480px;height:900px;border:0;pointer-events:none;";
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Không dựng được thiệp kỷ niệm. Hãy tải lại admin rồi thử lại.")), 30_000);
            const finish = error => {
                clearTimeout(timer);
                error ? reject(error) : resolve();
            };
            frame.onload = () => {
                const win = frame.contentWindow;
                win.__keepsakeInput = input;
                win.__keepsakeDone = finish;
                const script = win.document.createElement("script");
                script.type = "module";
                script.textContent = `import(${safeJSON(new URL("keepsake-frame.js", import.meta.url).href)})
                    .then(module => { module.renderKeepsake(window.__keepsakeInput); window.__keepsakeDone(); })
                    .catch(error => window.__keepsakeDone(error));`;
                win.document.body.appendChild(script);
            };
            frame.srcdoc = `<!doctype html>${parsed.documentElement.outerHTML}`;
            document.body.appendChild(frame);
        });
        return frame;
    } catch (error) {
        frame.remove();
        throw error;
    }
}

/** Embed the existing interaction modules as data URLs, preserving module scopes. */
async function packagePlayback(config) {
    const imports = {};
    const sources = new Map();
    const key = url => `keepsake:${new URL(url).pathname}`;
    const moduleURL = path => new URL(path, SITE_ROOT).href;
    // The saved DOM already contains all content. Never embed edit/access tokens,
    // guest lists, payment information, or remote fallback URLs in playback modules.
    sources.set(moduleURL("js/config.js"), `export const wedding = {
        date: ${safeJSON(config.date)},
        music: document.getElementById("bgMusic")?.getAttribute("src") || ""
    };`);
    sources.set(moduleURL("js/utils/mediaFallback.js"), `
        export function localMusicFallback() { return ""; }
        export function shouldTryRemoteFallback() { return false; }
        export function setImageWithFallback(img, src) { if (img) img.src = src; }
    `);
    const visited = new Set();
    const importPattern = /^import\s+(?:(?:\{[^}]*\}|[\w*$,\s]+)\s+from\s+)?(["'])([^"']+)\1\s*;/gm;
    async function visit(url) {
        if (visited.has(url)) return;
        visited.add(url);
        const source = sources.has(url) ? sources.get(url) : await (await fetchResource(url)).blob.text();
        const dependencies = [];
        const rewritten = source.replace(importPattern, (statement, quote, specifier) => {
            if (!specifier.startsWith(".")) throw new Error(`Module chưa hỗ trợ: ${specifier}`);
            const dependency = new URL(specifier, url).href;
            dependencies.push(dependency);
            return statement.replace(`${quote}${specifier}${quote}`, JSON.stringify(key(dependency)));
        });
        imports[key(url)] = await blobAsDataURL(new Blob([rewritten], { type: "text/javascript" }));
        for (const dependency of dependencies) await visit(dependency);
    }
    const entry = moduleURL("admin/keepsake-playback.js");
    await visit(entry);
    return { imports, entry: key(entry) };
}

function sanitizeDocument(doc) {
    doc.querySelectorAll("script, base, iframe, object, embed, link, meta[property^='og:'], meta[name^='twitter:']").forEach(el => el.remove());
    for (const element of doc.querySelectorAll("*")) {
        for (const attr of [...element.attributes]) {
            if (/^on/i.test(attr.name) || attr.name === "srcdoc" || attr.name === "srcset") {
                element.removeAttribute(attr.name);
            }
        }
    }
    for (const link of doc.querySelectorAll("a[href]")) {
        const href = link.getAttribute("href");
        if (/^(https?:|mailto:|tel:|#)/i.test(href)) {
            link.rel = "noopener noreferrer";
        } else link.removeAttribute("href");
    }
}

/** Return one portable HTML file, or fail rather than silently omit a resource. */
export async function buildKeepsakeHTML({ config, wishes = [], onProgress = () => {} }) {
    onProgress("Đang dựng thiệp từ dữ liệu đã lưu…");
    const template = await (await fetchResource(new URL("index.html", SITE_ROOT))).blob.text();
    const exportedAt = new Date().toLocaleString("vi-VN");
    const frame = await createRenderFrame(template, { config, wishes, exportedAt });
    try {
        const sourceDoc = frame.contentDocument;
        const fonts = new Set(["bootstrap-icons"]);
        for (const el of sourceDoc.querySelectorAll("*")) {
            const family = frame.contentWindow.getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
            fonts.add(family);
        }
        // Clone so late image-error/fallback handlers cannot change the snapshot.
        const doc = new DOMParser().parseFromString(sourceDoc.documentElement.outerHTML, "text/html");
        const asset = createAssetStore(onProgress);
        onProgress("Đang đóng gói giao diện, ảnh, nhạc và font…");
        for (const link of doc.querySelectorAll('link[rel="stylesheet"], link[rel="keepsake-stylesheet"]')) {
            const url = new URL(link.getAttribute("href"), SITE_ROOT).href;
            const resource = await fetchResource(url);
            const style = doc.createElement("style");
            style.textContent = await inlineCSS(await resource.blob.text(), resource.url, asset, fonts, [url]);
            link.replaceWith(style);
        }
        for (const style of doc.querySelectorAll("style")) {
            style.textContent = await inlineCSS(style.textContent, SITE_ROOT, asset, fonts);
        }
        for (const el of doc.querySelectorAll("[style]")) {
            el.setAttribute("style", await inlineCSS(el.getAttribute("style"), SITE_ROOT, asset, fonts));
        }
        for (const el of doc.querySelectorAll("img[src], audio[src], video[src], source[src], video[poster], input[type=image][src], svg image")) {
            for (const attr of ["src", "poster", "href", "xlink:href"]) {
                if (el.hasAttribute(attr)) {
                    const value = el.getAttribute(attr);
                    if (value) el.setAttribute(attr, await asset(value, SITE_ROOT));
                    else el.removeAttribute(attr);
                }
            }
            el.removeAttribute("loading");
            el.removeAttribute("crossorigin");
        }
        onProgress("Đang hoàn tất file thiệp kỷ niệm…");
        const playback = await packagePlayback(config);
        sanitizeDocument(doc);
        // Runtime is allowed to use embedded resources only, even when hosted later.
        const policy = doc.createElement("meta");
        policy.httpEquiv = "Content-Security-Policy";
        policy.content = "default-src 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline' data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
        doc.head.prepend(policy);
        const importMap = doc.createElement("script");
        importMap.type = "importmap";
        importMap.textContent = safeJSON({ imports: playback.imports });
        doc.body.appendChild(importMap);
        const script = doc.createElement("script");
        script.type = "module";
        script.textContent = `import ${safeJSON(playback.entry)};`;
        doc.body.appendChild(script);
        // Prevent user content/CSS from terminating inline raw-text elements.
        doc.querySelectorAll("style").forEach(style => {
            style.textContent = style.textContent.replace(/<\/style/gi, "<\\/style");
        });
        return { html: `<!doctype html>\n${doc.documentElement.outerHTML}`, exportedAt };
    } finally {
        frame.remove();
    }
}

export function downloadKeepsake(html, weddingId) {
    const filename = String(weddingId || "thiep-cuoi").replace(/[^\p{L}\p{N}_-]/gu, "-");
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-ky-niem.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
