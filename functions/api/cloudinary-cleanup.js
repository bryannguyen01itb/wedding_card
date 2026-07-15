/**
 * Cloudflare Pages Function — xóa ảnh Cloudinary khi admin xóa thiệp.
 *
 * Env (Pages → Settings → Variables and secrets):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Admin KHÔNG cần gõ key thủ công — chỉ cần 3 biến Cloudinary trên CF.
 * Bảo vệ nhẹ: chỉ nhận POST từ origin cùng site (bryaninvite / pages.dev).
 *
 * Local python server: endpoint không có → xóa Firestore vẫn OK.
 */
async function sha1Hex(message) {
    const data = new TextEncoder().encode(message);
    const hash = await crypto.subtle.digest("SHA-1", data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function isAllowedOrigin(request) {
    const origin = request.headers.get("Origin") || "";
    const referer = request.headers.get("Referer") || "";
    const host = request.headers.get("Host") || "";
    const hay = `${origin} ${referer} ${host}`.toLowerCase();
    // Site production + preview pages.dev
    if (hay.includes("bryaninvite.homes")) return true;
    if (hay.includes("wedding-card") && hay.includes("pages.dev")) return true;
    if (hay.includes("localhost") || hay.includes("127.0.0.1")) return true;
    // Không có Origin (same-origin một số trình duyệt) — cho qua nếu Host là pages
    if (!origin && (host.includes("pages.dev") || host.includes("bryaninvite.homes"))) return true;
    return false;
}

async function destroyCloudinaryAsset(publicId, env) {
    const cloud = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloud || !apiKey || !apiSecret) {
        return { publicId, ok: false, error: "missing_env" };
    }

    const timestamp = Math.floor(Date.now() / 1000);
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

    if (!env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_CLOUD_NAME) {
        return new Response(JSON.stringify({
            ok: false,
            error: "cleanup_not_configured",
            hint: "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET on Pages"
        }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Optional: nếu vẫn set CLEANUP_KEY thì chấp nhận header (tương thích cũ)
    // Không bắt buộc — admin không cần gõ Console nữa
    const cleanupKey = env.CLEANUP_KEY || "";
    if (cleanupKey) {
        const headerKey = request.headers.get("X-Cleanup-Key") || "";
        if (headerKey && headerKey !== cleanupKey) {
            return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
        // Không gửi header: vẫn cho qua nếu origin hợp lệ (bỏ bắt buộc gõ key)
    }

    if (!isAllowedOrigin(request)) {
        return new Response(JSON.stringify({ ok: false, error: "forbidden_origin" }), {
            status: 403,
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
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": request.headers.get("Origin") || "*"
        }
    });
}

export async function onRequestOptions(context) {
    const origin = context.request.headers.get("Origin") || "*";
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Cleanup-Key, Authorization"
        }
    });
}
