import { db } from "../js/firebase.js";
import { generateAccessToken, buildInvitationUrlFromBase } from "../js/utils/access.js";
import { BRAND_PRIMARY } from "../js/brand.js";
import { isAllowedAdminEmail } from "../js/adminAllowlist.js";
import {
    syncWeddingTokenMaps,
    deleteTokenMap,
    upsertPaymentStatus,
    collectCloudinaryPublicIds,
    requestCloudinaryCleanup
} from "../js/utils/security.js";

const DEFAULT_PRIMARY = BRAND_PRIMARY;
const DEFAULT_MEDIA_CONCEPT = "concept-1";
const GALLERY_SIZE = 7;

const auth = firebase.auth();
const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const adminApp = document.getElementById("adminApp");
const adminHero = document.getElementById("adminHero");
const accountEmail = document.getElementById("accountEmail");
const logoutBtn = document.getElementById("logoutBtn");
const form = document.getElementById("adminForm");
const loadInput = document.getElementById("loadWeddingId");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const toast = document.getElementById("toast");
const previewLink = document.getElementById("previewLink");
const galleryFields = document.getElementById("galleryFields");
const musicPanel = document.getElementById("musicPanel");
const musicForm = document.getElementById("musicForm");
const musicDocId = document.getElementById("musicDocId");
const musicTitle = document.getElementById("musicTitle");
const musicUrl = document.getElementById("musicUrl");
const musicActive = document.getElementById("musicActive");
const musicList = document.getElementById("musicList");
const resetMusicBtn = document.getElementById("resetMusicBtn");
const saveMusicBtn = document.getElementById("saveMusicBtn");
const paymentPanel = document.getElementById("paymentPanel");
const paymentSettingsForm = document.getElementById("paymentSettingsForm");
const paymentAmount = document.getElementById("paymentAmount");
const paymentAmountMulti = document.getElementById("paymentAmountMulti");
const paymentCurrency = document.getElementById("paymentCurrency");
const paymentContactUrl = document.getElementById("paymentContactUrl");
const paymentQrImage = document.getElementById("paymentQrImage");
const paymentReceiver = document.getElementById("paymentReceiver");
const paymentMessage = document.getElementById("paymentMessage");
const paymentList = document.getElementById("paymentList");
const refreshPaymentListBtn = document.getElementById("refreshPaymentListBtn");
const deleteOldWeddingsBtn = document.getElementById("deleteOldWeddingsBtn");

const WEDDING_STALE_DAYS = 30;
/** Cache list thiệp để bulk delete */
let cachedWeddingList = [];

let currentConfig = createEmptyAdminConfig();
let hasLoadedInitialConfig = false;
let activeMediaConcept = DEFAULT_MEDIA_CONCEPT;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

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

/**
 * Form admin trống — không preload wedding-cp-4 / data mẫu.
 * Chỉ fill khi admin tải weddingId từ Firebase.
 */
function createEmptyAdminConfig() {
    return {
        weddingId: "",
        date: "",
        music: "",
        plan: "single",
        guests: [],
        cover: { headline: "TRÂN TRỌNG KÍNH MỜI", guest: "Quý khách" },
        payment: {
            status: "",
            unlocked: false,
            plan: "single",
            currency: "VND",
            accessToken: ""
        },
        theme: {
            primaryColor: DEFAULT_PRIMARY,
            blocks: {},
            fonts: {},
            concepts: {}
        },
        poster: { image: "" },
        preview: { image: "" },
        aboutCard: { image: "" },
        groom: {
            nickname: "",
            fullName: "",
            father: "",
            mother: "",
            avatar: ""
        },
        bride: {
            nickname: "",
            fullName: "",
            father: "",
            mother: "",
            avatar: ""
        },
        ceremony: {
            image: "",
            bride: {
                title: "",
                time: "",
                address: "",
                location: "",
                mapUrl: "",
                meal: { title: "", time: "" }
            },
            groom: {
                title: "",
                time: "",
                address: "",
                location: "",
                mapUrl: "",
                meal: { title: "", time: "" }
            }
        },
        gallery: { photos: [] },
        gift: {
            groom: { qr: "", bank: "", accountName: "", accountNumber: "" },
            bride: { qr: "", bank: "", accountName: "", accountNumber: "" }
        },
        sections: {
            saveDate: "",
            about: "",
            timeline: "",
            gallery: "",
            wish: "",
            gift: { title: "" },
            countdown: { title: "" },
            thanks: { title: "" }
        },
        sectionSubtitles: {
            saveDate: "",
            about: "",
            timeline: "",
            gallery: "",
            wish: "",
            gift: "",
            countdown: "",
            thanks: []
        },
        builder: {}
    };
}

function getActiveMediaConcept() {
    return activeMediaConcept;
}

function resolveActivePath(path, config = currentConfig) {
    if (!path.includes(".active.")) return path;
    return path.replace(".active.", `.${getActiveMediaConcept()}.`);
}

function getByPath(source, path) {
    return resolveActivePath(path).split(".").reduce((value, key) => value?.[key], source);
}

function setByPath(target, path, value) {
    const parts = resolveActivePath(path, target).split(".");
    const last = parts.pop();
    const parent = parts.reduce((object, key) => {
        object[key] = isPlainObject(object[key]) ? object[key] : {};
        return object[key];
    }, target);

    parent[last] = value;
}

function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        toast.className = "toast";
    }, 3200);
}

function syncColorInputs(primaryColor) {
    // Chỉ đồng bộ ô form màu thiệp — KHÔNG đổi chrome admin
    // (tránh mở/chọn thiệp là cả trang admin đổi theo primaryColor của thiệp)
    const value = /^#[0-9a-fA-F]{6}$/.test(primaryColor || "") ? primaryColor : DEFAULT_PRIMARY;
    if (form?.elements?.["theme.primaryColor"]) {
        form.elements["theme.primaryColor"].value = value;
    }
    if (form?.elements?.["theme.primaryColorText"]) {
        form.elements["theme.primaryColorText"].value = value;
    }
}

function fillGalleryFields() {
    galleryFields.textContent = "";

    Array.from({ length: GALLERY_SIZE }, (_, index) => {
        const row = document.createElement("div");
        row.className = "gallery-row";
        row.innerHTML = `
            <div class="gallery-index">Ảnh ${index + 1}</div>
            <label>Link ảnh<input name="gallery.photos.${index}.src"></label>
            <label>Alt text<input name="gallery.photos.${index}.alt" placeholder="Ảnh cưới ${index + 1}"></label>
        `;
        galleryFields.appendChild(row);
    });
}

function buildBuilderEditUrl(weddingId, editToken = "") {
    const url = new URL("../builder/", window.location.href);
    url.search = "";
    if (weddingId) url.searchParams.set("wedding", weddingId);
    const e = String(editToken || "").trim().toLowerCase();
    if (/^[a-f0-9]{32}$/.test(e)) url.searchParams.set("e", e);
    return url.toString();
}

function updatePreviewLink(weddingId, accessToken = "") {
    if (!weddingId && !accessToken) {
        previewLink.textContent = "chưa có weddingId";
        previewLink.href = "#";
        return;
    }

    // Link khách: ưu tiên token (?t=) — không đoán được từ weddingId
    const token = accessToken || currentConfig?.payment?.accessToken || "";
    const url = buildInvitationUrlFromBase(new URL("../index.html", window.location.href).href, {
        accessToken: token,
        // fallback weddingId chỉ khi chưa có token (thiệp cũ)
        weddingId: token ? "" : weddingId
    });
    previewLink.href = url;
    previewLink.textContent = url;

    // Gợi ý link builder (có ?e= nếu thiệp đã có editToken)
    const builderLink = document.getElementById("builderEditLink");
    if (builderLink && weddingId) {
        const editTok = currentConfig?.builder?.editToken || "";
        const bUrl = buildBuilderEditUrl(weddingId, editTok);
        builderLink.href = bUrl;
        builderLink.textContent = bUrl;
        builderLink.hidden = false;
    }
}

function getPaymentSettingAmountFromInput(inputEl) {
    const rawAmount = inputEl?.value;
    if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
        return null;
    }

    const amount = Number(rawAmount);
    return Number.isNaN(amount) ? null : amount;
}

function getPaymentSettingAmount() {
    return getPaymentSettingAmountFromInput(paymentAmount);
}

function getPaymentSettingAmountMulti() {
    return getPaymentSettingAmountFromInput(paymentAmountMulti);
}

function getPaymentSettingCurrency() {
    return paymentCurrency?.value?.trim() || "VND";
}

function getPaymentPlanLabel(payment = {}) {
    if (payment.plan === "multi") return "Nhiều link";
    if (payment.plan === "single") return "1 link";
    return "";
}

/** Firestore Timestamp | Date | number → Date | null */
function toJsDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") {
        try {
            return value.toDate();
        } catch {
            return null;
        }
    }
    if (value instanceof Date) return value;
    if (typeof value === "number") {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === "string") {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    // { seconds, nanoseconds }
    if (typeof value.seconds === "number") {
        return new Date(value.seconds * 1000);
    }
    return null;
}

/** Ngày tham chiếu tuổi thiệp: payment.updatedAt → confirmedAt → date cưới */
function getWeddingRefDate(item = {}) {
    return (
        toJsDate(item.payment?.updatedAt)
        || toJsDate(item.payment?.confirmedAt)
        || toJsDate(item.updatedAt)
        || toJsDate(item.createdAt)
        || toJsDate(item.date)
        || null
    );
}

function getWeddingAgeDays(item) {
    const ref = getWeddingRefDate(item);
    if (!ref) return null;
    return Math.floor((Date.now() - ref.getTime()) / 86400000);
}

function formatWeddingAge(item) {
    const days = getWeddingAgeDays(item);
    if (days === null) return "Chưa rõ ngày";
    if (days < 0) return "0 ngày";
    if (days === 0) return "Hôm nay";
    if (days === 1) return "1 ngày";
    return `${days} ngày`;
}

function isWeddingStale(item, days = WEDDING_STALE_DAYS) {
    const age = getWeddingAgeDays(item);
    return age !== null && age >= days;
}

function formatMoney(amount, currency = "VND") {
    // Chỉ hiển thị amount thật từ wedding.payment — không fallback settings/mẫu
    if (amount === undefined || amount === null || amount === "") {
        return "Chưa đặt số tiền";
    }

    const value = Number(amount);
    if (Number.isNaN(value)) return "Chưa đặt số tiền";
    return new Intl.NumberFormat("vi-VN").format(value) + ` ${currency || getPaymentSettingCurrency() || "VND"}`;
}

function fillPaymentSettings(data = {}) {
    paymentAmount.value = data.amount ?? "";
    if (paymentAmountMulti) {
        paymentAmountMulti.value = data.amountMulti ?? "";
    }
    paymentCurrency.value = data.currency || "VND";
    paymentContactUrl.value = data.contactUrl || "";
    paymentQrImage.value = data.qrImage || "";
    paymentReceiver.value = data.receiver || "";
    paymentMessage.value = data.message || "Vui lòng chuyển khoản với nội dung là Wedding ID để admin xác nhận nhanh hơn.";
}

async function loadPaymentSettingsAdmin() {
    try {
        const doc = await db.collection("settings").doc("payment").get();
        fillPaymentSettings(doc.exists ? doc.data() : {});
    } catch (error) {
        console.error(error);
        showToast("Không tải được cấu hình thanh toán.", "error");
    }
}

async function savePaymentSettings(event) {
    event.preventDefault();
    if (!auth.currentUser) {
        showToast("Bạn cần đăng nhập trước khi lưu thanh toán.", "error");
        return;
    }

    const payload = {
        amount: getPaymentSettingAmount(),
        amountMulti: getPaymentSettingAmountMulti(),
        currency: paymentCurrency.value.trim() || "VND",
        contactUrl: paymentContactUrl.value.trim(),
        qrImage: paymentQrImage.value.trim(),
        receiver: paymentReceiver.value.trim(),
        message: paymentMessage.value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("settings").doc("payment").set(payload, { merge: true });
        showToast("Đã lưu cấu hình thanh toán.");
    } catch (error) {
        console.error(error);
        showToast("Lưu cấu hình thanh toán thất bại.", "error");
    }
}

function hasStoredAmount(amount) {
    return amount !== undefined && amount !== null && amount !== "" && !Number.isNaN(Number(amount));
}

function getPaymentStatusLabel(payment = {}) {
    if (payment.unlocked === true || payment.status === "paid") return "Đã thanh toán";
    if (payment.status === "pending") return "Chờ thanh toán";
    if (payment.status === "locked") return "Đã khóa";
    return "Chưa thanh toán";
}

function renderPaymentList(items) {
    if (!paymentList) return;
    paymentList.textContent = "";
    cachedWeddingList = items;

    if (!items.length) {
        paymentList.innerHTML = '<p class="empty-state">Chưa có thiệp nào trong Firebase.</p>';
        return;
    }

    const staleCount = items.filter(item => isWeddingStale(item)).length;
    if (staleCount && deleteOldWeddingsBtn) {
        deleteOldWeddingsBtn.innerHTML = `<i class="bi bi-trash3"></i> Xóa &gt; 30 ngày (${staleCount})`;
    } else if (deleteOldWeddingsBtn) {
        deleteOldWeddingsBtn.innerHTML = '<i class="bi bi-trash3"></i> Xóa &gt; 30 ngày';
    }

    items.forEach(item => {
        const payment = item.payment || {};
        const paid = payment.unlocked || payment.status === "paid";
        const stale = isWeddingStale(item);
        const id = item.weddingId || item.id;
        const row = document.createElement("article");
        row.className = `payment-item${paid ? " is-paid" : ""}${stale ? " is-stale" : ""}`;
        row.dataset.id = item.id;

        const planLabel = getPaymentPlanLabel(payment);
        const money = hasStoredAmount(payment.amount)
            ? formatMoney(payment.amount, payment.currency || getPaymentSettingCurrency())
            : "Chưa đặt số tiền";
        const ageLabel = formatWeddingAge(item);

        row.innerHTML = `
            <div class="payment-item__info">
                <strong>${id}${stale ? ' <span class="payment-item__badge">&gt;30 ngày</span>' : ""}</strong>
                <span>${item.groom?.nickname || "Chú rể"} &amp; ${item.bride?.nickname || "Cô dâu"}</span>
                <em>${getPaymentStatusLabel(payment)}${planLabel ? ` · ${planLabel}` : ""} · ${money} · ${ageLabel}</em>
            </div>
            <div class="payment-item__actions">
                <button type="button" class="small" data-wedding-edit="${item.id}" title="Sửa thông tin thiệp">
                    <i class="bi bi-pencil-square"></i> Sửa
                </button>
                ${paid
                    ? `<button type="button" class="ghost small danger" data-payment-action="locked" data-id="${item.id}"><i class="bi bi-lock-fill"></i> Khóa</button>`
                    : `<button type="button" class="ghost small" data-payment-action="paid" data-id="${item.id}"><i class="bi bi-check2-circle"></i> Đã trả</button>`}
                <button type="button" class="ghost small${(payment.plan || item.plan) === "single" ? " is-plan-active" : ""}" data-plan-action="single" data-id="${item.id}" title="Đổi sang gói 1 link">
                    <i class="bi bi-link-45deg"></i> 1 link
                </button>
                <button type="button" class="ghost small${(payment.plan || item.plan) === "multi" ? " is-plan-active" : ""}" data-plan-action="multi" data-id="${item.id}" title="Đổi sang gói nhiều link theo khách">
                    <i class="bi bi-people"></i> Nhiều link
                </button>
                <button type="button" class="ghost small danger" data-wedding-delete="${item.id}" title="Xóa vĩnh viễn thiệp + lời chúc">
                    <i class="bi bi-trash3-fill"></i> Xóa
                </button>
            </div>
        `;
        paymentList.appendChild(row);
    });
}

/** State popup đổi gói */
let planChangeState = null;
/** Resolve cho popup xác nhận chung */
let adminConfirmResolve = null;

/**
 * Popup xác nhận đẹp (thay window.confirm).
 * @returns {Promise<boolean>}
 */
function showAdminConfirm({
    eyebrow = "Xác nhận",
    title = "Bạn chắc chắn?",
    message = "",
    warning = "",
    weddingId = "",
    confirmLabel = "Xác nhận",
    confirmIcon = "bi-check2-circle",
    variant = "primary" // primary | success | danger
} = {}) {
    return new Promise(resolve => {
        // Đóng popup cũ nếu còn
        if (adminConfirmResolve) {
            adminConfirmResolve(false);
            adminConfirmResolve = null;
        }
        adminConfirmResolve = resolve;

        const modal = document.getElementById("adminConfirmModal");
        const iconEl = document.getElementById("adminConfirmIcon");
        const eyebrowEl = document.getElementById("adminConfirmEyebrow");
        const titleEl = document.getElementById("adminConfirmTitle");
        const msgEl = document.getElementById("adminConfirmMessage");
        const idEl = document.getElementById("adminConfirmWeddingId");
        const warnBox = document.getElementById("adminConfirmWarning");
        const warnText = document.getElementById("adminConfirmWarningText");
        const okBtn = document.getElementById("adminConfirmOkBtn");

        if (eyebrowEl) eyebrowEl.textContent = eyebrow;
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;

        if (idEl) {
            if (weddingId) {
                idEl.hidden = false;
                idEl.textContent = weddingId;
            } else {
                idEl.hidden = true;
                idEl.textContent = "";
            }
        }

        if (warnBox && warnText) {
            if (warning) {
                warnBox.hidden = false;
                warnText.textContent = warning;
            } else {
                warnBox.hidden = true;
                warnText.textContent = "";
            }
        }

        if (iconEl) {
            iconEl.className = "admin-modal__icon";
            if (variant === "success") iconEl.classList.add("admin-modal__icon--paid");
            else if (variant === "danger") iconEl.classList.add("admin-modal__icon--delete");
            else if (variant === "lock") iconEl.classList.add("admin-modal__icon--lock");

            const iconName = variant === "success"
                ? "bi-check2-circle"
                : variant === "danger"
                    ? "bi-trash3-fill"
                    : variant === "lock"
                        ? "bi-lock-fill"
                        : confirmIcon.replace(/^bi-/, "bi-") || "bi-question-circle";
            iconEl.innerHTML = `<i class="bi ${iconName.startsWith("bi-") ? iconName : `bi-${iconName}`}"></i>`;
        }

        if (okBtn) {
            okBtn.classList.remove("is-danger", "is-success");
            if (variant === "danger") okBtn.classList.add("is-danger");
            if (variant === "success") okBtn.classList.add("is-success");
            okBtn.innerHTML = `<i class="bi ${confirmIcon.startsWith("bi-") ? confirmIcon : `bi-${confirmIcon}`}"></i> ${confirmLabel}`;
        }

        if (modal) {
            modal.hidden = false;
            document.body.classList.add("admin-modal-open");
        }
    });
}

function closeAdminConfirm(result = false) {
    const modal = document.getElementById("adminConfirmModal");
    if (modal) modal.hidden = true;
    // Chỉ gỡ class nếu plan modal cũng đóng
    const planModal = document.getElementById("planChangeModal");
    if (!planModal || planModal.hidden) {
        document.body.classList.remove("admin-modal-open");
    }
    if (adminConfirmResolve) {
        const resolve = adminConfirmResolve;
        adminConfirmResolve = null;
        resolve(Boolean(result));
    }
}

function openPlanChangeModal(state) {
    planChangeState = state;
    const modal = document.getElementById("planChangeModal");
    if (!modal) return;

    const fromLabel = state.currentPlan === "multi" ? "Nhiều link" : "1 link";
    const toLabel = state.plan === "multi" ? "Nhiều link" : "1 link";

    const idEl = document.getElementById("planChangeWeddingId");
    const fromEl = document.getElementById("planChangeFromLabel");
    const toEl = document.getElementById("planChangeToLabel");
    const oldPriceEl = document.getElementById("planChangeOldPrice");
    const newPriceEl = document.getElementById("planChangeNewPrice");
    const warnBox = document.getElementById("planChangeWarning");
    const warnText = document.getElementById("planChangeWarningText");
    const updatePriceEl = document.getElementById("planChangeUpdatePrice");

    if (idEl) idEl.textContent = state.id;
    if (fromEl) fromEl.textContent = fromLabel;
    if (toEl) toEl.textContent = toLabel;
    if (oldPriceEl) {
        oldPriceEl.textContent = state.oldAmount !== null
            ? formatMoney(state.oldAmount)
            : "Chưa đặt";
    }
    if (newPriceEl) newPriceEl.textContent = formatMoney(state.pricedAmount);

    const guestCount = Array.isArray(state.guests) ? state.guests.length : 0;
    if (warnBox && warnText) {
        if (state.plan === "single" && guestCount > 0) {
            warnBox.hidden = false;
            warnText.textContent = `Thiệp đang có ${guestCount} tên khách. Chuyển 1 link sẽ xóa danh sách guests — link ?g= không còn hiệu lực.`;
        } else if (state.plan === "multi") {
            warnBox.hidden = false;
            warnText.textContent = "Gói nhiều link: khách có thể nhập danh sách tên trên builder để tạo link riêng.";
        } else {
            warnBox.hidden = true;
            warnText.textContent = "";
        }
    }

    if (updatePriceEl) updatePriceEl.checked = true;

    modal.hidden = false;
    document.body.classList.add("admin-modal-open");
}

function closePlanChangeModal() {
    planChangeState = null;
    const modal = document.getElementById("planChangeModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("admin-modal-open");
}

/**
 * Mở popup đổi gói (thay confirm trình duyệt).
 */
async function changeWeddingPlan(weddingId, nextPlan) {
    const id = String(weddingId || "").trim();
    const plan = nextPlan === "multi" ? "multi" : "single";
    if (!id) return false;
    if (!auth.currentUser) {
        showToast("Cần đăng nhập admin.", "error");
        return false;
    }

    try {
        const doc = await db.collection("weddings").doc(id).get();
        if (!doc.exists) {
            showToast(`Không tìm thấy thiệp: ${id}`, "error");
            return false;
        }

        const data = doc.data() || {};
        const prev = data.payment || {};
        const currentPlan = prev.plan === "multi" || prev.plan === "single"
            ? prev.plan
            : (data.plan === "multi" ? "multi" : "single");

        if (currentPlan === plan) {
            showToast(`Thiệp ${id} đã ở gói ${plan === "multi" ? "nhiều link" : "1 link"}.`);
            return false;
        }

        const pricedAmount = plan === "multi"
            ? (getPaymentSettingAmountMulti() ?? getPaymentSettingAmount() ?? 129000)
            : (getPaymentSettingAmount() ?? 99000);
        const oldAmount = hasStoredAmount(prev.amount) ? Number(prev.amount) : null;

        openPlanChangeModal({
            id,
            plan,
            currentPlan,
            prev,
            guests: data.guests || [],
            pricedAmount,
            oldAmount
        });
        return true;
    } catch (error) {
        console.error(error);
        showToast("Không tải được thiệp để đổi gói.", "error");
        return false;
    }
}

/** Áp dụng đổi gói sau khi admin bấm Xác nhận trên modal. */
async function confirmPlanChangeFromModal() {
    if (!planChangeState) return false;
    const { id, plan, prev, pricedAmount, oldAmount } = planChangeState;
    const updatePrice = Boolean(document.getElementById("planChangeUpdatePrice")?.checked);
    const amount = updatePrice
        ? pricedAmount
        : (oldAmount !== null ? oldAmount : pricedAmount);
    const toLabel = plan === "multi" ? "Nhiều link" : "1 link";

    const confirmBtn = document.getElementById("planChangeConfirmBtn");
    const oldHtml = confirmBtn?.innerHTML;
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang lưu…';
    }

    try {
        const payload = {
            plan,
            payment: {
                ...prev,
                plan,
                amount,
                currency: prev.currency || getPaymentSettingCurrency() || "VND",
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (plan === "single") {
            payload.guests = [];
        }

        await db.collection("weddings").doc(id).set(payload, { merge: true });

        if (currentConfig.weddingId === id || loadInput?.value === id) {
            currentConfig = mergeConfig(currentConfig, payload);
            if (plan === "single") currentConfig.guests = [];
            const planSelect = form?.elements?.plan;
            if (planSelect) planSelect.value = plan;
            const guestsField = form?.elements?.guests;
            if (guestsField && plan === "single") guestsField.value = "";
            else if (guestsField && Array.isArray(currentConfig.guests)) {
                guestsField.value = currentConfig.guests.join("\n");
            }
        }

        closePlanChangeModal();
        await loadPaymentList();
        showToast(
            `Đã đổi ${id} → ${toLabel}`
            + (updatePrice ? ` · giá ${formatMoney(amount)}` : " · giữ giá cũ")
        );
        return true;
    } catch (error) {
        console.error(error);
        showToast("Đổi gói thất bại. Kiểm tra quyền Firestore.", "error");
        return false;
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = oldHtml || '<i class="bi bi-check2-circle"></i> Xác nhận đổi gói';
        }
    }
}

/**
 * Xóa subcollection wishes rồi xóa doc weddings/{id}.
 * Ảnh Cloudinary không xóa tự động (cần dọn tay trên Cloudinary nếu muốn).
 */
async function deleteWeddingSubcollections(weddingId) {
    const wishesSnap = await db.collection("weddings").doc(weddingId).collection("wishes").get();
    if (wishesSnap.empty) return 0;

    let batch = db.batch();
    let ops = 0;
    let total = 0;

    for (const doc of wishesSnap.docs) {
        batch.delete(doc.ref);
        ops += 1;
        total += 1;
        if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }
    if (ops > 0) await batch.commit();
    return total;
}

async function deleteWeddingById(weddingId, { confirm: needConfirm = true } = {}) {
    const id = String(weddingId || "").trim();
    if (!id) return false;
    if (!auth.currentUser) {
        showToast("Cần đăng nhập admin để xóa thiệp.", "error");
        return false;
    }

    if (needConfirm) {
        const ok = await showAdminConfirm({
            eyebrow: "Xóa thiệp",
            title: "Xóa vĩnh viễn thiệp này?",
            weddingId: id,
            message: "Thao tác không hoàn tác được.",
            warning: "Sẽ xóa config Firebase và toàn bộ lời chúc (wishes). Ảnh trên Cloudinary không tự xóa.",
            confirmLabel: "Xóa thiệp",
            confirmIcon: "bi-trash3-fill",
            variant: "danger"
        });
        if (!ok) return false;
    }

    try {
        // Lấy token + public_ids trước khi xóa doc
        let accessToken = "";
        let editToken = "";
        let weddingData = {};
        try {
            const existing = await db.collection("weddings").doc(id).get();
            if (existing.exists) {
                weddingData = existing.data() || {};
                accessToken = String(weddingData.payment?.accessToken || "").trim();
                editToken = String(weddingData.builder?.editToken || "").trim();
            }
        } catch (_) {
            /* continue delete */
        }

        const publicIds = collectCloudinaryPublicIds({ ...weddingData, weddingId: id });

        await deleteWeddingSubcollections(id);
        await db.collection("weddings").doc(id).delete();

        // Dọn map + paymentStatus + editSessions
        const cleanupTasks = [];
        if (accessToken) cleanupTasks.push(deleteTokenMap(db, "accessTokens", accessToken));
        if (editToken) {
            cleanupTasks.push(deleteTokenMap(db, "editAccess", editToken));
            cleanupTasks.push(deleteTokenMap(db, "editSessions", editToken));
        }
        cleanupTasks.push(
            db.collection("paymentStatus").doc(id).delete().catch(() => null)
        );
        await Promise.all(cleanupTasks);

        // Best-effort xóa ảnh Cloudinary (cần Pages Function + env)
        let mediaNote = "";
        if (publicIds.length) {
            // Không cần gõ CLEANUP_KEY thủ công — API dùng secret trên Cloudflare env
            const mediaResult = await requestCloudinaryCleanup(publicIds);
            if (mediaResult.ok && !mediaResult.skipped) {
                mediaNote = ` · đã gửi xóa ${mediaResult.deleted ?? publicIds.length} ảnh Cloudinary`;
            } else {
                mediaNote = ` · ${publicIds.length} ảnh Cloudinary: ${mediaResult.error || "chưa cấu hình API / deploy CF"}`;
            }
        }

        if (currentConfig.weddingId === id || loadInput?.value === id) {
            fillForm(createEmptyAdminConfig());
            loadInput.value = "";
            updatePreviewLink("");
        }

        showToast(`Đã xóa thiệp: ${id}${mediaNote}`);
        return true;
    } catch (error) {
        console.error(error);
        showToast(`Xóa thất bại (${id}). Kiểm tra Firestore Rules (delete).`, "error");
        return false;
    }
}

async function deleteStaleWeddings() {
    if (!auth.currentUser) {
        showToast("Cần đăng nhập admin.", "error");
        return;
    }

    const stale = cachedWeddingList.filter(item => isWeddingStale(item));
    if (!stale.length) {
        showToast(`Không có thiệp nào quá ${WEDDING_STALE_DAYS} ngày trong danh sách hiện tại.`);
        return;
    }

    const preview = stale.slice(0, 8).map(item => item.weddingId || item.id).join("\n");
    const more = stale.length > 8 ? `\n… và ${stale.length - 8} thiệp khác` : "";
    const ok = await showAdminConfirm({
        eyebrow: "Dọn thiệp cũ",
        title: `Xóa ${stale.length} thiệp quá ${WEDDING_STALE_DAYS} ngày?`,
        message: `${preview}${more}`,
        warning: "Xóa vĩnh viễn config + lời chúc. Ảnh Cloudinary không tự xóa. Không hoàn tác được.",
        confirmLabel: `Xóa ${stale.length} thiệp`,
        confirmIcon: "bi-trash3-fill",
        variant: "danger"
    });
    if (!ok) return;

    if (deleteOldWeddingsBtn) {
        deleteOldWeddingsBtn.disabled = true;
        deleteOldWeddingsBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang xóa…';
    }

    let done = 0;
    let failed = 0;
    for (const item of stale) {
        const id = item.id || item.weddingId;
        const success = await deleteWeddingById(id, { confirm: false });
        if (success) done += 1;
        else failed += 1;
    }

    await loadPaymentList();
    showToast(
        failed
            ? `Đã xóa ${done} thiệp, lỗi ${failed}.`
            : `Đã xóa ${done} thiệp quá ${WEDDING_STALE_DAYS} ngày.`,
        failed ? "error" : ""
    );

    if (deleteOldWeddingsBtn) {
        deleteOldWeddingsBtn.disabled = false;
    }
}

async function loadPaymentList() {
    if (!paymentList) return;
    paymentList.innerHTML = '<p class="empty-state">Đang tải danh sách thiệp...</p>';

    try {
        const snapshot = await db.collection("weddings").limit(200).get();
        const items = snapshot.docs
            .map(doc => {
                const data = doc.data() || {};
                return {
                    id: doc.id,
                    ...data,
                    weddingId: data.weddingId || doc.id
                };
            })
            .sort((a, b) => {
                // Cũ nhất / stale lên trước để dễ dọn
                const aStale = isWeddingStale(a) ? 0 : 1;
                const bStale = isWeddingStale(b) ? 0 : 1;
                if (aStale !== bStale) return aStale - bStale;
                const aAge = getWeddingAgeDays(a) ?? -1;
                const bAge = getWeddingAgeDays(b) ?? -1;
                if (aAge !== bAge) return bAge - aAge;
                const aPaid = a.payment?.unlocked === true || a.payment?.status === "paid";
                const bPaid = b.payment?.unlocked === true || b.payment?.status === "paid";
                if (aPaid !== bPaid) return aPaid ? 1 : -1;
                return String(a.weddingId || a.id).localeCompare(String(b.weddingId || b.id));
            });
        renderPaymentList(items);
    } catch (error) {
        console.error(error);
        paymentList.innerHTML = '<p class="empty-state error">Không tải được danh sách payment. Kiểm tra Firestore Rules.</p>';
    }
}

async function updateWeddingPaymentById(weddingId, status) {
    if (!weddingId) return;
    const unlocked = status === "paid";
    const id = String(weddingId).trim();

    // Popup xác nhận đẹp
    if (unlocked) {
        const ok = await showAdminConfirm({
            eyebrow: "Thanh toán",
            title: "Xác nhận đã thanh toán?",
            weddingId: id,
            message: "Thiệp sẽ được mở khóa. Khách dùng được link thiệp chính thức.",
            confirmLabel: "Xác nhận đã trả",
            confirmIcon: "bi-check2-circle",
            variant: "success"
        });
        if (!ok) return;
    } else {
        const ok = await showAdminConfirm({
            eyebrow: "Khóa thiệp",
            title: "Khóa lại thiệp này?",
            weddingId: id,
            message: "Link thiệp sẽ không mở được cho khách cho đến khi mở khóa lại.",
            warning: "Chỉ khóa khi cần tạm dừng hoặc thu hồi quyền xem thiệp.",
            confirmLabel: "Khóa thiệp",
            confirmIcon: "bi-lock-fill",
            variant: "lock"
        });
        if (!ok) return;
    }

    try {
        const doc = await db.collection("weddings").doc(weddingId).get();
        const docData = doc.exists ? doc.data() : {};
        const prev = docData.payment || {};
        // Giữ plan/amount đã snapshot — không cho admin unlock ghi đè nhầm gói
        const plan = prev.plan === "multi" || prev.plan === "single"
            ? prev.plan
            : (docData.plan === "multi" ? "multi" : "single");
        const amount = hasStoredAmount(prev.amount)
            ? Number(prev.amount)
            : (plan === "multi"
                ? (getPaymentSettingAmountMulti() ?? getPaymentSettingAmount() ?? 0)
                : (getPaymentSettingAmount() ?? 0));
        const currency = prev.currency || getPaymentSettingCurrency() || "VND";
        const accessToken = prev.accessToken || generateAccessToken();

        const payload = {
            payment: {
                status,
                unlocked,
                plan,
                amount,
                currency,
                accessToken,
                confirmedAt: unlocked ? firebase.firestore.FieldValue.serverTimestamp() : null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        };

        await db.collection("weddings").doc(weddingId).set(payload, { merge: true });

        // Đồng bộ map ?t= + paymentStatus (builder nghe unlock)
        await Promise.all([
            syncWeddingTokenMaps(db, {
                weddingId,
                accessToken,
                editToken: docData.builder?.editToken || currentConfig?.builder?.editToken || ""
            }),
            upsertPaymentStatus(db, weddingId, payload.payment)
        ]);

        if (currentConfig.weddingId === weddingId) {
            currentConfig = mergeConfig(currentConfig, payload);
            updatePreviewLink(weddingId, unlocked ? accessToken : "");
        }
        await loadPaymentList();
        showToast(unlocked ? `Đã mở khóa ${weddingId}.` : `Đã khóa ${weddingId}.`);
    } catch (error) {
        console.error(error);
        showToast("Không cập nhật được payment trong danh sách.", "error");
    }
}

async function handlePaymentListClick(event) {
    const editBtn = event.target.closest("button[data-wedding-edit]");
    if (editBtn) {
        event.preventDefault();
        event.stopPropagation();
        await openWeddingEditor(editBtn.dataset.weddingEdit);
        return;
    }

    const deleteBtn = event.target.closest("button[data-wedding-delete]");
    if (deleteBtn) {
        event.preventDefault();
        event.stopPropagation();
        const id = deleteBtn.dataset.weddingDelete;
        deleteBtn.disabled = true;
        const ok = await deleteWeddingById(id, { confirm: true });
        if (ok) {
            showWeddingListMode();
            await loadPaymentList();
        } else deleteBtn.disabled = false;
        return;
    }

    const planBtn = event.target.closest("button[data-plan-action]");
    if (planBtn) {
        event.preventDefault();
        event.stopPropagation();
        const id = planBtn.dataset.id;
        const plan = planBtn.dataset.planAction;
        planBtn.disabled = true;
        await changeWeddingPlan(id, plan);
        planBtn.disabled = false;
        return;
    }

    const button = event.target.closest("button[data-payment-action]");
    if (!button) return;
    event.stopPropagation();
    const { paymentAction, id } = button.dataset;

    await updateWeddingPaymentById(id, paymentAction);
}

function showWeddingListMode() {
    const listPanel = document.getElementById("weddingListPanel");
    const editPanel = document.getElementById("weddingEditPanel");
    if (listPanel) listPanel.hidden = false;
    if (editPanel) editPanel.hidden = true;
}

function showWeddingEditMode() {
    const listPanel = document.getElementById("weddingListPanel");
    const editPanel = document.getElementById("weddingEditPanel");
    if (listPanel) listPanel.hidden = true;
    if (editPanel) editPanel.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function openWeddingEditor(weddingId) {
    const id = String(weddingId || "").trim();
    if (!id) return;
    setAdminView("weddings", { keepEditor: true });
    showWeddingEditMode();
    const ok = await loadConfigById(id);
    if (!ok) showWeddingListMode();
}

function fillForm(config) {
    currentConfig = mergeConfig(createEmptyAdminConfig(), config || {});
    // Ưu tiên payment đúng theo config đã tải (không merge ảo)
    if (config && Object.prototype.hasOwnProperty.call(config, "payment")) {
        currentConfig.payment = { ...(config.payment || {}) };
    }

    [...form.elements].forEach(field => {
        if (!field.name || field.name === "theme.primaryColorText") return;
        if (field.name === "guests") return; // xử lý riêng
        if (field.name === "plan") return;
        const value = getByPath(currentConfig, field.name);
        field.value = Array.isArray(value) ? value.join("\n") : value ?? "";
    });

    // Gói thiệp + guests
    const plan = currentConfig.payment?.plan === "multi" || currentConfig.plan === "multi"
        || (Array.isArray(currentConfig.guests) && currentConfig.guests.length)
        ? "multi"
        : "single";
    currentConfig.plan = plan;
    if (form.elements.plan) form.elements.plan.value = plan;
    if (form.elements.guests) {
        form.elements.guests.value = Array.isArray(currentConfig.guests)
            ? currentConfig.guests.filter(Boolean).join("\n")
            : "";
    }

    syncColorInputs(currentConfig.theme?.primaryColor || DEFAULT_PRIMARY);
    // Form trống: xóa luôn ô load ID; khi đã tải: đồng bộ weddingId
    loadInput.value = currentConfig.weddingId || "";
    updatePreviewLink(currentConfig.weddingId || "", currentConfig.payment?.accessToken || "");
}

function readForm() {
    const nextConfig = mergeConfig(createEmptyAdminConfig(), currentConfig);

    [...form.elements].forEach(field => {
        if (!field.name || field.name === "theme.primaryColorText") return;
        if (field.name === "guests" || field.name === "plan") return;

        let value = field.value.trim();
        if (field.name === "sectionSubtitles.thanks") {
            value = value.split("\n").map(line => line.trim()).filter(Boolean);
        }

        setByPath(nextConfig, field.name, value);
    });

    nextConfig.theme.primaryColor = form.elements["theme.primaryColorText"].value.trim() || DEFAULT_PRIMARY;
    nextConfig.gallery.photos = Array.from({ length: GALLERY_SIZE }, (_, index) => ({
        src: form.elements[`gallery.photos.${index}.src`].value.trim(),
        alt: form.elements[`gallery.photos.${index}.alt`].value.trim() || `Ảnh cưới ${index + 1}`
    })).filter(photo => photo.src);

    // Plan + guests
    const plan = form.elements.plan?.value === "multi" ? "multi" : "single";
    nextConfig.plan = plan;
    nextConfig.guests = plan === "multi"
        ? String(form.elements.guests?.value || "")
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
        : [];
    nextConfig.payment = {
        ...(nextConfig.payment || {}),
        ...(currentConfig.payment || {}),
        plan
    };

    return nextConfig;
}

function resetMusicForm() {
    musicDocId.value = "";
    musicTitle.value = "";
    musicUrl.value = "";
    musicActive.value = "true";
    saveMusicBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Lưu nhạc';
}

function renderMusicList(items) {
    musicList.textContent = "";

    if (!items.length) {
        musicList.innerHTML = '<p class="empty-state">Chưa có bài nhạc nào. Thêm link Cloudinary ở form bên trên.</p>';
        return;
    }

    items.forEach(item => {
        const row = document.createElement("article");
        row.className = `music-item${item.active === false ? " is-inactive" : ""}`;
        row.innerHTML = `
            <div class="music-item__info">
                <strong>${item.title || item.id}</strong>
                <span>${item.url || ""}</span>
                <em>${item.active === false ? "Đang ẩn" : "Đang hiện"}</em>
            </div>
            <div class="music-item__actions">
                <button type="button" class="ghost small" data-action="edit" data-id="${item.id}"><i class="bi bi-pencil-square"></i> Sửa</button>
                <button type="button" class="ghost small" data-action="toggle" data-id="${item.id}">${item.active === false ? '<i class="bi bi-eye-fill"></i> Hiện' : '<i class="bi bi-eye-slash-fill"></i> Ẩn'}</button>
                <button type="button" class="ghost small danger" data-action="delete" data-id="${item.id}"><i class="bi bi-trash3-fill"></i> Xóa</button>
            </div>
        `;
        musicList.appendChild(row);
    });
}

async function loadMusicLibraryAdmin() {
    try {
        const snapshot = await db.collection("musicLibrary").orderBy("title").get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMusicList(items);
    } catch (error) {
        console.error(error);
        musicList.innerHTML = '<p class="empty-state error">Không tải được thư viện nhạc. Kiểm tra Firestore Rules.</p>';
    }
}

async function saveMusicItem(event) {
    event.preventDefault();

    if (!auth.currentUser) {
        showToast("Bạn cần đăng nhập trước khi lưu nhạc.", "error");
        return;
    }

    const title = musicTitle.value.trim();
    const url = musicUrl.value.trim();
    const active = musicActive.value === "true";

    if (!title || !url) {
        showToast("Nhập tên bài hát và link mp3 trước khi lưu.", "error");
        return;
    }

    const docId = musicDocId.value || slugify(title) || `music-${Date.now()}`;
    saveMusicBtn.disabled = true;
    saveMusicBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang lưu';

    try {
        await db.collection("musicLibrary").doc(docId).set({
            title,
            url,
            active,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        resetMusicForm();
        await loadMusicLibraryAdmin();
        showToast("Đã lưu bài nhạc vào thư viện chung.");
    } catch (error) {
        console.error(error);
        showToast("Lưu nhạc thất bại. Kiểm tra Firestore Rules.", "error");
    } finally {
        saveMusicBtn.disabled = false;
        saveMusicBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Lưu nhạc';
    }
}

async function handleMusicListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;
    const ref = db.collection("musicLibrary").doc(id);

    try {
        if (action === "edit") {
            const doc = await ref.get();
            if (!doc.exists) return;
            const data = doc.data();
            musicDocId.value = doc.id;
            musicTitle.value = data.title || "";
            musicUrl.value = data.url || "";
            musicActive.value = data.active === false ? "false" : "true";
            saveMusicBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Cập nhật nhạc';
            musicTitle.focus();
            return;
        }

        if (action === "toggle") {
            const doc = await ref.get();
            if (!doc.exists) return;
            await ref.set({ active: doc.data().active === false }, { merge: true });
            await loadMusicLibraryAdmin();
            showToast("Đã cập nhật trạng thái bài nhạc.");
            return;
        }

        if (action === "delete") {
            if (!window.confirm("Xóa bài nhạc này khỏi thư viện builder?")) return;
            await ref.delete();
            if (musicDocId.value === id) resetMusicForm();
            await loadMusicLibraryAdmin();
            showToast("Đã xóa bài nhạc.");
        }
    } catch (error) {
        console.error(error);
        showToast("Không thao tác được với bài nhạc. Kiểm tra Firestore Rules.", "error");
    }
}

async function loadConfigById(weddingId) {
    try {
        if (!weddingId) {
            fillForm(createEmptyAdminConfig());
            return false;
        }

        const doc = await db.collection("weddings").doc(weddingId).get();
        if (!doc.exists) {
            showToast(`Không tìm thấy weddingId: ${weddingId}.`, "error");
            return false;
        }

        const config = mergeConfig(createEmptyAdminConfig(), { ...doc.data(), weddingId: doc.id });
        fillForm(config);
        showToast("Đã tải config từ Firebase.");
        return true;
    } catch (error) {
        console.error(error);
        showToast("Không tải được config. Kiểm tra đăng nhập và Firestore Rules.", "error");
        return false;
    }
}

async function saveConfig(event) {
    event.preventDefault();
    const config = readForm();

    if (!auth.currentUser) {
        showToast("Bạn cần đăng nhập trước khi lưu.", "error");
        return;
    }

    if (!config.weddingId) {
        showToast("Wedding ID không được để trống.", "error");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang lưu';

    try {
        await db.collection("weddings").doc(config.weddingId).set(config, { merge: true });
        currentConfig = config;
        loadInput.value = config.weddingId;
        updatePreviewLink(config.weddingId, config.payment?.accessToken || "");
        showToast("Đã lưu config lên Firebase.");
    } catch (error) {
        console.error(error);
        showToast("Lưu thất bại. Kiểm tra Firestore Rules đã cho phép email admin ghi chưa.", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Lưu Firebase';
    }
}

async function login(event) {
    event.preventDefault();

    try {
        await auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value);
        loginPassword.value = "";
    } catch (error) {
        console.error(error);
        showToast("Đăng nhập thất bại. Kiểm tra email/mật khẩu hoặc đã bật Email/Password Auth chưa.", "error");
    }
}

function canUseAdmin(user) {
    return isAllowedAdminEmail(user?.email);
}

function setAdminView(viewId, { keepEditor = false } = {}) {
    let next = String(viewId || "weddings").trim();
    // Tương thích hash cũ
    if (next === "wedding") next = "weddings";
    if (!["weddings", "music", "payment"].includes(next)) next = "weddings";

    document.querySelectorAll("[data-admin-view]").forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.adminView === next);
    });
    document.querySelectorAll("[data-admin-nav]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.adminNav === next);
    });

    if (next === "weddings") {
        if (!keepEditor) showWeddingListMode();
        loadPaymentList();
    }

    if (window.location.hash !== `#${next}`) {
        window.history.replaceState({}, "", `#${next}`);
    }
}

function showLoggedOut() {
    if (loginPanel) loginPanel.classList.remove("is-hidden");
    if (adminApp) {
        adminApp.classList.add("is-hidden");
        adminApp.hidden = true;
    }
}

async function showLoggedIn(user) {
    if (!canUseAdmin(user)) {
        showToast("Email này chưa được thêm vào danh sách admin trong code.", "error");
        await auth.signOut();
        return;
    }

    if (loginPanel) loginPanel.classList.add("is-hidden");
    if (adminApp) {
        adminApp.classList.remove("is-hidden");
        adminApp.hidden = false;
        adminApp.style.display = "";
    }
    if (accountEmail) accountEmail.textContent = user.email || "";

    const hashView = (window.location.hash || "").replace("#", "").trim();
    setAdminView(hashView || "weddings");

    try {
        await Promise.all([loadMusicLibraryAdmin(), loadPaymentSettingsAdmin(), loadPaymentList()]);
    } catch (error) {
        console.error(error);
        showToast("Một phần dữ liệu admin chưa tải được.", "error");
    }

    if (!hasLoadedInitialConfig) {
        const params = new URLSearchParams(window.location.search);
        const weddingParam = params.get("wedding") || "";
        try {
            if (weddingParam) {
                await openWeddingEditor(weddingParam);
            }
        } catch (error) {
            console.error(error);
        }
        hasLoadedInitialConfig = true;
    }
}

function initEvents() {
    loginForm.addEventListener("submit", login);
    logoutBtn.addEventListener("click", () => auth.signOut());

    const goList = () => {
        showWeddingListMode();
        setAdminView("weddings");
        loadPaymentList();
    };
    document.getElementById("backToWeddingListBtn")?.addEventListener("click", goList);
    document.getElementById("backToWeddingListBtn2")?.addEventListener("click", goList);

    document.querySelectorAll("[data-admin-nav]").forEach(button => {
        button.addEventListener("click", () => setAdminView(button.dataset.adminNav));
    });
    window.addEventListener("hashchange", () => {
        setAdminView(window.location.hash.replace("#", "") || "weddings");
    });

    form?.addEventListener("submit", saveConfig);
    musicForm?.addEventListener("submit", saveMusicItem);
    paymentSettingsForm?.addEventListener("submit", savePaymentSettings);
    paymentList?.addEventListener("click", handlePaymentListClick);
    refreshPaymentListBtn?.addEventListener("click", loadPaymentList);
    deleteOldWeddingsBtn?.addEventListener("click", () => {
        deleteStaleWeddings();
    });

    document.getElementById("planChangeConfirmBtn")?.addEventListener("click", () => {
        confirmPlanChangeFromModal();
    });
    document.getElementById("planChangeModal")?.addEventListener("click", event => {
        if (event.target.closest("[data-close-plan-modal]")) {
            closePlanChangeModal();
        }
    });
    document.getElementById("adminConfirmOkBtn")?.addEventListener("click", () => {
        closeAdminConfirm(true);
    });
    document.getElementById("adminConfirmModal")?.addEventListener("click", event => {
        if (event.target.closest("[data-close-confirm-modal]")) {
            closeAdminConfirm(false);
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        const planModal = document.getElementById("planChangeModal");
        const confirmModal = document.getElementById("adminConfirmModal");
        if (confirmModal && !confirmModal.hidden) {
            closeAdminConfirm(false);
            return;
        }
        if (planModal && !planModal.hidden) closePlanChangeModal();
    });
    document.getElementById("deleteLoadedWeddingBtn")?.addEventListener("click", async () => {
        const id = String(loadInput?.value || currentConfig.weddingId || "").trim();
        if (!id) {
            showToast("Chưa có weddingId để xóa.", "error");
            return;
        }
        const ok = await deleteWeddingById(id, { confirm: true });
        if (ok) {
            showWeddingListMode();
            await loadPaymentList();
        }
    });
    musicList?.addEventListener("click", handleMusicListClick);
    resetMusicBtn?.addEventListener("click", resetMusicForm);
    resetBtn?.addEventListener("click", () => loadConfigById(""));
    form?.elements?.["weddingId"]?.addEventListener("input", event => updatePreviewLink(event.target.value.trim()));
    document.getElementById("mediaConcept")?.addEventListener("change", event => {
        currentConfig = readForm();
        activeMediaConcept = event.target.value || DEFAULT_MEDIA_CONCEPT;
        fillForm(currentConfig);
    });
    form?.elements?.["theme.primaryColor"]?.addEventListener("input", event => syncColorInputs(event.target.value));
    form?.elements?.["theme.primaryColorText"]?.addEventListener("input", event => {
        if (/^#[0-9a-fA-F]{6}$/.test(event.target.value.trim())) {
            syncColorInputs(event.target.value.trim());
        }
    });
}

try {
    fillGalleryFields();
    fillForm(createEmptyAdminConfig());
    initEvents();
} catch (error) {
    console.error("Admin init error:", error);
}

auth.onAuthStateChanged(user => {
    if (user) {
        showLoggedIn(user).catch(error => {
            console.error("Admin login UI error:", error);
            showToast("Không mở được giao diện admin. Xem console để biết chi tiết.", "error");
        });
    } else {
        showLoggedOut();
        hasLoadedInitialConfig = false;
    }
});
