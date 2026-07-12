import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const staticDir = path.join(__dirname, "admin");
const DEFAULT_PRIMARY = "#c9974f";
const DEFAULT_CONCEPT = "concept-4";
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.join(__dirname, "serviceAccountKey.json");
const port = Number(process.env.PORT || 5050);

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function mergeConfig(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override === undefined ? base : override;
    }

    const result = { ...base };
    Object.keys(override).forEach(key => {
        result[key] = mergeConfig(base[key], override[key]);
    });
    return result;
}

function applyAdminDefaults(config) {
    const nextConfig = mergeConfig(config, {
        theme: {
            concept: DEFAULT_CONCEPT,
            primaryColor: DEFAULT_PRIMARY
        }
    });
    return nextConfig;
}

function removeUndefined(value) {
    if (Array.isArray(value)) return value.map(removeUndefined);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, item]) => item !== undefined)
                .map(([key, item]) => [key, removeUndefined(item)])
        );
    }
    return value;
}

async function loadFallbackWedding() {
    const configUrl = pathToFileURL(path.join(rootDir, "js", "config.js")).href + `?t=${Date.now()}`;
    const module = await import(configUrl);
    return module.wedding;
}

async function getDb() {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, "utf8"));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    return admin.firestore();
}

async function readRequestBody(request) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    return body ? JSON.parse(body) : {};
}

function sendJson(response, status, data) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(data));
}

function sendText(response, status, message) {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(message);
}

async function serveStatic(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const servesSite = requestUrl.pathname.startsWith("/site/");
    const baseDir = servesSite ? rootDir : staticDir;
    const cleanPathname = servesSite
        ? requestUrl.pathname.replace(/^\/site/, "")
        : requestUrl.pathname;
    const pathname = cleanPathname === "/" ? "/index.html" : cleanPathname;
    const filePath = path.normalize(path.join(baseDir, pathname));

    if (!filePath.startsWith(baseDir)) {
        sendText(response, 403, "Forbidden");
        return;
    }

    try {
        const file = await fs.readFile(filePath);
        const ext = path.extname(filePath);
        const contentType = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8"
        }[ext] || "application/octet-stream";

        response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
        response.end(file);
    } catch (_error) {
        sendText(response, 404, "Not found");
    }
}

async function handleApi(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const db = await getDb();

    if (request.method === "GET" && requestUrl.pathname === "/api/config") {
        const weddingId = requestUrl.searchParams.get("id")?.trim() || "";
        const fallbackWedding = await loadFallbackWedding();

        if (!weddingId) {
            sendJson(response, 200, { config: applyAdminDefaults(fallbackWedding), exists: false });
            return;
        }

        const doc = await db.collection("weddings").doc(weddingId).get();
        const config = doc.exists
            ? mergeConfig(fallbackWedding, { ...doc.data(), weddingId: doc.id })
            : mergeConfig(applyAdminDefaults(fallbackWedding), { weddingId });

        sendJson(response, 200, { config, exists: doc.exists });
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/config") {
        const payload = await readRequestBody(request);
        const config = removeUndefined(payload.config || {});

        if (!config.weddingId) {
            sendJson(response, 400, { error: "Thiếu weddingId." });
            return;
        }

        await db.collection("weddings").doc(config.weddingId).set(config, { merge: true });
        sendJson(response, 200, { ok: true, weddingId: config.weddingId });
        return;
    }

    sendJson(response, 404, { error: "API không tồn tại." });
}

const server = http.createServer(async (request, response) => {
    try {
        if (request.url.startsWith("/api/")) {
            await handleApi(request, response);
            return;
        }
        await serveStatic(request, response);
    } catch (error) {
        console.error(error);
        sendJson(response, 500, { error: error.message || "Server error" });
    }
});

server.listen(port, () => {
    console.log(`Wedding admin đang chạy: http://localhost:${port}`);
});
