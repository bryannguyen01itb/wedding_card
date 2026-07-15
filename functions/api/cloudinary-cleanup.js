/**
 * Cloudflare Pages Function — xóa ảnh Cloudinary khi admin xóa thiệp.
 *
 * Env (Pages → Settings → Environment variables):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *   CLEANUP_KEY          (shared secret, admin gửi header X-Cleanup-Key)
 *
 * Local python server: endpoint không có → admin delete vẫn xóa Firestore.
 */
async function sha1Hex(message) {
    const data = new TextEncoder().encode(message);
    const hash = await crypto.subtle.digest("SHA-1", data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function destroyCloudinaryAsset(publicId, env) {
    const cloud = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloud || !apiKey || !apiSecret) {
        return { publicId, ok: false, error: "missing_env" };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    // signature: public_id=...&timestamp=...{api_secret}
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = await sha1Hex(toSign);

    const body = new URLSearchParams({
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature
    });

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/image/destroy`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
        }
    );

    const data = await response.json().catch(() => ({}));
    return {
        publicId,
        ok: response.ok && (data.result === "ok" || data.result === "not found"),
        result: data.result || null,
        status: response.status
    };
}

export async function onRequestPost(context) {
    const { request, env } = context;

    const cleanupKey = env.CLEANUP_KEY || "";
    if (cleanupKey) {
        const headerKey = request.headers.get("X-Cleanup-Key") || "";
        if (headerKey !== cleanupKey) {
            return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
    } else if (!env.CLOUDINARY_API_SECRET) {
        return new Response(JSON.stringify({
            ok: false,
            error: "cleanup_not_configured",
            hint: "Set CLOUDINARY_* and CLEANUP_KEY on Cloudflare Pages"
        }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
        });
    }

    let payload = {};
    try {
        payload = await request.json();
    } catch (_) {
        return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    const publicIds = Array.isArray(payload.publicIds)
        ? payload.publicIds.map(id => String(id || "").trim()).filter(Boolean).slice(0, 80)
        : [];

    if (!publicIds.length) {
        return new Response(JSON.stringify({ ok: true, deleted: 0 }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    const results = [];
    for (const publicId of publicIds) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await destroyCloudinaryAsset(publicId, env));
    }

    const deleted = results.filter(item => item.ok).length;
    return new Response(JSON.stringify({ ok: true, deleted, results }), {
        headers: { "Content-Type": "application/json" }
    });
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Cleanup-Key, Authorization"
        }
    });
}
