const FIREBASE_PROJECT_ID = "wedding-invitation-31e4d";
const FIREBASE_API_KEY = "AIzaSyCwFkIVUn-1AMjwA8eK1eVISfUr5NIhmz0";
const WEDDING_COLLECTION = "weddings";

const FALLBACK_META = {
    groomNickname: "CHÚ RỂ",
    brideNickname: "CÔ DÂU",
    posterImage: "img/anh_1.jpg",
    description: "Trân trọng kính mời bạn đến chung vui cùng gia đình chúng tôi."
};

function decodeFirestoreValue(value) {
    if (!value) return undefined;
    if ("stringValue" in value) return value.stringValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("timestampValue" in value) return value.timestampValue;
    if ("nullValue" in value) return null;

    if ("arrayValue" in value) {
        return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }

    if ("mapValue" in value) {
        return decodeFirestoreFields(value.mapValue.fields || {});
    }

    return undefined;
}

function decodeFirestoreFields(fields = {}) {
    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
    );
}

async function getWeddingMeta(weddingId) {
    if (!weddingId) return FALLBACK_META;

    const encodedId = encodeURIComponent(weddingId);
    const endpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${WEDDING_COLLECTION}/${encodedId}?key=${FIREBASE_API_KEY}`;

    try {
        const response = await fetch(endpoint, {
            headers: { "Accept": "application/json" },
            cf: { cacheTtl: 60, cacheEverything: true }
        });

        if (!response.ok) return FALLBACK_META;

        const document = await response.json();
        const data = decodeFirestoreFields(document.fields || {});

        return {
            groomNickname: data.groom?.nickname || FALLBACK_META.groomNickname,
            brideNickname: data.bride?.nickname || FALLBACK_META.brideNickname,
            posterImage: data.poster?.image || FALLBACK_META.posterImage,
            description: FALLBACK_META.description
        };
    } catch (_error) {
        return FALLBACK_META;
    }
}

function toAbsoluteUrl(path, requestUrl) {
    const value = String(path || "").trim();
    if (!value) return new URL(FALLBACK_META.posterImage, requestUrl).href;

    try {
        return new URL(value, requestUrl).href;
    } catch (_error) {
        return new URL(FALLBACK_META.posterImage, requestUrl).href;
    }
}

function escapeHtmlAttribute(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function upsertMeta(html, selector, content) {
    const escapedContent = escapeHtmlAttribute(content);
    const isProperty = selector.startsWith("og:");
    const attr = isProperty ? "property" : "name";
    const pattern = new RegExp(`<meta\\s+${attr}=["']${selector}["'][^>]*>`, "i");
    const tag = `<meta ${attr}="${selector}" content="${escapedContent}">`;

    if (pattern.test(html)) {
        return html.replace(pattern, tag);
    }

    return html.replace("</head>", `    ${tag}\n</head>`);
}

function injectPreviewMeta(html, meta, requestUrl) {
    const title = `THƯ MỜI CƯỚI ${meta.groomNickname} & ${meta.brideNickname}`;
    const imageUrl = toAbsoluteUrl(meta.posterImage, requestUrl);
    const pageUrl = new URL(requestUrl).href;

    let output = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtmlAttribute(title)}</title>`);

    output = upsertMeta(output, "description", meta.description);
    output = upsertMeta(output, "og:type", "website");
    output = upsertMeta(output, "og:title", title);
    output = upsertMeta(output, "og:description", meta.description);
    output = upsertMeta(output, "og:image", imageUrl);
    output = upsertMeta(output, "og:image:secure_url", imageUrl);
    output = upsertMeta(output, "og:image:width", "1200");
    output = upsertMeta(output, "og:image:height", "630");
    output = upsertMeta(output, "og:url", pageUrl);
    output = upsertMeta(output, "twitter:card", "summary_large_image");
    output = upsertMeta(output, "twitter:title", title);
    output = upsertMeta(output, "twitter:description", meta.description);
    output = upsertMeta(output, "twitter:image", imageUrl);

    return output;
}

export async function onRequest(context) {
    const response = await context.next();
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
        return response;
    }

    const url = new URL(context.request.url);
    const weddingId = (url.searchParams.get("wedding") || "").trim();
    const meta = await getWeddingMeta(weddingId);
    const html = await response.text();
    const body = injectPreviewMeta(html, meta, context.request.url);
    const headers = new Headers(response.headers);

    headers.set("content-type", "text/html; charset=UTF-8");
    headers.set("cache-control", "public, max-age=60");

    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}
