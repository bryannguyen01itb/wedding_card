/**
 * Local Cloudinary cleanup API — thay cho Cloudflare Pages Function khi dev.
 *
 * Chạy song song với python http.server:
 *   export CLOUDINARY_CLOUD_NAME=dndcuen0
 *   export CLOUDINARY_API_KEY=...
 *   export CLOUDINARY_API_SECRET=...
 *   npm run dev:cloudinary
 *
 * Lắng nghe: http://127.0.0.1:8788/api/cloudinary-cleanup
 * Builder trên localhost sẽ tự gọi endpoint này.
 */
import { createHash } from "crypto";
import http from "http";

const PORT = Number(process.env.CLOUDINARY_CLEANUP_PORT || 8788);
const cloud = process.env.CLOUDINARY_CLOUD_NAME || "dndcuen0";
const apiKey = process.env.CLOUDINARY_API_KEY || "";
const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

if (!apiKey || !apiSecret) {
    console.error(`
[local-cloudinary-api] Thiếu env:
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET

Ví dụ:
  export CLOUDINARY_CLOUD_NAME=dndcuen0
  export CLOUDINARY_API_KEY=xxxx
  export CLOUDINARY_API_SECRET=yyyy
  npm run dev:cloudinary
`);
    process.exit(1);
}

function sha1Hex(message) {
    return createHash("sha1").update(message).digest("hex");
}

async function destroyCloudinaryAsset(publicId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = sha1Hex(toSign);
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
        status: response.status,
        error: data.error?.message || null
    };
}

function sendJson(res, status, payload, origin = "*") {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Cleanup-Key, Authorization",
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || "*";
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Cleanup-Key, Authorization"
        });
        res.end();
        return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        sendJson(res, 200, {
            ok: true,
            service: "local-cloudinary-api",
            cloud,
            endpoint: "/api/cloudinary-cleanup"
        }, origin);
        return;
    }

    if (req.method === "POST" && url.pathname === "/api/cloudinary-cleanup") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let payload = {};
        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch (_) {
            sendJson(res, 400, { ok: false, error: "invalid_json" }, origin);
            return;
        }

        const publicIds = Array.isArray(payload.publicIds)
            ? payload.publicIds.map(id => String(id || "").trim()).filter(Boolean).slice(0, 80)
            : [];

        if (!publicIds.length) {
            sendJson(res, 200, { ok: true, deleted: 0 }, origin);
            return;
        }

        const results = [];
        for (const publicId of publicIds) {
            // eslint-disable-next-line no-await-in-loop
            const result = await destroyCloudinaryAsset(publicId);
            results.push(result);
            console.log(
                result.ok ? "✓" : "✗",
                publicId,
                result.result || result.error || result.status
            );
        }

        const deleted = results.filter(item => item.ok).length;
        sendJson(res, 200, { ok: true, deleted, results }, origin);
        return;
    }

    sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname }, origin);
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[local-cloudinary-api] http://127.0.0.1:${PORT}`);
    console.log(`[local-cloudinary-api] cloud=${cloud}`);
    console.log(`[local-cloudinary-api] POST /api/cloudinary-cleanup`);
    console.log(`[local-cloudinary-api] Builder local sẽ gọi endpoint này khi xóa/đổi ảnh.`);
});
