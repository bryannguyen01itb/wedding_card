const FIREBASE_PROJECT_ID = "wedding-invitation-31e4d";
const FIREBASE_API_KEY = "AIzaSyCwFkIVUn-1AMjwA8eK1eVISfUr5NIhmz0";
const WEDDING_COLLECTION = "weddings";

const FALLBACK_META = {
    groomNickname: "CHÚ RỂ",
    brideNickname: "CÔ DÂU",
    previewImage: "img/preview.jpeg",
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

        if (!response.ok) return { notFound: true };

        const document = await response.json();
        const data = decodeFirestoreFields(document.fields || {});

        return {
            groomNickname: data.groom?.nickname || FALLBACK_META.groomNickname,
            brideNickname: data.bride?.nickname || FALLBACK_META.brideNickname,
            previewImage: data.preview?.image || data.poster?.image || FALLBACK_META.previewImage,
            description: FALLBACK_META.description
        };
    } catch (_error) {
        return { notFound: true };
    }
}

function toAbsoluteUrl(path, requestUrl) {
    const value = String(path || "").trim();
    if (!value) return new URL(FALLBACK_META.previewImage, requestUrl).href;

    try {
        return new URL(value, requestUrl).href;
    } catch (_error) {
        return new URL(FALLBACK_META.previewImage, requestUrl).href;
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


function createNotFoundHtml() {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Không tìm thấy thiệp cưới</title>
    <meta name="robots" content="noindex">
    <meta property="og:title" content="Không tìm thấy thiệp cưới">
    <meta property="og:description" content="Đường dẫn thiệp này không còn tồn tại hoặc weddingId đã được đổi.">
</head>
<body style="margin:0;font-family:Arial,sans-serif;background:#fff7f7;color:#333;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px;box-sizing:border-box;">
    <main style="max-width:420px;background:#fff;border-radius:18px;padding:32px 24px;box-shadow:0 18px 45px rgba(0,0,0,.08);">
        <h1 style="font-size:24px;margin:0 0 12px;">Không tìm thấy thiệp cưới</h1>
        <p style="font-size:16px;line-height:1.6;margin:0;color:#666;">Đường dẫn thiệp này không còn tồn tại hoặc weddingId đã được đổi.</p>
    </main>
</body>
</html>`;
}

function injectPreviewMeta(html, meta, requestUrl) {
    const title = `THƯ MỜI CƯỚI ${meta.groomNickname} & ${meta.brideNickname}`;
    const imageUrl = toAbsoluteUrl(meta.previewImage, requestUrl);
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
    const headers = new Headers(response.headers);
    headers.set("content-type", "text/html; charset=UTF-8");
    headers.set("cache-control", "public, max-age=60");

    if (weddingId && meta.notFound) {
        return new Response(createNotFoundHtml(), {
            status: 404,
            statusText: "Not Found",
            headers
        });
    }

    const html = await response.text();
    const body = injectPreviewMeta(html, meta, context.request.url);

    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}
