/**
 * Cloudflare Pages Function — SePay webhook: CK đúng mã + số tiền → mở khóa thiệp.
 *
 * Endpoint: POST /api/sepay-webhook
 * Response success: HTTP 200 + {"success": true}  (SePay contract)
 *
 * Env (Pages → Settings → Variables and secrets) — tất cả free tier:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — JSON service account (Firebase Console → Project settings → Service accounts)
 *   SEPAY_API_KEY                  — API Key khi tạo webhook trên SePay (Authorization: Apikey …)
 *   SEPAY_WEBHOOK_SECRET           — (tuỳ chọn) HMAC-SHA256 secret nếu chọn auth HMAC
 *   SEPAY_ACCOUNT_NUMBER           — (tuỳ chọn) chỉ nhận GD vào đúng STK
 *
 * Free path: SePay gói FREE (50 GD/tháng) + CF Pages free + Firebase free.
 * Local python server: endpoint không chạy — dùng admin unlock tay / deploy CF để test thật.
 *
 * Docs: SEPAY.md
 */

const ORDER_CODE_RE = /\bWC[A-Z2-9]{6,12}\b/;

function jsonResponse(body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...extraHeaders
        }
    });
}

/** SePay success contract */
function sepayOk(extra = {}) {
    return jsonResponse({ success: true, ...extra });
}

function sepayFail(message, status = 401, extra = {}) {
    return jsonResponse({ success: false, message, ...extra }, status);
}

function normalizeOrderCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return /^WC[A-Z2-9]{6,12}$/.test(code) ? code : "";
}

function extractOrderCode(payload = {}) {
    const fromCode = normalizeOrderCode(payload.code);
    if (fromCode) return fromCode;
    const blob = [payload.code, payload.content, payload.description, payload.subAccount]
        .map(part => String(part || ""))
        .join(" ")
        .toUpperCase();
    const match = blob.match(ORDER_CODE_RE);
    return match ? normalizeOrderCode(match[0]) : "";
}

function base64UrlEncode(bytes) {
    let binary = "";
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(text) {
    return base64UrlEncode(new TextEncoder().encode(text));
}

function pemToArrayBuffer(pem) {
    const b64 = String(pem || "")
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s+/g, "");
    const raw = atob(b64);
    const buf = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
    return buf.buffer;
}

async function signJwtRs256(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
        scope: "https://www.googleapis.com/auth/datastore"
    };
    const unsigned = `${textToBase64Url(JSON.stringify(header))}.${textToBase64Url(JSON.stringify(claim))}`;
    const key = await crypto.subtle.importKey(
        "pkcs8",
        pemToArrayBuffer(serviceAccount.private_key),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(unsigned)
    );
    return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getFirestoreAccessToken(serviceAccount) {
    const assertion = await signJwtRs256(serviceAccount);
    const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
        throw new Error(`oauth_token_failed: ${data.error || response.status}`);
    }
    return data.access_token;
}

function parseServiceAccount(env) {
    const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT || "";
    if (!raw) return null;
    try {
        const sa = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!sa?.client_email || !sa?.private_key || !sa?.project_id) return null;
        // JSON env đôi khi escape \\n
        if (typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
            sa.private_key = sa.private_key.replace(/\\n/g, "\n");
        }
        return sa;
    } catch (_) {
        return null;
    }
}

function firestoreValueToJs(value) {
    if (!value || typeof value !== "object") return null;
    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("booleanValue" in value) return Boolean(value.booleanValue);
    if ("nullValue" in value) return null;
    if ("timestampValue" in value) return value.timestampValue;
    if ("mapValue" in value) {
        const fields = value.mapValue.fields || {};
        const out = {};
        Object.keys(fields).forEach(key => {
            out[key] = firestoreValueToJs(fields[key]);
        });
        return out;
    }
    if ("arrayValue" in value) {
        return (value.arrayValue.values || []).map(firestoreValueToJs);
    }
    return null;
}

function jsToFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") {
        if (Number.isInteger(value)) return { integerValue: String(value) };
        return { doubleValue: value };
    }
    if (value && typeof value === "object" && value.__serverTimestamp) {
        return { timestampValue: new Date().toISOString() };
    }
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map(jsToFirestoreValue) } };
    }
    if (typeof value === "object") {
        const fields = {};
        Object.keys(value).forEach(key => {
            if (value[key] === undefined) return;
            fields[key] = jsToFirestoreValue(value[key]);
        });
        return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
}

function docFieldsToObject(fields = {}) {
    const out = {};
    Object.keys(fields).forEach(key => {
        out[key] = firestoreValueToJs(fields[key]);
    });
    return out;
}

function createFirestoreClient(serviceAccount, accessToken) {
    const projectId = serviceAccount.project_id;
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    async function request(path, options = {}) {
        const response = await fetch(`${base}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
    }

    return {
        async get(collection, docId) {
            const res = await request(`/${collection}/${encodeURIComponent(docId)}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`firestore_get_${collection}: ${res.status}`);
            return {
                id: docId,
                ...docFieldsToObject(res.data.fields || {})
            };
        },

        async patch(collection, docId, fieldsObj, fieldPaths) {
            const fields = {};
            Object.keys(fieldsObj).forEach(key => {
                if (fieldsObj[key] === undefined) return;
                fields[key] = jsToFirestoreValue(fieldsObj[key]);
            });
            const query = (fieldPaths || Object.keys(fieldsObj))
                .filter(path => fieldsObj[path.split(".")[0]] !== undefined || fieldPaths)
                .map(path => `updateMask.fieldPaths=${encodeURIComponent(path)}`)
                .join("&");
            // Nested payment.* mask
            const maskQuery = (fieldPaths || []).length
                ? fieldPaths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&")
                : Object.keys(fieldsObj).map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&");

            const res = await request(
                `/${collection}/${encodeURIComponent(docId)}?${maskQuery || query}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ fields })
                }
            );
            if (!res.ok) {
                throw new Error(`firestore_patch_${collection}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
            }
            return res.data;
        },

        async setMerge(collection, docId, fieldsObj) {
            // PATCH with updateMask = all top-level keys (merge semantics for those fields)
            return this.patch(collection, docId, fieldsObj, Object.keys(fieldsObj));
        },

        async create(collection, docId, fieldsObj) {
            const fields = {};
            Object.keys(fieldsObj).forEach(key => {
                fields[key] = jsToFirestoreValue(fieldsObj[key]);
            });
            // createDocument with documentId
            const res = await request(
                `/${collection}?documentId=${encodeURIComponent(docId)}`,
                {
                    method: "POST",
                    body: JSON.stringify({ fields })
                }
            );
            if (res.status === 409) {
                // already exists
                return { exists: true, data: res.data };
            }
            if (!res.ok) {
                throw new Error(`firestore_create_${collection}: ${res.status}`);
            }
            return { exists: false, data: res.data };
        }
    };
}

/**
 * Fallback: tra weddingId theo payment.orderCode khi thiếu orderCodes map.
 * Dùng Firestore REST runQuery (service account).
 */
async function findWeddingIdByOrderCode(fs, serviceAccount, accessToken, orderCode) {
    const code = normalizeOrderCode(orderCode);
    if (!code || !serviceAccount?.project_id || !accessToken) return "";

    const projectId = serviceAccount.project_id;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const body = {
        structuredQuery: {
            from: [{ collectionId: "weddings" }],
            where: {
                fieldFilter: {
                    field: { fieldPath: "payment.orderCode" },
                    op: "EQUAL",
                    value: { stringValue: code }
                }
            },
            limit: 1
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) {
        console.warn("[sepay-webhook] runQuery failed:", response.status, rows);
        return "";
    }
    if (!Array.isArray(rows)) return "";
    for (const row of rows) {
        const name = row?.document?.name || "";
        // .../documents/weddings/{weddingId}
        const parts = name.split("/documents/weddings/");
        if (parts[1]) {
            const id = decodeURIComponent(parts[1].split("/")[0] || "").trim();
            if (id) return id;
        }
    }
    return "";
}

async function verifySePayAuth(request, rawBody, env) {
    const apiKey = String(env.SEPAY_API_KEY || "").trim();
    const hmacSecret = String(env.SEPAY_WEBHOOK_SECRET || "").trim();

    // HMAC-SHA256 (khuyến nghị nếu đã cấu hình)
    if (hmacSecret) {
        const signature = request.headers.get("X-SePay-Signature") || "";
        const timestamp = Number(request.headers.get("X-SePay-Timestamp") || 0);
        if (!signature || !timestamp) {
            return { ok: false, reason: "missing_hmac_headers" };
        }
        if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
            return { ok: false, reason: "timestamp_expired" };
        }
        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(hmacSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
        const signed = await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(`${timestamp}.${rawBody}`)
        );
        const hex = [...new Uint8Array(signed)].map(b => b.toString(16).padStart(2, "0")).join("");
        const expected = `sha256=${hex}`;
        if (signature !== expected && signature.toLowerCase() !== expected.toLowerCase()) {
            return { ok: false, reason: "invalid_hmac" };
        }
        return { ok: true, mode: "hmac" };
    }

    // API Key (đơn giản, đủ free production)
    if (apiKey) {
        const auth = request.headers.get("Authorization") || "";
        const match = auth.match(/^Apikey\s+(.+)$/i);
        const provided = match ? match[1].trim() : "";
        // Một số client test gửi raw key
        const rawKey = !provided && auth && !auth.includes(" ") ? auth.trim() : provided;
        if (!rawKey || rawKey !== apiKey) {
            return { ok: false, reason: "invalid_api_key" };
        }
        return { ok: true, mode: "apikey" };
    }

    return { ok: false, reason: "auth_not_configured" };
}

function amountsMatch(expected, received) {
    const a = Number(expected);
    const b = Number(received);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.round(a) === Math.round(b);
}

async function unlockWedding(fs, {
    weddingId,
    orderCode,
    amount,
    txnId,
    referenceCode,
    gateway
}) {
    const wedding = await fs.get("weddings", weddingId);
    if (!wedding) {
        return { ok: false, reason: "wedding_not_found" };
    }

    const prevPayment = wedding.payment && typeof wedding.payment === "object"
        ? wedding.payment
        : {};

    if (prevPayment.unlocked === true || prevPayment.status === "paid") {
        return {
            ok: true,
            alreadyPaid: true,
            accessToken: prevPayment.accessToken || "",
            weddingId
        };
    }

    const expectedAmount = prevPayment.amount ?? null;
    if (expectedAmount !== null && expectedAmount !== "" && !amountsMatch(expectedAmount, amount)) {
        return {
            ok: false,
            reason: "amount_mismatch",
            expected: expectedAmount,
            received: amount
        };
    }

    // Cross-check orderCode if present on wedding
    const weddingOrder = normalizeOrderCode(prevPayment.orderCode);
    if (weddingOrder && weddingOrder !== orderCode) {
        return { ok: false, reason: "order_code_mismatch" };
    }

    const plan = prevPayment.plan === "multi" || wedding.plan === "multi" ? "multi" : "single";
    const accessToken = String(prevPayment.accessToken || "").trim();
    const nowIso = new Date().toISOString();

    const payment = {
        ...prevPayment,
        status: "paid",
        unlocked: true,
        plan,
        amount: expectedAmount !== null && expectedAmount !== ""
            ? Number(expectedAmount)
            : Number(amount),
        currency: prevPayment.currency || "VND",
        orderCode: weddingOrder || orderCode,
        accessToken,
        provider: "sepay",
        txnId: String(txnId || ""),
        referenceCode: String(referenceCode || ""),
        gateway: String(gateway || ""),
        paidAt: nowIso,
        confirmedAt: nowIso,
        updatedAt: nowIso
    };

    // Merge full payment map (Firestore REST patch top-level payment)
    await fs.setMerge("weddings", weddingId, { payment });

    await fs.setMerge("paymentStatus", weddingId, {
        unlocked: true,
        status: "paid",
        accessToken,
        orderCode: payment.orderCode,
        plan,
        amount: payment.amount,
        currency: payment.currency,
        provider: "sepay",
        txnId: payment.txnId,
        updatedAt: nowIso
    });

    await fs.setMerge("orderCodes", orderCode, {
        weddingId,
        amount: payment.amount,
        currency: payment.currency,
        plan,
        status: "paid",
        provider: "sepay",
        txnId: payment.txnId,
        updatedAt: nowIso
    });

    return {
        ok: true,
        alreadyPaid: false,
        accessToken,
        weddingId
    };
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const rawBody = await request.text();

    const auth = await verifySePayAuth(request, rawBody, env);
    if (!auth.ok) {
        // Auth fail: KHÔNG success true (tránh chấp nhận spoof)
        return sepayFail(auth.reason || "unauthorized", 401);
    }

    const serviceAccount = parseServiceAccount(env);
    if (!serviceAccount) {
        return sepayFail("firebase_service_account_missing", 503);
    }

    let payload = {};
    try {
        payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (_) {
        return sepayFail("invalid_json", 400);
    }

    // Chỉ xử lý tiền vào
    const transferType = String(payload.transferType || "").toLowerCase();
    if (transferType && transferType !== "in") {
        return sepayOk({ ignored: true, reason: "not_incoming" });
    }

    const expectedAccount = String(env.SEPAY_ACCOUNT_NUMBER || "").replace(/\s+/g, "");
    if (expectedAccount) {
        const got = String(payload.accountNumber || "").replace(/\s+/g, "");
        if (got && got !== expectedAccount) {
            return sepayOk({ ignored: true, reason: "account_mismatch" });
        }
    }

    const orderCode = extractOrderCode(payload);
    const amount = Number(payload.transferAmount);
    const txnId = payload.id != null ? String(payload.id) : "";

    if (!orderCode) {
        // CK không có mã WC… — bỏ qua, báo success để SePay không retry vô hạn
        return sepayOk({ ignored: true, reason: "no_order_code" });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        return sepayOk({ ignored: true, reason: "invalid_amount" });
    }

    try {
        const accessToken = await getFirestoreAccessToken(serviceAccount);
        const fs = createFirestoreClient(serviceAccount, accessToken);

        // Dedup theo SePay transaction id — chỉ bỏ qua nếu đã unlock/thành công thật.
        // Lần trước ignored (order_not_found, amount_mismatch…) cho phép chạy lại sau khi sửa map.
        if (txnId) {
            const existingEvent = await fs.get("sepayEvents", txnId);
            const alreadyDone = existingEvent?.processed === true
                && existingEvent?.ignored !== true
                && (existingEvent?.ok === true || existingEvent?.alreadyPaid === true || existingEvent?.duplicate === true);
            if (alreadyDone) {
                return sepayOk({
                    duplicate: true,
                    weddingId: existingEvent.weddingId || "",
                    orderCode: existingEvent.orderCode || orderCode
                });
            }
        }

        const orderMap = await fs.get("orderCodes", orderCode);
        let weddingId = orderMap?.weddingId ? String(orderMap.weddingId).trim() : "";

        // Fallback: thiệp cũ / builder chưa ghi orderCodes — tra weddings theo payment.orderCode
        if (!weddingId) {
            try {
                weddingId = await findWeddingIdByOrderCode(fs, serviceAccount, accessToken, orderCode);
            } catch (lookupErr) {
                console.warn("[sepay-webhook] orderCode lookup failed:", lookupErr);
            }
        }

        if (!weddingId) {
            if (txnId) {
                await fs.setMerge("sepayEvents", txnId, {
                    processed: true,
                    ignored: true,
                    reason: "order_not_found",
                    orderCode,
                    amount,
                    content: String(payload.content || "").slice(0, 200),
                    at: new Date().toISOString()
                });
            }
            return sepayOk({ ignored: true, reason: "order_not_found", orderCode });
        }

        // Backfill map nếu thiếu (lần sau tra nhanh)
        if (!orderMap?.weddingId) {
            try {
                await fs.setMerge("orderCodes", orderCode, {
                    weddingId,
                    amount,
                    currency: "VND",
                    status: "pending",
                    updatedAt: new Date().toISOString()
                });
            } catch (_) { /* ignore */ }
        }

        // Match amount với map (nhanh) trước khi đọc wedding
        if (orderMap?.amount != null && orderMap.amount !== ""
            && !amountsMatch(orderMap.amount, amount)) {
            if (txnId) {
                await fs.setMerge("sepayEvents", txnId, {
                    processed: true,
                    ignored: true,
                    reason: "amount_mismatch",
                    orderCode,
                    weddingId,
                    expected: orderMap.amount,
                    received: amount,
                    at: new Date().toISOString()
                });
            }
            return sepayOk({
                ignored: true,
                reason: "amount_mismatch",
                expected: orderMap.amount,
                received: amount
            });
        }

        if (orderMap?.status === "paid") {
            if (txnId) {
                await fs.setMerge("sepayEvents", txnId, {
                    processed: true,
                    duplicate: true,
                    orderCode,
                    weddingId,
                    at: new Date().toISOString()
                });
            }
            return sepayOk({ alreadyPaid: true, weddingId, orderCode });
        }

        const result = await unlockWedding(fs, {
            weddingId,
            orderCode,
            amount,
            txnId,
            referenceCode: payload.referenceCode || "",
            gateway: payload.gateway || ""
        });

        if (txnId) {
            await fs.setMerge("sepayEvents", txnId, {
                processed: true,
                ok: result.ok,
                reason: result.reason || "",
                alreadyPaid: Boolean(result.alreadyPaid),
                orderCode,
                weddingId,
                amount,
                at: new Date().toISOString()
            });
        }

        if (!result.ok) {
            // amount_mismatch / not found — success true để không spam retry
            return sepayOk({
                ignored: true,
                reason: result.reason,
                expected: result.expected,
                received: result.received
            });
        }

        return sepayOk({
            unlocked: !result.alreadyPaid,
            alreadyPaid: Boolean(result.alreadyPaid),
            weddingId,
            orderCode
        });
    } catch (error) {
        console.error("[sepay-webhook]", error);
        // 500 → SePay sẽ retry (đúng khi Firestore tạm lỗi)
        return sepayFail(String(error?.message || error).slice(0, 180), 500);
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-SePay-Signature, X-SePay-Timestamp",
            "Access-Control-Max-Age": "86400"
        }
    });
}

/** GET nhẹ — kiểm tra endpoint đã deploy (không lộ secret) */
export async function onRequestGet(context) {
    const env = context.env || {};
    return jsonResponse({
        ok: true,
        service: "sepay-webhook",
        configured: {
            firebase: Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT),
            apiKey: Boolean(env.SEPAY_API_KEY),
            hmac: Boolean(env.SEPAY_WEBHOOK_SECRET),
            accountFilter: Boolean(env.SEPAY_ACCOUNT_NUMBER)
        }
    });
}
