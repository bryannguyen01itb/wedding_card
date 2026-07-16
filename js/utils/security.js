/**
 * Client-side security helpers — bổ sung Firestore Rules, không thay Rules.
 * Không leo thang payment; giới hạn wish/upload.
 */

import { generateAccessToken } from "./access.js";

export const WISH_LIMITS = {
    nameMax: 80,
    messageMax: 500,
    sideMax: 40,
    attendanceMax: 40,
    /** Tối thiểu ms giữa 2 lần gửi wish (cùng trình duyệt) */
    minIntervalMs: 15000,
    storageKey: "weddingWishLastSent"
};

export const UPLOAD_LIMITS = {
    /** Số lần upload Cloudinary / tab session */
    maxPerSession: 40,
    sessionKey: "weddingUploadCount",
    /** Bytes sau nén (client) */
    maxBlobBytes: 3.5 * 1024 * 1024
};

/**
 * Chuẩn hóa payment trước khi builder ghi Firestore.
 * - Chưa paid: luôn pending + unlocked false
 * - Đã paid: giữ unlocked/status/token/amount/plan server (không tin form leo thang)
 */
export function sanitizePaymentForBuilderSave(existingPayment = {}, nextPayment = {}) {
    const prev = existingPayment && typeof existingPayment === "object" ? existingPayment : {};
    const draft = nextPayment && typeof nextPayment === "object" ? nextPayment : {};
    const alreadyPaid = prev.unlocked === true || prev.status === "paid";

    const orderCode = normalizeOrderCode(prev.orderCode)
        || normalizeOrderCode(draft.orderCode)
        || generateOrderCode();

    if (alreadyPaid) {
        const lockedPlan = prev.plan === "multi" || prev.plan === "single"
            ? prev.plan
            : (draft.plan === "multi" ? "multi" : "single");
        return {
            ...prev,
            plan: lockedPlan,
            orderCode: normalizeOrderCode(prev.orderCode) || orderCode,
            amount: prev.amount !== undefined && prev.amount !== null && prev.amount !== ""
                ? prev.amount
                : draft.amount,
            currency: prev.currency || draft.currency || "VND",
            accessToken: String(prev.accessToken || draft.accessToken || "").trim()
                || generateAccessToken(),
            unlocked: true,
            status: prev.status === "locked" ? "locked" : "paid"
        };
    }

    // Nháp: không bao giờ gửi unlocked/paid từ client
    const plan = draft.plan === "multi" || draft.plan === "single"
        ? draft.plan
        : (prev.plan === "multi" ? "multi" : "single");

    return {
        status: "pending",
        unlocked: false,
        plan,
        orderCode,
        amount: draft.amount !== undefined && draft.amount !== null && draft.amount !== ""
            ? draft.amount
            : prev.amount,
        currency: draft.currency || prev.currency || "VND",
        accessToken: String(prev.accessToken || draft.accessToken || "").trim()
            || generateAccessToken(),
        weddingId: draft.weddingId || prev.weddingId || "",
        updatedAt: draft.updatedAt
    };
}

/**
 * Mã giao dịch / nội dung CK — hiện cho khách, admin đối chiếu.
 * Format: WC + 8 ký tự (không 0/O/1/I để dễ đọc khi chuyển khoản).
 */
export function generateOrderCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(8);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let code = "WC";
    for (let i = 0; i < 8; i++) {
        code += alphabet[bytes[i] % alphabet.length];
    }
    return code;
}

export function normalizeOrderCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return /^WC[A-Z2-9]{6,12}$/.test(code) ? code : "";
}

/** editToken: link sửa khó đoán hơn weddingId (legacy không có token vẫn mở được). */
export function generateEditToken() {
    return generateAccessToken();
}

export function normalizeEditToken(value) {
    const token = String(value || "").trim().toLowerCase();
    return /^[a-f0-9]{32}$/.test(token) ? token : "";
}

export function getEditTokenFromUrl(search = typeof window !== "undefined" ? window.location.search : "") {
    const params = new URLSearchParams(search);
    return normalizeEditToken(params.get("e") || params.get("edit"));
}

/**
 * true nếu được phép mở builder edit.
 * - Doc chưa có builder.editToken → legacy, cho qua
 * - Có editToken → URL phải khớp ?e=
 */
export function canOpenBuilderEdit(config = {}, urlEditToken = getEditTokenFromUrl()) {
    const required = normalizeEditToken(config?.builder?.editToken);
    if (!required) return true;
    return Boolean(urlEditToken) && urlEditToken === required;
}

export function assertWishPayload(data = {}) {
    const name = String(data.name || "").trim();
    const message = String(data.message || "").trim();
    const side = String(data.side || "").trim();
    const attendance = String(data.attendance || "").trim();

    if (!name || name.length > WISH_LIMITS.nameMax) {
        return { ok: false, error: "Tên không hợp lệ." };
    }
    if (!message || message.length > WISH_LIMITS.messageMax) {
        return { ok: false, error: "Lời chúc quá dài hoặc trống." };
    }
    if (side.length > WISH_LIMITS.sideMax || attendance.length > WISH_LIMITS.attendanceMax) {
        return { ok: false, error: "Dữ liệu form không hợp lệ." };
    }

    return {
        ok: true,
        data: {
            name,
            message,
            side,
            attendance
        }
    };
}

export function canSendWishNow(storage = typeof localStorage !== "undefined" ? localStorage : null) {
    if (!storage) return { ok: true };
    try {
        const last = Number(storage.getItem(WISH_LIMITS.storageKey) || 0);
        const elapsed = Date.now() - last;
        if (last && elapsed < WISH_LIMITS.minIntervalMs) {
            const waitSec = Math.ceil((WISH_LIMITS.minIntervalMs - elapsed) / 1000);
            return { ok: false, error: `Vui lòng đợi ${waitSec}s trước khi gửi tiếp.` };
        }
    } catch (_) {
        /* private mode */
    }
    return { ok: true };
}

export function markWishSent(storage = typeof localStorage !== "undefined" ? localStorage : null) {
    if (!storage) return;
    try {
        storage.setItem(WISH_LIMITS.storageKey, String(Date.now()));
    } catch (_) {
        /* ignore */
    }
}

export function canUploadMore(session = typeof sessionStorage !== "undefined" ? sessionStorage : null) {
    if (!session) return { ok: true, count: 0 };
    try {
        const count = Number(session.getItem(UPLOAD_LIMITS.sessionKey) || 0);
        if (count >= UPLOAD_LIMITS.maxPerSession) {
            return {
                ok: false,
                count,
                error: `Đã đạt giới hạn ${UPLOAD_LIMITS.maxPerSession} ảnh/lần mở trang. Tải lại trang hoặc thử lại sau.`
            };
        }
        return { ok: true, count };
    } catch (_) {
        return { ok: true, count: 0 };
    }
}

export function recordUpload(session = typeof sessionStorage !== "undefined" ? sessionStorage : null) {
    if (!session) return;
    try {
        const count = Number(session.getItem(UPLOAD_LIMITS.sessionKey) || 0) + 1;
        session.setItem(UPLOAD_LIMITS.sessionKey, String(count));
    } catch (_) {
        /* ignore */
    }
}

export function assertUploadBlob(blob) {
    if (!blob || typeof blob.size !== "number") {
        return { ok: false, error: "File ảnh không hợp lệ." };
    }
    if (blob.size > UPLOAD_LIMITS.maxBlobBytes) {
        return { ok: false, error: "Ảnh quá lớn sau khi nén. Chọn ảnh nhẹ hơn." };
    }
    const type = String(blob.type || "");
    if (type && !/^image\/(jpeg|jpg|png|webp|gif)$/i.test(type)) {
        return { ok: false, error: "Chỉ chấp nhận ảnh JPEG/PNG/WebP." };
    }
    return { ok: true };
}

/**
 * Ghi map token → weddingId (accessTokens / editAccess).
 * Lỗi map không chặn lưu thiệp (best-effort).
 */
export async function upsertTokenMap(db, collectionName, token, weddingId) {
    const id = String(token || "").trim().toLowerCase();
    const wid = String(weddingId || "").trim();
    if (!db || !/^[a-f0-9]{32}$/.test(id) || !wid) return false;
    try {
        const ref = db.collection(collectionName).doc(id);
        const snap = await ref.get();
        const payload = {
            weddingId: wid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!snap.exists) {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        await ref.set(payload, { merge: true });
        return true;
    } catch (error) {
        console.warn(`[security] upsert ${collectionName}/${id} failed:`, error);
        return false;
    }
}

export async function deleteTokenMap(db, collectionName, token) {
    const id = String(token || "").trim().toLowerCase();
    if (!db || !/^[a-f0-9]{32}$/.test(id)) return false;
    try {
        await db.collection(collectionName).doc(id).delete();
        return true;
    } catch (error) {
        console.warn(`[security] delete ${collectionName}/${id} failed:`, error);
        return false;
    }
}

/** Sau save builder / unlock admin: đồng bộ accessTokens + editAccess */
export async function syncWeddingTokenMaps(db, { weddingId, accessToken, editToken } = {}) {
    if (!db || !weddingId) return;
    const tasks = [];
    if (accessToken) tasks.push(upsertTokenMap(db, "accessTokens", accessToken, weddingId));
    if (editToken) tasks.push(upsertTokenMap(db, "editAccess", editToken, weddingId));
    await Promise.all(tasks);
}

/**
 * Map orderCode → wedding (SePay webhook tra cứu, không list weddings).
 * Client chỉ ghi pending; paid chỉ server webhook / admin.
 */
export async function upsertOrderCodeMap(db, orderCode, meta = {}) {
    const code = normalizeOrderCode(orderCode);
    const weddingId = String(meta.weddingId || "").trim();
    if (!db || !code || !weddingId) return false;
    try {
        const ref = db.collection("orderCodes").doc(code);
        const snap = await ref.get();
        const prev = snap.exists ? (snap.data() || {}) : {};
        // Không cho client ghi đè thiệp đã paid / đổi weddingId của mã đã gán
        if (prev.status === "paid" && prev.weddingId && prev.weddingId !== weddingId) {
            console.warn("[security] orderCode already paid for another wedding:", code);
            return false;
        }
        const unlocked = meta.unlocked === true || meta.status === "paid" || prev.status === "paid";
        const payload = {
            weddingId: prev.status === "paid" ? (prev.weddingId || weddingId) : weddingId,
            amount: meta.amount !== undefined && meta.amount !== null && meta.amount !== ""
                ? Number(meta.amount)
                : (prev.amount ?? null),
            currency: meta.currency || prev.currency || "VND",
            plan: (meta.plan === "multi" || prev.plan === "multi") ? "multi" : "single",
            status: unlocked ? "paid" : (meta.status || prev.status || "pending"),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!snap.exists) {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        // Client path: never escalate to paid via this helper unless admin passed status paid
        if (!meta.allowPaidWrite) {
            if (prev.status === "paid") {
                payload.status = "paid";
            } else {
                payload.status = "pending";
            }
        }
        await ref.set(payload, { merge: true });
        return true;
    } catch (error) {
        console.warn("[security] upsertOrderCodeMap failed:", error);
        return false;
    }
}

export async function deleteOrderCodeMap(db, orderCode) {
    const code = normalizeOrderCode(orderCode);
    if (!db || !code) return false;
    try {
        await db.collection("orderCodes").doc(code).delete();
        return true;
    } catch (error) {
        console.warn("[security] deleteOrderCodeMap failed:", error);
        return false;
    }
}

/** Ghi paymentStatus (public get) để builder nghe unlock khi wedding get bị chặn */
export async function upsertPaymentStatus(db, weddingId, payment = {}) {
    const id = String(weddingId || "").trim();
    if (!db || !id) return false;
    try {
        const unlocked = payment.unlocked === true || payment.status === "paid";
        await db.collection("paymentStatus").doc(id).set({
            unlocked: Boolean(payment.unlocked === true) || unlocked,
            status: unlocked && payment.status !== "locked"
                ? (payment.status === "locked" ? "locked" : "paid")
                : (payment.status || "pending"),
            accessToken: String(payment.accessToken || "").trim(),
            orderCode: String(payment.orderCode || "").trim(),
            plan: payment.plan === "multi" ? "multi" : "single",
            amount: payment.amount ?? null,
            currency: payment.currency || "VND",
            provider: payment.provider || "",
            txnId: payment.txnId || "",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        console.warn("[security] upsertPaymentStatus failed:", error);
        return false;
    }
}

/**
 * Lưu bản nháp đầy đủ vào editSessions/{editToken}
 * (builder load nháp khi weddings get bị chặn cho unpaid + có editToken)
 */
export async function upsertEditSession(db, editToken, weddingPayload = {}) {
    const token = normalizeEditToken(editToken);
    const weddingId = String(weddingPayload.weddingId || "").trim();
    if (!db || !token || !weddingId) return false;
    try {
        // Clone nông — bỏ FieldValue / undefined (tránh lỗi serialize)
        const raw = { ...weddingPayload, weddingId };
        delete raw.createdAt;
        delete raw.updatedAt;
        if (raw.payment && typeof raw.payment === "object") {
            raw.payment = { ...raw.payment };
            delete raw.payment.updatedAt;
            delete raw.payment.confirmedAt;
        }
        raw.sessionUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection("editSessions").doc(token).set(raw, { merge: true });
        return true;
    } catch (error) {
        console.warn("[security] upsertEditSession failed:", error);
        return false;
    }
}

export async function loadEditSession(db, editToken) {
    const token = normalizeEditToken(editToken);
    if (!db || !token) return null;
    try {
        const snap = await db.collection("editSessions").doc(token).get();
        if (!snap.exists) return null;
        return { id: snap.id, ...(snap.data() || {}) };
    } catch (error) {
        console.warn("[security] loadEditSession failed:", error);
        return null;
    }
}

/**
 * Trích public_id từ URL Cloudinary.
 * Bỏ transformation (c_fill,w_…) và version (v123).
 */
export function extractCloudinaryPublicId(url) {
    const raw = String(url || "").trim();
    if (!raw || !/res\.cloudinary\.com/i.test(raw)) return "";
    try {
        // .../upload/[transforms/][v123/]folder/name.jpg
        const path = raw.split("/upload/")[1] || "";
        const noQuery = path.split("?")[0];
        const parts = noQuery.split("/").filter(Boolean);
        // Bỏ các segment transform (chứa ,) và version v\d+
        const idParts = parts.filter(part => {
            if (!part) return false;
            if (/^v\d+$/i.test(part)) return false;
            if (part.includes(",")) return false;
            // transform dạng t_name
            if (/^[a-z]_/i.test(part) && !part.includes("/") && /^(c_|w_|h_|q_|f_|fl_|dpr_|e_|b_|ar_|g_|x_|y_)/i.test(part)) {
                return false;
            }
            return true;
        });
        if (!idParts.length) return "";
        // remove extension on last segment
        const last = idParts[idParts.length - 1].replace(/\.[a-z0-9]+$/i, "");
        idParts[idParts.length - 1] = last;
        return idParts.join("/");
    } catch (_) {
        return "";
    }
}

/**
 * Xóa asset bằng delete_token (trả về khi upload, không cần API secret).
 * Cần bật "Return delete token" trên unsigned preset (mặc định nhiều preset có).
 */
export async function destroyCloudinaryByDeleteToken(cloudName, deleteToken) {
    const cloud = String(cloudName || "").trim();
    const token = String(deleteToken || "").trim();
    if (!cloud || !token) return { ok: false, error: "missing_token" };
    try {
        const body = new URLSearchParams({ token });
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloud}/delete_by_token`,
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body
            }
        );
        const data = await response.json().catch(() => ({}));
        const ok = response.ok && (data.result === "ok" || data.result === "not found");
        return {
            ok,
            result: data.result || null,
            status: response.status,
            error: ok ? "" : String(data.error?.message || data.result || response.status)
        };
    } catch (error) {
        return { ok: false, error: String(error?.message || error) };
    }
}

/** Gom public_id từ config thiệp + mảng builder.cloudinaryPublicIds */
export function collectCloudinaryPublicIds(config = {}) {
    const found = new Set();
    const add = value => {
        if (Array.isArray(value)) {
            value.forEach(add);
            return;
        }
        if (value && typeof value === "object") {
            Object.values(value).forEach(add);
            return;
        }
        const id = extractCloudinaryPublicId(value);
        if (id) found.add(id);
        // raw public_id already stored
        if (typeof value === "string" && /^[\w./-]+$/.test(value) && value.includes("wedding-builder")) {
            found.add(value.replace(/\.[a-z0-9]+$/i, ""));
        }
    };

    add(config);
    const listed = config?.builder?.cloudinaryPublicIds;
    if (Array.isArray(listed)) {
        listed.forEach(item => {
            const s = String(item || "").trim();
            if (s) found.add(s.replace(/\.[a-z0-9]+$/i, ""));
        });
    }
    return [...found];
}

/**
 * Gọi API xóa ảnh Cloudinary.
 *
 * - Production (Pages): /api/cloudinary-cleanup
 * - Local: http://127.0.0.1:8788/api/cloudinary-cleanup
 *   (chạy `npm run dev:cloudinary` với CLOUDINARY_API_KEY/SECRET)
 * - Local static server không có API + không có proxy 8788 → skipped
 */
export async function requestCloudinaryCleanup(publicIds, options = {}) {
    const ids = (Array.isArray(publicIds) ? publicIds : []).map(s => String(s || "").trim()).filter(Boolean);
    if (!ids.length) return { ok: true, deleted: 0, skipped: true };

    const host = typeof location !== "undefined" ? String(location.hostname || "") : "";
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    const localPort = options.localPort || 8788;
    const localEndpoint = `http://127.0.0.1:${localPort}/api/cloudinary-cleanup`;

    /** @type {string[]} */
    const endpoints = [];
    if (options.endpoint) {
        endpoints.push(options.endpoint);
    } else if (isLocal) {
        // Ưu tiên local proxy (npm run dev:cloudinary)
        endpoints.push(localEndpoint);
        // Không gọi /api trên python http.server (501) trừ khi force
        if (options.force) endpoints.push("/api/cloudinary-cleanup");
    } else {
        endpoints.push("/api/cloudinary-cleanup");
    }

    const headers = {
        "Content-Type": "application/json"
    };
    if (options.cleanupKey) {
        headers["X-Cleanup-Key"] = options.cleanupKey;
    }
    if (options.idToken) {
        headers.Authorization = `Bearer ${options.idToken}`;
    }

    let lastError = "cleanup_failed";
    let lastStatus = 0;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify({ publicIds: ids })
            });
            if (!response.ok) {
                const text = await response.text();
                lastStatus = response.status;
                // python http.server → 501
                if (response.status === 501 || /unsupported method/i.test(text)) {
                    lastError = "local_static_server_no_api";
                    continue;
                }
                lastError = text.slice(0, 200) || `http_${response.status}`;
                continue;
            }
            const data = await response.json().catch(() => ({}));
            return { ok: true, endpoint, ...data };
        } catch (error) {
            // ECONNREFUSED khi chưa chạy npm run dev:cloudinary
            lastError = String(error?.message || error);
            if (/Failed to fetch|NetworkError|Load failed/i.test(lastError)) {
                lastError = isLocal
                    ? "local_cleanup_proxy_offline"
                    : lastError;
            }
        }
    }

    if (isLocal && (lastError === "local_cleanup_proxy_offline" || lastError === "local_static_server_no_api")) {
        return {
            ok: false,
            skipped: true,
            deleted: 0,
            error: lastError,
            status: lastStatus,
            hint: "Local: chạy `npm run dev:cloudinary` (cần CLOUDINARY_API_KEY + SECRET), hoặc bật Return delete token trên preset."
        };
    }

    return { ok: false, error: lastError, status: lastStatus };
}
