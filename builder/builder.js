import { wedding as fallbackWedding } from "../js/config.js";
import { db } from "../js/firebase.js";
import {
    getBuildableSections,
    getPreviewTargetMap,
    getDefaultBlocksConfig,
    blocksFromBuilderFields,
    populateBuilderBlockSelects,
    normalizeSkinId,
    getSectionSkinOptions
} from "../js/modules/index.js";
import {
    generateAccessToken,
    isWeddingPaymentUnlocked,
    buildInvitationUrlFromBase,
    normalizeGuestNames
} from "../js/utils/access.js";
import {
    extractProvinceFromAddress,
    formatPosterLocation
} from "../js/utils/location.js";
import { BRAND_PRIMARY } from "../js/brand.js";
import {
    sanitizePaymentForBuilderSave,
    generateEditToken,
    generateOrderCode,
    normalizeOrderCode,
    normalizeEditToken,
    getEditTokenFromUrl,
    canOpenBuilderEdit,
    canUploadMore,
    recordUpload,
    assertUploadBlob,
    syncWeddingTokenMaps,
    upsertPaymentStatus,
    upsertOrderCodeMap,
    upsertEditSession,
    loadEditSession,
    extractCloudinaryPublicId
} from "../js/utils/security.js";

/** public_id Cloudinary đã upload trong phiên (ghi vào builder.cloudinaryPublicIds) */
let sessionCloudinaryPublicIds = [];

const form = document.getElementById("builderForm");
const frame = document.getElementById("previewFrame");
const statusEl = document.getElementById("status");
const weddingIdInput = document.getElementById("weddingId");
const musicSelect = document.getElementById("musicSelect");
const previewBtn = document.getElementById("previewBtn");
const saveBtn = document.getElementById("saveBtn");
const resultLinks = document.getElementById("resultLinks");
const invitationLink = document.getElementById("invitationLink");
const editLink = document.getElementById("editLink");
const saveModal = document.getElementById("saveModal");
const modalInvitationLink = document.getElementById("modalInvitationLink");
const modalEditLink = document.getElementById("modalEditLink");
const copyInvitationLink = document.getElementById("copyInvitationLink");
const copyEditLink = document.getElementById("copyEditLink");
const paymentModal = document.getElementById("paymentModal");
const paymentQrPreview = document.getElementById("paymentQrPreview");
const paymentAmountText = document.getElementById("paymentAmountText");
const paymentOrderCodeText = document.getElementById("paymentOrderCodeText");
const copyPaymentOrderCodeBtn = document.getElementById("copyPaymentOrderCode");
const paymentReceiverRow = document.getElementById("paymentReceiverRow");
const paymentReceiverText = document.getElementById("paymentReceiverText");
const paymentMessageText = document.getElementById("paymentMessageText");
const paymentEditLink = document.getElementById("paymentEditLink");
const paymentContactLink = document.getElementById("paymentContactLink");
const copyPaymentEditLink = document.getElementById("copyPaymentEditLink");
const builderGalleryFields = document.getElementById("builderGalleryFields");
const mapPickerModal = document.getElementById("mapPickerModal");
const mapPickerCanvas = document.getElementById("mapPickerCanvas");
const saveMapPointBtn = document.getElementById("saveMapPointBtn");
const mapPickerSearchInput = document.getElementById("mapPickerSearchInput");
const mapPickerSearchBtn = document.getElementById("mapPickerSearchBtn");
const mapPickerSearchResults = document.getElementById("mapPickerSearchResults");
const mapPickerHint = document.getElementById("mapPickerHint");
const mapPickerTitle = document.getElementById("mapPickerTitle");
const qrCropModal = document.getElementById("qrCropModal");
const qrCropCanvas = document.getElementById("qrCropCanvas");
const qrCropZoom = document.getElementById("qrCropZoom");
const qrCropX = document.getElementById("qrCropX");
const qrCropY = document.getElementById("qrCropY");
const qrCropSaveBtn = document.getElementById("qrCropSaveBtn");
const qrCropModalTitle = document.getElementById("qrCropModalTitle");

const WEDDING_QUERY_KEY = "wedding";
const PREVIEW_STATE_KEY = "weddingBuilderPreviewState";
const GALLERY_SIZE = 7;
const DEFAULT_PAYMENT_SETTINGS = {
    amount: 99000,       // gói 1 link
    amountMulti: 129000, // gói nhiều link theo khách
    currency: "VND",
    contactUrl: "",
    qrImage: "",
    receiver: "",
    message: "Vui lòng chuyển khoản đúng số tiền với nội dung là MÃ GIAO DỊCH. Hệ thống sẽ tự mở khóa thiệp sau khi nhận được (SePay). Nếu quá lâu chưa mở, hãy liên hệ admin."
};

// Cloudinary chỉ cho upload trực tiếp từ trình duyệt bằng unsigned upload preset.
// Vào Cloudinary > Settings > Upload > Upload presets, tạo preset unsigned tên "wedding_unsigned".
const CLOUDINARY_CLOUD_NAME = "dndcuen0";
const CLOUDINARY_UPLOAD_PRESET = "wedding_unsigned";
const CLOUDINARY_FOLDER_PREFIX = "wedding-builder";

let editingWeddingId = "";
let originalEditingWeddingId = "";
let loadedWeddingConfig = clone(fallbackWedding);
let remoteMusicLibrary = [];
let paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
let unsubscribeWeddingPayment = null;
let missingWeddingConfig = false;
let activeMapPickerRole = "";
let mapPicker = null;
let mapPickerMarker = null;
let selectedMapPoint = null;
let activeQrField = "";
const qrCropStates = new Map();
/** QR đã cắt chờ upload: fieldName → { blob, objectUrl, sourceHash, previousRemoteUrl } */
const pendingQrBlobs = new Map();
/** Ảnh media chờ upload: fieldName → { blob, objectUrl, sourceHash, previousRemoteUrl } */
const pendingMediaBlobs = new Map();
/** fieldName → SHA-256 file gốc (+ crop QR) đã gắn với URL Cloudinary hiện tại */
let mediaFingerprints = {};
/** fieldName → URL https Cloudinary gần nhất (để reuse khi chọn lại đúng ảnh) */
const lastRemoteMediaUrls = new Map();

const QR_FIELD_LABELS = {
    giftGroomQr: "QR chú rể",
    giftBrideQr: "QR cô dâu"
};

const QR_PENDING_FIELDS = ["giftGroomQr", "giftBrideQr"];

const MEDIA_FIELD_NAMES = [
    "coverPosterImage",
    "previewImage",
    "aboutImage",
    "timelineImage",
    "countdownImage",
    "groomAvatar",
    "brideAvatar",
    ...Array.from({ length: GALLERY_SIZE }, (_, index) => `galleryPhoto${index + 1}`)
];

/**
 * Ô upload nào cần hiện theo concept block hiện tại.
 * About: c1/c4 → ảnh đôi; c2/c3 → avatar.
 * Timeline: c1–c3 cần ảnh; c4–c7 CSS ẩn img → không upload.
 * Cover/poster/preview/countdown/gallery: luôn cần ảnh.
 */
function isMediaFieldActive(fieldName) {
    const name = String(fieldName || "").trim();
    if (!name) return false;

    if (name === "aboutImage") {
        const opts = getSectionSkinOptions("about", getSelectedBlockValue("blockAbout"));
        return Boolean(opts.usesAboutCardImage);
    }
    if (name === "groomAvatar" || name === "brideAvatar") {
        const opts = getSectionSkinOptions("about", getSelectedBlockValue("blockAbout"));
        return Boolean(opts.usesPersonAvatars);
    }
    if (name === "timelineImage") {
        const opts = getSectionSkinOptions("timeline", getSelectedBlockValue("blockTimeline"));
        // default true nếu skin chưa khai báo
        return opts.usesCeremonyImage !== false;
    }

    // cover, poster, preview, countdown, gallery — luôn dùng ảnh
    return true;
}

/** Ẩn/hiện .media-item theo concept; hủy blob pending của field ẩn (không upload). */
function syncMediaUploadVisibility() {
    document.querySelectorAll("[data-media-field]").forEach(item => {
        const field = item.dataset.mediaField || "";
        const active = isMediaFieldActive(field);
        item.hidden = !active;
        item.classList.toggle("is-media-inactive", !active);
        item.setAttribute("aria-hidden", active ? "false" : "true");

        if (!active) {
            // Bỏ blob chờ upload + khôi phục URL remote (tránh field dính blob: đã revoke → Lưu fail)
            if (pendingMediaBlobs.has(field)) {
                const pending = pendingMediaBlobs.get(field);
                const restore = String(pending?.previousRemoteUrl || lastRemoteMediaUrls.get(field) || "").trim();
                clearPendingMedia(field);
                setField(field, restore);
                showMediaReady(field, restore);
            } else if (isBlobUrl(readField(field))) {
                const restore = String(lastRemoteMediaUrls.get(field) || "").trim();
                setField(field, restore);
                showMediaReady(field, restore);
            }
            const fileInput = item.querySelector(`[data-upload-target="${field}"]`);
            if (fileInput) fileInput.value = "";
        }
    });

    const hint = document.getElementById("mediaConceptHint");
    if (hint) {
        const aboutOpts = getSectionSkinOptions("about", getSelectedBlockValue("blockAbout"));
        const timelineOpts = getSectionSkinOptions("timeline", getSelectedBlockValue("blockTimeline"));
        const bits = [];
        if (aboutOpts.usesAboutCardImage) {
            bits.push("Đôi nét: ảnh đôi (1 ảnh)");
        } else if (aboutOpts.usesPersonAvatars) {
            bits.push("Đôi nét: avatar chú rể & cô dâu");
        }
        if (timelineOpts.usesCeremonyImage === false) {
            bits.push("Lịch trình concept này không dùng ảnh — đã ẩn ô upload");
        }
        hint.textContent = bits.length
            ? `${bits.join(". ")}. Chỉ hiện ô cần thiết để tránh upload thừa.`
            : "Chỉ hiện ô upload ảnh mà concept đang chọn thực sự dùng — tránh upload thừa lên Cloudinary.";
    }
}

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

function removeVietnamese(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
}


function getDisplayName(value) {
    const words = String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    return words[words.length - 1] || "";
}

function slugify(value) {
    return removeVietnamese(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function getYear(date) {
    return String(date || new Date().getFullYear()).slice(0, 4);
}

function formatDisplayDate(dateValue) {
    const [year, month, day] = String(dateValue || "").split("-");
    if (!year || !month || !day) {
        return "";
    }

    return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
}

function toDateInputValue(dateValue) {
    const value = String(dateValue || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const [day, month, year] = value.split(/[./-]/);
    if (!day || !month || !year) {
        return "";
    }

    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatMealTime(dateValue, timeValue) {
    const time = String(timeValue || "").trim();
    const date = formatDisplayDate(dateValue);

    return [time, date].filter(Boolean).join(" • ");
}

function splitMealTime(value) {
    const [time = "", date = ""] = String(value || "").split("•").map(part => part.trim());
    return {
        time,
        date: toDateInputValue(date)
    };
}

function getProvinceFromLocation(value) {
    // Ô input builder: chỉ tỉnh/TP (bỏ legacy ", VIỆT NAM" nếu có)
    const fromFormat = extractProvinceFromAddress(String(value || "").replace(/,?\s*VIỆT\s*NAM\s*$/i, ""));
    if (fromFormat) return fromFormat;
    return String(value || "")
        .replace(/,?\s*VIỆT\s*NAM\s*$/i, "")
        .trim();
}

/** Resolve tỉnh/TP lưu Firebase: field riêng → extract address → fallback config */
function resolveHouseLocationInput(data, houseKey, addressField, locationField) {
    const explicit = readText(data, locationField);
    if (explicit) return formatPosterLocation(explicit) || explicit;

    const fromAddress = formatPosterLocation(readText(data, addressField));
    if (fromAddress) return fromAddress;

    return formatPosterLocation(fallbackWedding.ceremony?.[houseKey]?.location) || "";
}

function readText(data, name) {
    return String(data.get(name) || "").trim();
}

function buildWeddingId(data) {
    return [
        slugify(getDisplayName(data.get("groomNickname"))),
        slugify(getDisplayName(data.get("brideNickname"))),
        getYear(data.get("date"))
    ].filter(Boolean).join("-");
}

function getWeddingIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get(WEDDING_QUERY_KEY)?.trim() || "";
}

function setControlValue(name, value) {
    const field = form.elements[name];
    if (field && value !== undefined && value !== null) {
        field.value = value;
    }
}

function normalizeMusicItem(item, sourceHint = "") {
    const url = String(item?.url || "").trim();
    if (!url) return null;

    const isRemote = /^(https?:)?\/\//i.test(url) || /res\.cloudinary\.com/i.test(url);
    const source = item?.source || sourceHint || (isRemote ? "cloudinary" : "local");

    return {
        title: String(item?.title || item?.name || url).trim(),
        url,
        source
    };
}

/**
 * Gộp nhạc local (js/config.js + folder music/) + collection Firebase musicLibrary.
 * Không đọc musicLibrary gắn trên doc thiệp (field thừa / snapshot cũ).
 */
function getMusicLibrary() {
    const localItems = (Array.isArray(fallbackWedding.musicLibrary) ? fallbackWedding.musicLibrary : [])
        .map(item => normalizeMusicItem(item, "local"))
        .filter(Boolean);

    const remoteItems = remoteMusicLibrary
        .map(item => normalizeMusicItem(item, "cloudinary"))
        .filter(Boolean);

    const seen = new Set();
    const result = [];

    [...localItems, ...remoteItems].forEach(item => {
        if (seen.has(item.url)) return;
        seen.add(item.url);
        result.push(item);
    });

    return result;
}

function appendMusicGroup(select, label, items) {
    if (!items.length) return;

    const group = document.createElement("optgroup");
    group.label = label;
    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item.url;
        option.textContent = item.title;
        group.appendChild(option);
    });
    select.appendChild(group);
}

function populateMusicOptions(config = loadedWeddingConfig) {
    if (!musicSelect) return;

    const currentMusic = String(config.music || fallbackWedding.music || "").trim();
    const library = getMusicLibrary();
    const localItems = library.filter(item => item.source === "local");
    const remoteItems = library.filter(item => item.source !== "local");
    const hasCurrentMusic = library.some(item => item.url === currentMusic);

    musicSelect.innerHTML = "";

    appendMusicGroup(musicSelect, "Nhạc local (music/)", localItems);
    appendMusicGroup(musicSelect, "Nhạc Cloudinary / thư viện admin", remoteItems);

    if (currentMusic && !hasCurrentMusic) {
        const option = document.createElement("option");
        option.value = currentMusic;
        option.textContent = "Nhạc hiện tại (custom)";
        musicSelect.prepend(option);
    }

    if (!musicSelect.options.length) {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "Chưa có bài nhạc";
        musicSelect.appendChild(empty);
    }

    musicSelect.value = currentMusic;
    // Nếu value không khớp (path relative/absolute), chọn option gần nhất
    if (currentMusic && musicSelect.value !== currentMusic) {
        const match = Array.from(musicSelect.options).find(opt =>
            opt.value === currentMusic
            || opt.value.endsWith(currentMusic)
            || currentMusic.endsWith(opt.value)
        );
        if (match) musicSelect.value = match.value;
    }
}

async function loadMusicLibrary() {
    try {
        const snapshot = await db.collection("musicLibrary").orderBy("title").get();
        remoteMusicLibrary = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.active !== false && item.url);
    } catch (error) {
        console.warn("Khong tai duoc musicLibrary tu Firebase, dung danh sach local.", error);
        remoteMusicLibrary = [];
    }

    populateMusicOptions(loadedWeddingConfig);
}

function setStatus(message, type = "") {
    // Truncate to avoid long Cloudinary JSON breaking builder layout
    const text = String(message || "").trim();
    statusEl.textContent = text.length > 220 ? `${text.slice(0, 220)}…` : text;
    statusEl.dataset.type = type;
}

function setBuilderLocked(locked) {
    Array.from(form.elements).forEach(control => {
        control.disabled = locked;
    });
}

function showMissingWeddingMessage(weddingId) {
    frame.srcdoc = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px;background:#fff8ee;color:#6f4d2d;font-family:Arial,sans-serif;text-align:center}div{max-width:300px}h1{margin:0 0 10px;font-size:22px}p{margin:0;line-height:1.55}</style></head><body><div><h1>Không tìm thấy thiệp</h1><p>Wedding ID <strong>${weddingId}</strong> chưa tồn tại trên Firebase. Vui lòng kiểm tra lại link sửa thiệp.</p></div></body></html>`;
}

function markWeddingMissing(weddingId) {
    missingWeddingConfig = true;
    setBuilderLocked(true);
    if (resultLinks) resultLinks.hidden = true;
    showMissingWeddingMessage(weddingId);
    setStatus(`Khong tim thay weddingId: ${weddingId}. Vui long kiem tra lai link sua thiep.`, "error");
}

function markWeddingEditable() {
    missingWeddingConfig = false;
    setBuilderLocked(false);
    // Bật form lại rồi áp khóa gói (nếu đã lưu nháp / đã paid)
    syncInvitePlanUI();
}

function getWeddingAccessToken(config = loadedWeddingConfig) {
    return String(config?.payment?.accessToken || "").trim();
}

function buildInvitationUrl(weddingId, accessToken = getWeddingAccessToken(), guestIndex = null) {
    return buildInvitationUrlFromBase(new URL("../", window.location.href).href, {
        accessToken,
        weddingId,
        guestIndex
    });
}

function readGuestNamesFromForm() {
    return normalizeGuestNames(readField("guestNames") || getField("guestNames")?.value || "");
}

function getSelectedInvitePlan() {
    const checked = form?.querySelector?.('input[name="invitePlan"]:checked');
    return checked?.value === "multi" ? "multi" : "single";
}

/**
 * Khóa gói thiệp khi:
 * - Đã lưu nháp Firebase (có wedding id edit), hoặc
 * - Đã paid/unlocked
 * Lần đầu tạo thiệp (chưa có id) vẫn chọn tự do.
 * Admin đổi gói trên trang admin.
 */
function isInvitePlanLocked(config = loadedWeddingConfig) {
    if (missingWeddingConfig) return true;
    if (isPaymentUnlocked(config)) return true;
    // Đã từng lưu / mở link sửa → không cho đổi gói nữa
    if (originalEditingWeddingId || editingWeddingId) return true;
    return false;
}

/**
 * Gói đã chốt (ưu tiên payment.plan snapshot lúc lưu nháp/paid).
 * Không đọc radio form khi đã khóa.
 */
function getLockedInvitePlan(config = loadedWeddingConfig) {
    const paidPlan = config?.payment?.plan;
    if (paidPlan === "multi" || paidPlan === "single") return paidPlan;
    if (config?.plan === "multi" || config?.plan === "single") return config.plan;
    return getSelectedInvitePlan();
}

/** Gói hiệu lực khi lưu: đã khóa → gói chốt; chưa khóa → radio form. */
function getEffectiveInvitePlan(config = loadedWeddingConfig) {
    if (isInvitePlanLocked(config)) return getLockedInvitePlan(config);
    return getSelectedInvitePlan();
}

function setInvitePlan(plan) {
    const value = plan === "multi" ? "multi" : "single";
    const input = form?.querySelector?.(`input[name="invitePlan"][value="${value}"]`);
    if (input) input.checked = true;
    syncInvitePlanUI();
}

function formatPlanPriceLabel(amount, currency = "VND") {
    const value = Number(amount);
    if (Number.isNaN(value)) return "Liên hệ";
    return `${new Intl.NumberFormat("vi-VN").format(value)} ${currency || "VND"}`;
}

function getPlanAmountFromSettings(plan = getSelectedInvitePlan()) {
    const currency = paymentSettings.currency || "VND";
    if (plan === "multi") {
        if (hasPaymentAmount({ amount: paymentSettings.amountMulti })) {
            return { amount: Number(paymentSettings.amountMulti), currency };
        }
        // fallback amountMulti chưa cấu hình → amount single hoặc default
        if (hasPaymentAmount(paymentSettings)) {
            return { amount: Number(paymentSettings.amount), currency };
        }
        return { amount: DEFAULT_PAYMENT_SETTINGS.amountMulti, currency };
    }
    if (hasPaymentAmount(paymentSettings)) {
        return { amount: Number(paymentSettings.amount), currency };
    }
    return { amount: DEFAULT_PAYMENT_SETTINGS.amount, currency };
}

function updatePlanPriceLabels() {
    const singleEl = document.getElementById("planPriceSingle");
    const multiEl = document.getElementById("planPriceMulti");
    const single = getPlanAmountFromSettings("single");
    const multi = getPlanAmountFromSettings("multi");
    if (singleEl) singleEl.textContent = formatPlanPriceLabel(single.amount, single.currency);
    if (multiEl) multiEl.textContent = formatPlanPriceLabel(multi.amount, multi.currency);
}

function syncInvitePlanUI() {
    const locked = isInvitePlanLocked();
    const plan = locked ? getLockedInvitePlan() : getSelectedInvitePlan();
    const paid = isPaymentUnlocked();

    // Đã chốt gói: ép radio + disable
    if (locked) {
        const lockedInput = form?.querySelector?.(`input[name="invitePlan"][value="${plan}"]`);
        if (lockedInput) lockedInput.checked = true;
    }

    form?.querySelectorAll?.('input[name="invitePlan"]').forEach(input => {
        input.disabled = locked;
    });

    const panel = document.getElementById("guestNamesPanel");
    if (panel) {
        panel.hidden = plan !== "multi";
    }

    const lockHint = document.getElementById("invitePlanLockHint");
    if (lockHint) {
        lockHint.hidden = !locked;
        if (locked) {
            if (paid) {
                lockHint.textContent = plan === "multi"
                    ? "Gói nhiều link đã thanh toán — không đổi gói trên builder. Liên hệ admin nếu cần."
                    : "Gói 1 link đã thanh toán — không nâng lên nhiều link trên builder. Liên hệ admin nếu cần nâng cấp.";
            } else {
                lockHint.textContent = plan === "multi"
                    ? "Gói nhiều link đã lưu nháp — không đổi gói. Liên hệ admin nếu cần đổi sang 1 link."
                    : "Gói 1 link đã lưu nháp — không đổi sang nhiều link. Liên hệ admin nếu cần nâng cấp.";
            }
        }
    }

    // Gói single đã chốt: khóa textarea khách (tránh lách multi)
    const guestTa = getField("guestNames");
    if (guestTa) {
        const lockGuests = locked && plan === "single";
        guestTa.readOnly = lockGuests;
        guestTa.disabled = lockGuests;
    }

    updatePlanPriceLabels();
}

function getGuestsForLinks(config = loadedWeddingConfig) {
    // Chỉ gói multi (hiệu lực) mới có link theo tên
    const plan = getEffectiveInvitePlan(config);
    if (plan !== "multi") return [];
    const fromForm = readGuestNamesFromForm();
    if (fromForm.length) return fromForm;
    return normalizeGuestNames(config?.guests);
}

function getLoadedEditToken(config = loadedWeddingConfig) {
    return normalizeEditToken(config?.builder?.editToken);
}

function buildEditUrl(weddingId, editToken = getLoadedEditToken()) {
    // URL: ?wedding= + ?e=editToken (nếu có) — tránh dính ?t= payment
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set(WEDDING_QUERY_KEY, weddingId);
    const token = normalizeEditToken(editToken);
    if (token) url.searchParams.set("e", token);
    return url.toString();
}

function applyLink(anchor, url) {
    if (!anchor) {
        return;
    }

    anchor.href = url;
    anchor.textContent = url;
}

function getShareUrls(weddingId, accessToken = getWeddingAccessToken(), guestIndex = null, editToken = getLoadedEditToken()) {
    return {
        invitationUrl: buildInvitationUrl(weddingId, accessToken, guestIndex),
        editUrl: buildEditUrl(weddingId, editToken)
    };
}

function renderGuestInvitationLinks(container, weddingId, accessToken, guests) {
    if (!container) return;
    container.textContent = "";

    const list = normalizeGuestNames(guests);
    if (!list.length) {
        container.hidden = true;
        return;
    }

    container.hidden = false;
    container.classList.add("guest-links--compact");

    // Header: số lượng + copy all
    const head = document.createElement("div");
    head.className = "guest-links__head";
    const title = document.createElement("p");
    title.className = "guest-links__title";
    title.textContent = `${list.length} link khách`;
    const copyAllBtn = document.createElement("button");
    copyAllBtn.type = "button";
    copyAllBtn.className = "guest-links__copy-all";
    copyAllBtn.innerHTML = '<i class="bi bi-clipboard-check"></i> Copy all';
    const allText = list
        .map((name, index) => `${name}\t${buildInvitationUrl(weddingId, accessToken, index)}`)
        .join("\n");
    copyAllBtn.dataset.copyUrl = allText;
    head.append(title, copyAllBtn);
    container.appendChild(head);

    // Danh sách gọn: # | tên | mở | copy — cuộn trong khung cố định
    const scroller = document.createElement("div");
    scroller.className = "guest-links__scroll";

    list.forEach((name, index) => {
        const url = buildInvitationUrl(weddingId, accessToken, index);
        const row = document.createElement("div");
        row.className = "guest-links__row";

        const num = document.createElement("span");
        num.className = "guest-links__num";
        num.textContent = String(index + 1);

        const nameEl = document.createElement("span");
        nameEl.className = "guest-links__name";
        nameEl.textContent = name;
        nameEl.title = url;

        const actions = document.createElement("div");
        actions.className = "guest-links__actions";

        const openBtn = document.createElement("a");
        openBtn.className = "guest-links__icon-btn";
        openBtn.href = url;
        openBtn.target = "_blank";
        openBtn.rel = "noopener noreferrer";
        openBtn.title = "Mở link";
        openBtn.setAttribute("aria-label", `Mở link ${name}`);
        openBtn.innerHTML = '<i class="bi bi-box-arrow-up-right"></i>';

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "guest-links__icon-btn";
        copyBtn.dataset.copyUrl = url;
        copyBtn.title = "Copy link";
        copyBtn.setAttribute("aria-label", `Copy link ${name}`);
        copyBtn.innerHTML = '<i class="bi bi-copy"></i>';

        actions.append(openBtn, copyBtn);
        row.append(num, nameEl, actions);
        scroller.appendChild(row);
    });

    container.appendChild(scroller);
}

function updateResultLinks(weddingId, accessToken = getWeddingAccessToken()) {
    if (!weddingId || !resultLinks || !editLink) {
        return;
    }

    const guests = getGuestsForLinks();
    const { invitationUrl, editUrl } = getShareUrls(
        weddingId,
        accessToken,
        guests.length ? 0 : null
    );

    // Link chung (không ?g=) = Quý khách
    const generalUrl = buildInvitationUrl(weddingId, accessToken, null);
    applyLink(invitationLink, generalUrl);
    applyLink(editLink, editUrl);
    applyLink(modalInvitationLink, generalUrl);
    applyLink(modalEditLink, editUrl);

    const modalGeneralInviteLink = document.getElementById("modalGeneralInviteLink");
    if (modalGeneralInviteLink) {
        modalGeneralInviteLink.href = generalUrl;
    }
    const copyGeneralInviteLink = document.getElementById("copyGeneralInviteLink");
    if (copyGeneralInviteLink) {
        copyGeneralInviteLink.dataset.copyUrl = generalUrl;
    }

    renderGuestInvitationLinks(document.getElementById("guestLinksList"), weddingId, accessToken, guests);
    renderGuestInvitationLinks(document.getElementById("modalGuestLinksList"), weddingId, accessToken, guests);

    // Có list khách → ẩn card “Link thiệp chung” to; chỉ còn list + 1 dòng link chung gọn
    const singleInviteCard = document.getElementById("modalSingleInviteCard");
    const generalGuestCard = document.getElementById("modalGeneralGuestCard");
    const hasGuests = guests.length > 0;
    if (singleInviteCard) {
        singleInviteCard.hidden = hasGuests;
        singleInviteCard.style.display = hasGuests ? "none" : "";
    }
    if (generalGuestCard) {
        generalGuestCard.hidden = !hasGuests;
        generalGuestCard.style.display = hasGuests ? "" : "none";
    }
    if (invitationLink) {
        invitationLink.hidden = hasGuests;
        invitationLink.style.display = hasGuests ? "none" : "";
    }

    resultLinks.hidden = false;
}

function hasPaymentAmount(source = {}) {
    return source.amount !== undefined && source.amount !== null && source.amount !== "";
}

/** Ưu tiên amount snapshot trên wedding.payment; không có thì theo gói (single/multi). */
function resolvePaymentAmountSource(config = loadedWeddingConfig) {
    const weddingPayment = config?.payment || {};
    if (hasPaymentAmount(weddingPayment)) {
        return {
            amount: Number(weddingPayment.amount),
            currency: weddingPayment.currency || paymentSettings.currency || "VND"
        };
    }
    const plan = weddingPayment.plan || config?.plan || getSelectedInvitePlan();
    return getPlanAmountFromSettings(plan);
}

function formatPaymentAmount(source) {
    const resolved = source && hasPaymentAmount(source)
        ? { amount: Number(source.amount), currency: source.currency || "VND" }
        : resolvePaymentAmountSource();

    if (!resolved || Number.isNaN(resolved.amount)) return "Chưa cấu hình số tiền";
    return new Intl.NumberFormat("vi-VN").format(resolved.amount) + ` ${resolved.currency || "VND"}`;
}

function isPaymentUnlocked(config = loadedWeddingConfig) {
    return isWeddingPaymentUnlocked(config.payment);
}

function hidePaymentModal() {
    if (!paymentModal) return;
    paymentModal.hidden = true;
    document.body.classList.remove("modal-open");
}

function getOrderCode(config = loadedWeddingConfig) {
    return normalizeOrderCode(config?.payment?.orderCode)
        || normalizeOrderCode(config?.orderCode)
        || "";
}

function showPaymentModal(weddingId) {
    if (!paymentModal || !weddingId) return;
    if (saveModal) saveModal.hidden = true;
    if (resultLinks) resultLinks.hidden = true;

    const { editUrl } = getShareUrls(weddingId);
    const orderCode = getOrderCode() || "—";
    if (paymentOrderCodeText) paymentOrderCodeText.textContent = orderCode;
    // Số tiền theo payment của wedding này (đã snapshot lúc lưu), không đọc settings live
    paymentAmountText.textContent = formatPaymentAmount(resolvePaymentAmountSource(loadedWeddingConfig));
    const baseMsg = paymentSettings.message || DEFAULT_PAYMENT_SETTINGS.message;
    paymentMessageText.textContent = orderCode && orderCode !== "—"
        ? `${baseMsg} Mã của bạn: ${orderCode}.`
        : baseMsg;

    const autoStatus = document.getElementById("paymentAutoStatus");
    if (autoStatus) {
        autoStatus.hidden = false;
        autoStatus.innerHTML = [
            '<i class="bi bi-arrow-repeat payment-auto-status__spin" aria-hidden="true"></i>',
            "<span>Đang chờ hệ thống xác nhận (SePay). Giữ nguyên nội dung CK = mã giao dịch ở trên.",
            " Khi nhận đúng số tiền, thiệp sẽ <strong>tự mở khóa</strong> — không cần F5.</span>"
        ].join(" ");
    }

    applyLink(paymentEditLink, editUrl);

    if (paymentSettings.contactUrl) {
        paymentContactLink.href = paymentSettings.contactUrl;
        paymentContactLink.textContent = paymentSettings.contactUrl;
    } else {
        paymentContactLink.href = "#";
        paymentContactLink.textContent = "Chưa có link liên hệ";
    }

    if (paymentSettings.qrImage) {
        paymentQrPreview.src = paymentSettings.qrImage;
        paymentQrPreview.hidden = false;
    } else {
        paymentQrPreview.removeAttribute("src");
        paymentQrPreview.hidden = true;
    }

    if (paymentSettings.receiver) {
        paymentReceiverText.textContent = paymentSettings.receiver;
        paymentReceiverRow.hidden = false;
    } else {
        paymentReceiverText.textContent = "";
        paymentReceiverRow.hidden = true;
    }

    paymentModal.hidden = false;
    document.body.classList.add("modal-open");
    // Bắt đầu nghe unlock (SePay webhook → paymentStatus)
    listenWeddingPayment(weddingId);
}

function showUnlockedLinks(weddingId, accessToken = getWeddingAccessToken()) {
    hidePaymentModal();
    updateResultLinks(weddingId, accessToken);
    showSaveModal(weddingId);
}

function buildPendingPayment(weddingId) {
    const current = loadedWeddingConfig.payment || {};
    if (current.unlocked === true || current.status === "paid") {
        // Đã thanh toán: KHÓA plan + amount
        const lockedPlan = current.plan === "multi" || current.plan === "single"
            ? current.plan
            : getLockedInvitePlan();
        return {
            ...current,
            plan: lockedPlan,
            orderCode: normalizeOrderCode(current.orderCode) || generateOrderCode(),
            amount: current.amount,
            currency: current.currency || paymentSettings.currency || "VND",
            accessToken: current.accessToken || generateAccessToken(),
            unlocked: true,
            status: current.status === "locked" ? "locked" : "paid"
        };
    }

    // Nháp / chờ TT: nếu gói đã chốt (đã lưu trước) giữ plan+amount; lần đầu snapshot theo form
    const planLocked = isInvitePlanLocked();
    const plan = planLocked ? getLockedInvitePlan() : getSelectedInvitePlan();
    const priced = getPlanAmountFromSettings(plan);
    // Giữ amount đã snapshot nếu gói không đổi
    const keepAmount = planLocked
        && hasPaymentAmount(current)
        && (current.plan === plan || !current.plan);

    return {
        status: "pending",
        unlocked: false,
        plan,
        orderCode: normalizeOrderCode(current.orderCode) || generateOrderCode(),
        amount: keepAmount ? Number(current.amount) : priced.amount,
        currency: keepAmount
            ? (current.currency || priced.currency || "VND")
            : (priced.currency || "VND"),
        accessToken: current.accessToken || generateAccessToken(),
        weddingId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function applyPaymentSnapshot(payment = {}, weddingId = "") {
    if (!payment || typeof payment !== "object") return;
    loadedWeddingConfig = {
        ...loadedWeddingConfig,
        payment: { ...(loadedWeddingConfig.payment || {}), ...payment },
        plan: payment.plan || loadedWeddingConfig.plan
    };
    syncInvitePlanUI();
    if (payment.unlocked === true || payment.status === "paid") {
        setStatus(`Da mo khoa thiep: ${weddingId}`, "success");
        showUnlockedLinks(weddingId, payment.accessToken || "");
    }
}

function listenWeddingPayment(weddingId) {
    if (unsubscribeWeddingPayment) {
        unsubscribeWeddingPayment();
        unsubscribeWeddingPayment = null;
    }
    if (!weddingId) return;

    // Ưu tiên paymentStatus (public) — nháp có editToken có thể không get được weddings/{id}
    const unsubStatus = db.collection("paymentStatus").doc(weddingId).onSnapshot(
        doc => {
            if (!doc.exists) return;
            applyPaymentSnapshot(doc.data() || {}, weddingId);
        },
        error => console.warn("[builder] paymentStatus listen:", error)
    );

    // Fallback: listen wedding.payment (legacy / paid / admin rules)
    const unsubWedding = db.collection("weddings").doc(weddingId).onSnapshot(
        doc => {
            if (!doc.exists) return;
            const data = doc.data() || {};
            if (data.payment) applyPaymentSnapshot(data.payment, weddingId);
        },
        error => {
            // permission-denied với nháp có editToken là bình thường
            if (error?.code !== "permission-denied") {
                console.warn("[builder] wedding payment listen:", error);
            }
        }
    );

    unsubscribeWeddingPayment = () => {
        try { unsubStatus(); } catch (_) { /* ignore */ }
        try { unsubWedding(); } catch (_) { /* ignore */ }
    };
}

async function loadPaymentSettings() {
    try {
        const doc = await db.collection("settings").doc("payment").get();
        paymentSettings = {
            ...DEFAULT_PAYMENT_SETTINGS,
            ...(doc.exists ? doc.data() : {})
        };
    } catch (error) {
        console.warn("Khong tai duoc cau hinh thanh toan, dung mac dinh.", error);
        paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
    }
    updatePlanPriceLabels();
    syncInvitePlanUI();
}

function showSaveModal(weddingId) {
    updateResultLinks(weddingId, getWeddingAccessToken());
    if (!saveModal) {
        return;
    }

    hidePaymentModal();
    saveModal.hidden = false;
    document.body.classList.add("modal-open");

    const guests = getGuestsForLinks();
    const titleEl = document.getElementById("saveModalTitle");
    if (titleEl) {
        titleEl.textContent = guests.length
            ? `Đã tạo ${guests.length} link thiệp theo khách mời`
            : "Vui lòng lưu lại link thiệp";
    }
}

function hideSaveModal() {
    if (!saveModal) {
        return;
    }

    saveModal.hidden = true;
    document.body.classList.remove("modal-open");
}

async function copyText(value, button) {
    try {
        await navigator.clipboard.writeText(value);
        if (button) {
            const original = button.innerHTML;
            button.innerHTML = '<i class="bi bi-check-lg"></i> Da copy';
            window.setTimeout(() => { button.innerHTML = original; }, 1400);
        }
    } catch (error) {
        console.error(error);
        setStatus("Khong copy duoc link, hay copy thu cong.", "error");
    }
}

function syncUrlForEdit(weddingId, editToken = getLoadedEditToken()) {
    if (!weddingId) {
        return;
    }

    const editUrl = buildEditUrl(weddingId, editToken);
    window.history.replaceState({}, "", editUrl);
}


function buildCloudinaryFolder() {
    const data = new FormData(form);
    const weddingId = editingWeddingId || buildWeddingId(data) || "draft";
    return `${CLOUDINARY_FOLDER_PREFIX}/${weddingId}`;
}

function getField(name) {
    const fromElements = form?.elements?.[name];
    // RadioNodeList / multi → lấy phần tử input/hidden đầu
    if (fromElements && typeof fromElements === "object" && "length" in fromElements && !fromElements.tagName) {
        return fromElements[0] || form.querySelector(`[name="${CSS.escape(name)}"]`);
    }
    return fromElements || form?.querySelector(`[name="${CSS.escape(name)}"]`) || null;
}

function readField(name) {
    return String(getField(name)?.value || "").trim();
}

function setField(name, value) {
    const field = getField(name);
    if (field && value !== undefined && value !== null) {
        field.value = value;
        return true;
    }
    console.warn("[builder] setField miss:", name);
    return false;
}

function renderBuilderGalleryFields() {
    if (!builderGalleryFields) return;
    builderGalleryFields.textContent = "";

    Array.from({ length: GALLERY_SIZE }, (_, index) => {
        const number = index + 1;
        const fieldName = `galleryPhoto${number}`;
        const row = document.createElement("div");
        row.className = "builder-gallery-row media-item";
        row.innerHTML = `
            <div class="gallery-index">Ảnh ${number}<input type="hidden" name="${fieldName}"></div>
            <div class="upload-row"><input type="file" accept="image/*" data-upload-target="${fieldName}" tabindex="-1" aria-hidden="true"><button type="button" data-upload-button="${fieldName}"><i class="bi bi-image"></i> Chọn ảnh</button></div>
            <div class="media-ready" data-media-ready="${fieldName}" hidden><img alt="Gallery ${number}" data-media-thumb="${fieldName}"><strong>Đã có ảnh</strong></div>
        `;
        builderGalleryFields.appendChild(row);
    });
}

function getConceptMedia(config, blockName, imageKey) {
    const blockValue = normalizeSkinId(
        config.theme?.blocks?.[blockName] || fallbackWedding.theme?.blocks?.[blockName]
    );
    return config.theme?.concepts?.[blockValue]?.images?.[imageKey] || "";
}

function getSelectedBlockValue(name) {
    return normalizeSkinId(readField(name));
}

function setConceptImage(concepts, conceptName, imageKey, imageUrl) {
    if (!imageUrl) return;
    concepts[conceptName] = mergeConfig(concepts[conceptName] || {}, {
        images: { [imageKey]: imageUrl }
    });
}

function getGalleryPhotosFromForm() {
    return Array.from({ length: GALLERY_SIZE }, (_, index) => {
        const src = readField(`galleryPhoto${index + 1}`);
        return src ? { src, alt: `Ảnh cưới ${index + 1}` } : null;
    }).filter(Boolean);
}

/** Ảnh gallery có src thật (loại slot trống / URL rỗng). */
function filterGalleryPhotosWithSrc(photos) {
    return (Array.isArray(photos) ? photos : [])
        .map(photo => (typeof photo === "string" ? { src: photo, alt: "" } : photo))
        .filter(photo => String(photo?.src || "").trim());
}

/**
 * Ảnh dùng cho preview thiệp:
 * 1) form builder (user vừa chọn)
 * 2) config đã load (Firebase / state)
 * 3) album mẫu config.js — tránh gallery trống trơn
 */
function resolvePreviewGalleryPhotos(customerConfig, config) {
    const fromForm = filterGalleryPhotosWithSrc(customerConfig?.gallery?.photos);
    if (fromForm.length) return fromForm;

    const fromConfig = filterGalleryPhotosWithSrc(config?.gallery?.photos);
    if (fromConfig.length) return fromConfig;

    return filterGalleryPhotosWithSrc(fallbackWedding.gallery?.photos);
}


function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
    });
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.86) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function compressImageFile(file, options = {}) {
    const image = await loadImageFromFile(file);
    const maxSize = options.maxSize || 1800;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(image.src);

    return canvasToBlob(canvas, "image/jpeg", options.quality || 0.86);
}

/**
 * Parse lỗi Cloudinary (JSON dài) thành message ngắn, tránh vỡ layout status.
 */
function formatCloudinaryError(detail) {
    const raw = String(detail || "").trim();
    if (!raw) return "Upload Cloudinary thất bại.";
    try {
        const parsed = JSON.parse(raw);
        const msg = parsed?.error?.message || parsed?.message || raw;
        return String(msg).slice(0, 180);
    } catch {
        return raw.slice(0, 180);
    }
}

/** SHA-256 hex của File/Blob — nhận diện “cùng ảnh” khi user chọn lại. */
async function hashSourceFile(fileOrBlob) {
    if (!fileOrBlob) return "";
    try {
        const buffer = await fileOrBlob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    } catch (error) {
        console.warn("hashSourceFile failed", error);
        // Fallback yếu: name|size|lastModified (File) hoặc size (Blob)
        if (typeof fileOrBlob.name === "string") {
            return `meta:${fileOrBlob.name}|${fileOrBlob.size}|${fileOrBlob.lastModified || 0}`;
        }
        return `meta:blob|${fileOrBlob.size || 0}`;
    }
}

function isRemoteMediaUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
}

/**
 * URL ảnh hiển thị trong builder: chỉ https/http hoặc blob tạm.
 * Path mẫu `img/...` từ fallback thiệp không tính là “đã có ảnh”.
 */
function isDisplayableMediaUrl(value) {
    const url = String(value || "").trim();
    if (!url) return false;
    if (url.startsWith("blob:")) return true;
    return isRemoteMediaUrl(url);
}

function normalizeBuilderMediaUrl(value) {
    const url = String(value || "").trim();
    return isDisplayableMediaUrl(url) ? url : "";
}

function rememberRemoteMediaUrl(fieldName, url) {
    if (fieldName && isRemoteMediaUrl(url)) {
        lastRemoteMediaUrls.set(fieldName, String(url).trim());
    }
}

function getPreviousRemoteUrl(fieldName) {
    const current = readField(fieldName);
    if (isRemoteMediaUrl(current)) return String(current).trim();

    const pendingMedia = pendingMediaBlobs.get(fieldName);
    if (pendingMedia?.previousRemoteUrl) return pendingMedia.previousRemoteUrl;

    const pendingQr = pendingQrBlobs.get(fieldName);
    if (pendingQr?.previousRemoteUrl) return pendingQr.previousRemoteUrl;

    return lastRemoteMediaUrls.get(fieldName) || "";
}

function getStoredFingerprint(fieldName) {
    return String(mediaFingerprints[fieldName] || "").trim();
}

function setStoredFingerprint(fieldName, hash) {
    if (!fieldName || !hash) return;
    mediaFingerprints = {
        ...mediaFingerprints,
        [fieldName]: hash
    };
}

/**
 * Kiểm tra URL Cloudinary còn tồn tại không.
 * Dùng trước khi skip-upload theo fingerprint — tránh reuse URL đã bị xóa trên Cloudinary.
 */
async function remoteMediaUrlAlive(url) {
    const clean = String(url || "").trim();
    if (!isRemoteMediaUrl(clean)) return false;

    try {
        const response = await fetch(clean, {
            method: "GET",
            mode: "cors",
            cache: "no-store"
        });
        if (response.ok) return true;
        if (response.status === 404 || response.status === 401 || response.status === 403) {
            return false;
        }
    } catch {
        // CORS / network — fallback probe bằng Image + cache-bust
    }

    return new Promise(resolve => {
        const img = new Image();
        const timer = window.setTimeout(() => resolve(false), 6000);
        const bust = clean.includes("?") ? `${clean}&_cb=${Date.now()}` : `${clean}?_cb=${Date.now()}`;
        img.onload = () => {
            window.clearTimeout(timer);
            resolve(true);
        };
        img.onerror = () => {
            window.clearTimeout(timer);
            resolve(false);
        };
        img.src = bust;
    });
}

function isQrMediaField(fieldName) {
    return QR_PENDING_FIELDS.includes(fieldName);
}

/**
 * Cùng file đã gắn URL Cloudinary (fingerprint) + URL còn sống → không upload lại.
 * Ảnh khác (hash khác) → false → upload public_id unique.
 */
async function canReusePendingRemote(fieldName, pending) {
    if (!pending?.previousRemoteUrl || !pending?.sourceHash) return false;
    if (!isRemoteMediaUrl(pending.previousRemoteUrl)) return false;
    const knownFp = getStoredFingerprint(fieldName);
    if (!knownFp || knownFp !== pending.sourceHash) return false;
    return remoteMediaUrlAlive(pending.previousRemoteUrl);
}

/** Cache-bust để thumb không hiện ảnh đã xóa còn kẹt trong browser cache. */
function cacheBustMediaUrl(url) {
    const clean = String(url || "").trim();
    if (!isRemoteMediaUrl(clean)) return clean;
    return clean.includes("?") ? `${clean}&_v=${Date.now()}` : `${clean}?_v=${Date.now()}`;
}

function clearStoredFingerprint(fieldName) {
    if (!fieldName || !mediaFingerprints[fieldName]) return;
    const next = { ...mediaFingerprints };
    delete next[fieldName];
    mediaFingerprints = next;
}

/**
 * URL Cloudinary chết phía client: xóa field + thumb + fingerprint
 * để user thấy “chưa có ảnh” và upload lại.
 */
function invalidateBrokenRemoteField(fieldName) {
    if (!fieldName) return;
    setField(fieldName, "");
    lastRemoteMediaUrls.delete(fieldName);
    clearStoredFingerprint(fieldName);
    clearPendingMedia(fieldName);
    clearPendingQr(fieldName);
    if (isQrMediaField(fieldName)) {
        showQrReady(fieldName, "");
    } else {
        showMediaReady(fieldName, "");
    }
}

/**
 * Sau khi load form: kiểm tra mọi URL https còn sống không.
 * Ảnh đã xóa trên Cloudinary → ẩn thumb, bắt chọn lại.
 */
async function verifyAllBuilderRemoteMedia() {
    const fields = [...MEDIA_FIELD_NAMES, ...QR_PENDING_FIELDS];
    const broken = [];

    await Promise.all(fields.map(async fieldName => {
        const url = readField(fieldName);
        if (!isRemoteMediaUrl(url)) return;
        const alive = await remoteMediaUrlAlive(url);
        if (!alive) {
            invalidateBrokenRemoteField(fieldName);
            broken.push(fieldName);
        }
    }));

    if (broken.length) {
        setStatus(
            `Có ${broken.length} ảnh không còn trên Cloudinary (đã xóa/hỏng). Chọn lại ảnh rồi Lưu Firebase.`,
            "error"
        );
    }
    return broken;
}

/**
 * Upload ảnh qua unsigned preset.
 * Luôn dùng public_id UNIQUE — unsigned preset không overwrite an toàn;
 * public_id cố định khiến Cloudinary trả asset CŨ khi đổi ảnh (bug “lưu lại vẫn ảnh cũ”).
 * Ảnh trùng (cùng file) được chặn trước bằng fingerprint + URL còn sống (không gọi upload).
 */
async function uploadBlobToCloudinary(blob, filename, options = {}) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error("Chưa cấu hình CLOUDINARY_CLOUD_NAME hoặc CLOUDINARY_UPLOAD_PRESET trong builder.js");
    }

    const quota = canUploadMore();
    if (!quota.ok) throw new Error(quota.error || "Đã vượt giới hạn upload.");

    const blobCheck = assertUploadBlob(blob);
    if (!blobCheck.ok) throw new Error(blobCheck.error || "File ảnh không hợp lệ.");

    const folder = buildCloudinaryFolder();
    const assetKey = String(options.assetKey || filename || "image")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-zA-Z0-9/_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "image";
    // Unique mỗi lần upload thật (ảnh mới / URL cũ đã xóa)
    const publicId = `${assetKey}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    const data = new FormData();
    data.append("file", blob, filename);
    data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    data.append("folder", folder);
    data.append("public_id", publicId);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: data
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(formatCloudinaryError(detail));
    }

    const result = await response.json();
    const url = String(result.secure_url || "").trim();
    if (!url) throw new Error("Cloudinary không trả về URL ảnh.");
    recordUpload();
    const storedPublicId = String(result.public_id || "").trim()
        || extractCloudinaryPublicId(url);
    if (storedPublicId && !sessionCloudinaryPublicIds.includes(storedPublicId)) {
        sessionCloudinaryPublicIds.push(storedPublicId);
    }
    const version = result.version || Date.now();
    const versioned = url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
    return versioned;
}

function clearPendingMedia(fieldName) {
    const prev = pendingMediaBlobs.get(fieldName);
    if (prev?.objectUrl) {
        try {
            URL.revokeObjectURL(prev.objectUrl);
        } catch {
            /* ignore */
        }
    }
    pendingMediaBlobs.delete(fieldName);
}

function clearAllPendingMedia() {
    [...pendingMediaBlobs.keys()].forEach(clearPendingMedia);
}

function setPendingMediaBlob(fieldName, blob, meta = {}) {
    clearPendingMedia(fieldName);
    const objectUrl = URL.createObjectURL(blob);
    pendingMediaBlobs.set(fieldName, {
        blob,
        objectUrl,
        sourceHash: String(meta.sourceHash || ""),
        previousRemoteUrl: String(meta.previousRemoteUrl || "")
    });
    return objectUrl;
}

function showMediaReady(fieldName, url) {
    const ready = document.querySelector(`[data-media-ready="${fieldName}"]`);
    const thumb = document.querySelector(`[data-media-thumb="${fieldName}"]`);
    if (!ready) return;

    const displayUrl = normalizeBuilderMediaUrl(url);
    if (displayUrl) {
        if (thumb) {
            thumb.onload = null;
            thumb.onerror = () => {
                // Ảnh hỏng / 404 → coi như chưa có (phía user thấy mất thumb)
                if (isRemoteMediaUrl(displayUrl) && readField(fieldName) === displayUrl) {
                    invalidateBrokenRemoteField(fieldName);
                } else {
                    showMediaReady(fieldName, "");
                }
            };
            // Remote: cache-bust để không hiện bản đã xóa còn cache
            thumb.src = isRemoteMediaUrl(displayUrl) ? cacheBustMediaUrl(displayUrl) : displayUrl;
        }
        ready.hidden = false;

        // Verify nền: URL Cloudinary chết → xóa luôn field + fingerprint
        if (isRemoteMediaUrl(displayUrl)) {
            remoteMediaUrlAlive(displayUrl).then(alive => {
                if (!alive && readField(fieldName) === displayUrl) {
                    invalidateBrokenRemoteField(fieldName);
                }
            });
        }
    } else {
        if (thumb) {
            thumb.onload = null;
            thumb.onerror = null;
            thumb.removeAttribute("src");
        }
        ready.hidden = true;
    }
}

/**
 * Chọn ảnh: nén + lưu blob tạm (không Cloudinary). Upload khi Lưu Firebase.
 * Hash file gốc để nếu chọn lại đúng ảnh đã lưu → không upload Cloudinary lần nữa.
 */
/** Đếm stage đang chạy — Lưu Firebase chờ xong để không mất pending. */
let mediaStageInFlight = 0;

async function stageImageForField(fieldName, file, options = {}) {
    const button = document.querySelector(`[data-upload-button="${fieldName}"]`);
    const oldLabel = button?.innerHTML;
    mediaStageInFlight += 1;

    try {
        if (!isMediaFieldActive(fieldName)) {
            setStatus("Concept hiện tại không dùng ô ảnh này — đổi concept block nếu cần upload.", "error");
            return;
        }
        if (!file) {
            setStatus("Chọn file ảnh trước.", "error");
            return;
        }
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang xử lý…';
        }
        const previousRemoteUrl = getPreviousRemoteUrl(fieldName);
        const sourceHash = await hashSourceFile(file);
        const knownFp = getStoredFingerprint(fieldName);

        // Chọn lại đúng file đã có trên Cloudinary → giữ URL, không tạo pending upload
        if (
            previousRemoteUrl &&
            sourceHash &&
            knownFp &&
            knownFp === sourceHash &&
            await remoteMediaUrlAlive(previousRemoteUrl)
        ) {
            clearPendingMedia(fieldName);
            setField(fieldName, previousRemoteUrl);
            showMediaReady(fieldName, previousRemoteUrl);
            rememberRemoteMediaUrl(fieldName, previousRemoteUrl);
            setStatus("");
            refreshPreview(false);
            return;
        }

        const blob = await compressImageFile(file, options);
        if (!blob) throw new Error("Không nén được ảnh.");
        // Ảnh mới (hoặc URL cũ chết) → pending, Lưu Firebase sẽ upload public_id unique
        const objectUrl = setPendingMediaBlob(fieldName, blob, { sourceHash, previousRemoteUrl });
        setField(fieldName, objectUrl);
        showMediaReady(fieldName, objectUrl);
        setStatus("");
        refreshPreview(false);
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Xử lý ảnh thất bại.", "error");
    } finally {
        mediaStageInFlight = Math.max(0, mediaStageInFlight - 1);
        if (button) {
            button.disabled = false;
            button.innerHTML = oldLabel || '<i class="bi bi-image"></i> Chọn ảnh';
        }
    }
}

/**
 * Khôi phục pending từ hidden field blob:… (nếu Map bị mất nhưng form vẫn giữ blob).
 */
async function recoverPendingMediaFromBlobFields() {
    for (const fieldName of MEDIA_FIELD_NAMES) {
        if (pendingMediaBlobs.has(fieldName)) continue;
        const value = readField(fieldName);
        if (!isBlobUrl(value)) continue;
        try {
            const response = await fetch(value);
            const blob = await response.blob();
            if (!blob || !blob.size) continue;
            pendingMediaBlobs.set(fieldName, {
                blob,
                objectUrl: value,
                sourceHash: "",
                previousRemoteUrl: lastRemoteMediaUrls.get(fieldName) || ""
            });
        } catch (error) {
            console.warn("[builder] recover pending failed:", fieldName, error);
        }
    }
}

/**
 * Upload media pending:
 * - Cùng file (fingerprint) + URL còn → giữ URL, không upload (tránh trùng Cloudinary)
 * - File khác → upload public_id unique (không đè public_id cũ)
 */
async function flushPendingMediaUploads() {
    await recoverPendingMediaFromBlobFields();
    // Bỏ pending của field concept không dùng — không upload Cloudinary
    [...pendingMediaBlobs.keys()].forEach(fieldName => {
        if (!isMediaFieldActive(fieldName)) clearPendingMedia(fieldName);
    });
    const fields = [...pendingMediaBlobs.keys()];
    if (!fields.length) return;

    for (const fieldName of fields) {
        const pending = pendingMediaBlobs.get(fieldName);
        if (!pending?.blob) {
            clearPendingMedia(fieldName);
            continue;
        }
        if (!isMediaFieldActive(fieldName)) {
            clearPendingMedia(fieldName);
            continue;
        }

        if (await canReusePendingRemote(fieldName, pending)) {
            clearPendingMedia(fieldName);
            setField(fieldName, pending.previousRemoteUrl);
            showMediaReady(fieldName, pending.previousRemoteUrl);
            rememberRemoteMediaUrl(fieldName, pending.previousRemoteUrl);
            continue;
        }

        setStatus(`Đang upload ảnh ${fieldName}…`);
        const url = await uploadBlobToCloudinary(pending.blob, `${fieldName}.jpg`, {
            assetKey: fieldName
        });
        if (!url || !isRemoteMediaUrl(url)) {
            throw new Error(`Upload ${fieldName} thất bại — không có URL Cloudinary.`);
        }
        if (pending.sourceHash) setStoredFingerprint(fieldName, pending.sourceHash);
        const wrote = setField(fieldName, url);
        if (!wrote) {
            throw new Error(`Không ghi được URL vào form: ${fieldName}`);
        }
        clearPendingMedia(fieldName);
        showMediaReady(fieldName, url);
        rememberRemoteMediaUrl(fieldName, url);
    }
}

function assertNoBlobMediaUrls() {
    const bad = MEDIA_FIELD_NAMES.filter(
        name => isMediaFieldActive(name) && isBlobUrl(readField(name))
    );
    if (bad.length) {
        throw new Error(`Ảnh vẫn còn bản tạm: ${bad.join(", ")}. Thử chọn lại rồi Lưu Firebase.`);
    }
}

function resetQrCropControls() {
    if (qrCropZoom) qrCropZoom.value = "1";
    if (qrCropX) qrCropX.value = "0";
    if (qrCropY) qrCropY.value = "0";
}

function renderQrCrop() {
    const fieldName = activeQrField;
    const state = fieldName ? qrCropStates.get(fieldName) : null;
    const canvas = qrCropCanvas;
    if (!state || !canvas) return;

    const context = canvas.getContext("2d");
    const size = canvas.width;
    const zoom = Number(qrCropZoom?.value || 1);
    const shiftX = Number(qrCropX?.value || 0) / 100;
    const shiftY = Number(qrCropY?.value || 0) / 100;
    const image = state.image;
    const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const drawWidth = image.naturalWidth * baseScale * zoom;
    const drawHeight = image.naturalHeight * baseScale * zoom;
    const maxMoveX = Math.max(0, (drawWidth - size) / 2);
    const maxMoveY = Math.max(0, (drawHeight - size) / 2);
    const x = (size - drawWidth) / 2 + maxMoveX * shiftX;
    const y = (size - drawHeight) / 2 + maxMoveY * shiftY;

    context.fillStyle = "#fff";
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, x, y, drawWidth, drawHeight);
}

function isBlobUrl(value) {
    return String(value || "").startsWith("blob:");
}

function clearPendingQr(fieldName) {
    const prev = pendingQrBlobs.get(fieldName);
    if (prev?.objectUrl) {
        try {
            URL.revokeObjectURL(prev.objectUrl);
        } catch {
            /* ignore */
        }
    }
    pendingQrBlobs.delete(fieldName);
}

function setPendingQrBlob(fieldName, blob, meta = {}) {
    clearPendingQr(fieldName);
    const objectUrl = URL.createObjectURL(blob);
    pendingQrBlobs.set(fieldName, {
        blob,
        objectUrl,
        sourceHash: String(meta.sourceHash || ""),
        previousRemoteUrl: String(meta.previousRemoteUrl || "")
    });
    return objectUrl;
}

function showQrReady(fieldName, url) {
    const ready = document.querySelector(`[data-qr-ready="${fieldName}"]`);
    const thumb = document.querySelector(`[data-qr-thumb="${fieldName}"]`);
    if (!ready) return;

    const displayUrl = normalizeBuilderMediaUrl(url);
    if (displayUrl) {
        if (thumb) {
            thumb.onload = null;
            thumb.onerror = () => {
                if (isRemoteMediaUrl(displayUrl) && readField(fieldName) === displayUrl) {
                    invalidateBrokenRemoteField(fieldName);
                } else {
                    showQrReady(fieldName, "");
                }
            };
            thumb.src = isRemoteMediaUrl(displayUrl) ? cacheBustMediaUrl(displayUrl) : displayUrl;
        }
        ready.hidden = false;
        const title = ready.querySelector("strong");
        if (title) {
            title.textContent = `Đã cắt ${QR_FIELD_LABELS[fieldName] || "QR"}`;
        }

        if (isRemoteMediaUrl(displayUrl)) {
            remoteMediaUrlAlive(displayUrl).then(alive => {
                if (!alive && readField(fieldName) === displayUrl) {
                    invalidateBrokenRemoteField(fieldName);
                }
            });
        }
    } else {
        if (thumb) {
            thumb.onload = null;
            thumb.onerror = null;
            thumb.removeAttribute("src");
        }
        ready.hidden = true;
    }
}

/**
 * Upload QR pending: cùng file+crop + URL còn → giữ; khác → upload unique.
 */
async function flushPendingQrUploads() {
    const fields = QR_PENDING_FIELDS.filter(name => pendingQrBlobs.has(name));
    if (!fields.length) return;

    for (const fieldName of fields) {
        const pending = pendingQrBlobs.get(fieldName);
        if (!pending?.blob) {
            clearPendingQr(fieldName);
            continue;
        }

        if (await canReusePendingRemote(fieldName, pending)) {
            clearPendingQr(fieldName);
            setField(fieldName, pending.previousRemoteUrl);
            showQrReady(fieldName, pending.previousRemoteUrl);
            rememberRemoteMediaUrl(fieldName, pending.previousRemoteUrl);
            continue;
        }

        setStatus(`Đang upload ${QR_FIELD_LABELS[fieldName] || "QR"} lên Cloudinary…`);
        const url = await uploadBlobToCloudinary(pending.blob, `${fieldName}.png`, {
            assetKey: fieldName
        });
        if (!url || !isRemoteMediaUrl(url)) {
            throw new Error(`Upload ${QR_FIELD_LABELS[fieldName] || fieldName} thất bại.`);
        }
        if (pending.sourceHash) setStoredFingerprint(fieldName, pending.sourceHash);
        clearPendingQr(fieldName);
        setField(fieldName, url);
        showQrReady(fieldName, url);
        rememberRemoteMediaUrl(fieldName, url);
    }
}

function openQrCropModal(fieldName) {
    if (!qrCropModal || !fieldName || !qrCropStates.has(fieldName)) return;
    activeQrField = fieldName;
    if (qrCropModalTitle) {
        qrCropModalTitle.textContent = `Căn ${QR_FIELD_LABELS[fieldName] || "QR"} vào khung vuông`;
    }
    resetQrCropControls();
    qrCropModal.hidden = false;
    document.body.classList.add("modal-open");
    renderQrCrop();
}

function closeQrCropModal() {
    if (!qrCropModal) return;
    qrCropModal.hidden = true;
    activeQrField = "";
    document.body.classList.remove("modal-open");
}

async function loadQrFile(fieldName, file) {
    if (!file || !fieldName) return;
    try {
        const image = await loadImageFromFile(file);
        qrCropStates.set(fieldName, { image, file });
        openQrCropModal(fieldName);
        setStatus("");
    } catch (error) {
        console.error(error);
        setStatus("Không đọc được ảnh QR. Thử file khác.", "error");
    }
}

function pickQrFile(fieldName) {
    const input = document.querySelector(`[data-qr-input="${fieldName}"]`);
    if (!input) return;
    input.value = "";
    input.click();
}

async function saveQrFromModal() {
    const fieldName = activeQrField;
    if (!fieldName || !qrCropStates.has(fieldName) || !qrCropCanvas) {
        setStatus("Chọn file QR trước khi lưu.", "error");
        return;
    }

    const oldLabel = qrCropSaveBtn?.innerHTML;
    try {
        if (qrCropSaveBtn) {
            qrCropSaveBtn.disabled = true;
            qrCropSaveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang áp dụng…';
        }
        renderQrCrop();
        const blob = await canvasToBlob(qrCropCanvas, "image/png", 0.95);
        if (!blob) throw new Error("Không tạo được ảnh QR đã cắt.");

        const state = qrCropStates.get(fieldName);
        const sourceFileHash = state?.file ? await hashSourceFile(state.file) : await hashSourceFile(blob);
        const cropSig = `${qrCropZoom?.value || 1}|${qrCropX?.value || 0}|${qrCropY?.value || 0}`;
        const sourceHash = `${sourceFileHash}#${cropSig}`;
        const previousRemoteUrl = getPreviousRemoteUrl(fieldName);
        const knownFp = getStoredFingerprint(fieldName);

        // Cùng file + cùng crop + URL còn → giữ, không pending upload
        if (
            previousRemoteUrl &&
            sourceHash &&
            knownFp &&
            knownFp === sourceHash &&
            await remoteMediaUrlAlive(previousRemoteUrl)
        ) {
            clearPendingQr(fieldName);
            setField(fieldName, previousRemoteUrl);
            showQrReady(fieldName, previousRemoteUrl);
            rememberRemoteMediaUrl(fieldName, previousRemoteUrl);
            closeQrCropModal();
            setStatus("");
            refreshPreview(false);
            return;
        }

        // QR mới / crop khác — pending, Lưu Firebase mới upload
        const objectUrl = setPendingQrBlob(fieldName, blob, { sourceHash, previousRemoteUrl });
        setField(fieldName, objectUrl);
        showQrReady(fieldName, objectUrl);
        closeQrCropModal();
        setStatus("");
        refreshPreview(false);
    } catch (error) {
        console.error(error);
        const message = String(error?.message || "Áp dụng QR thất bại.").slice(0, 180);
        setStatus(message, "error");
    } finally {
        if (qrCropSaveBtn) {
            qrCropSaveBtn.disabled = false;
            qrCropSaveBtn.innerHTML = oldLabel || '<i class="bi bi-check2"></i> Áp dụng QR';
        }
    }
}


function parseLatLngFromMapUrl(value) {
    const text = String(value || "");
    const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };

    const qMatch = text.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };

    return null;
}

function buildCoordinateMapUrl(point) {
    return `https://www.google.com/maps?q=${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

function getDefaultMapCenter(role) {
    const urlPoint = parseLatLngFromMapUrl(readField(role === "bride" ? "brideMapUrl" : "groomMapUrl"));
    if (urlPoint) return urlPoint;
    return { lat: 20.8449, lng: 106.6881 };
}

function getRoleAddressSeed(role) {
    return readField(role === "bride" ? "brideAddress" : "groomAddress");
}

function setMapPickerHint(message) {
    if (mapPickerHint) mapPickerHint.textContent = message;
}

function clearMapSearchResults() {
    if (!mapPickerSearchResults) return;
    mapPickerSearchResults.textContent = "";
    mapPickerSearchResults.hidden = true;
}

function renderMapSearchResults(items) {
    if (!mapPickerSearchResults) return;
    mapPickerSearchResults.textContent = "";
    if (!items.length) {
        mapPickerSearchResults.hidden = true;
        return;
    }

    items.forEach(item => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = item.display_name || `${item.lat}, ${item.lon}`;
        btn.addEventListener("click", () => {
            applyMapSearchResult(item);
        });
        li.appendChild(btn);
        mapPickerSearchResults.appendChild(li);
    });
    mapPickerSearchResults.hidden = false;
}

function applyMapSearchResult(item) {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    setMapPoint({ lat, lng }, 17);
    if (mapPickerSearchInput && item.display_name) {
        mapPickerSearchInput.value = item.display_name;
    }
    clearMapSearchResults();
    setMapPickerHint("Đã nhảy tới địa điểm tìm được. Chỉnh marker nếu cần rồi bấm Lưu điểm này.");
}

async function reverseGeocodeMapPoint(point) {
    if (!point) return "";
    try {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("lat", String(point.lat));
        url.searchParams.set("lon", String(point.lng));
        url.searchParams.set("zoom", "18");
        url.searchParams.set("addressdetails", "0");

        const response = await fetch(url.toString(), {
            headers: { Accept: "application/json" }
        });
        if (!response.ok) return "";
        const data = await response.json();
        return String(data?.display_name || "").trim();
    } catch (error) {
        console.warn("reverse geocode failed", error);
        return "";
    }
}

async function searchMapAddress(query) {
    const q = String(query || "").trim();
    if (!q) {
        setMapPickerHint("Nhập địa chỉ hoặc tên địa điểm để tìm.");
        return;
    }

    if (mapPickerSearchBtn) {
        mapPickerSearchBtn.disabled = true;
        mapPickerSearchBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang tìm…';
    }
    setMapPickerHint("Đang tìm địa điểm…");

    try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "json");
        url.searchParams.set("q", q);
        url.searchParams.set("limit", "6");
        url.searchParams.set("addressdetails", "0");
        // Ưu tiên VN nhưng vẫn cho kết quả ngoài nếu cần
        url.searchParams.set("countrycodes", "vn");
        url.searchParams.set("accept-language", "vi");

        const response = await fetch(url.toString(), {
            headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Tìm địa điểm thất bại.");

        const results = await response.json();
        if (!Array.isArray(results) || !results.length) {
            // Thử lại không giới hạn country nếu không ra kết quả VN
            url.searchParams.delete("countrycodes");
            const retry = await fetch(url.toString(), { headers: { Accept: "application/json" } });
            const retryResults = retry.ok ? await retry.json() : [];
            if (!Array.isArray(retryResults) || !retryResults.length) {
                clearMapSearchResults();
                setMapPickerHint("Không tìm thấy địa điểm. Thử mô tả rõ hơn hoặc click trực tiếp trên bản đồ.");
                return;
            }
            if (retryResults.length === 1) {
                applyMapSearchResult(retryResults[0]);
                return;
            }
            renderMapSearchResults(retryResults);
            setMapPickerHint(`Tìm thấy ${retryResults.length} kết quả — chọn một dòng bên dưới.`);
            return;
        }

        if (results.length === 1) {
            applyMapSearchResult(results[0]);
            return;
        }
        renderMapSearchResults(results);
        setMapPickerHint(`Tìm thấy ${results.length} kết quả — chọn một dòng bên dưới.`);
    } catch (error) {
        console.error(error);
        clearMapSearchResults();
        setMapPickerHint("Không tìm được địa điểm (mạng / dịch vụ bản đồ). Hãy click trực tiếp trên map.");
    } finally {
        if (mapPickerSearchBtn) {
            mapPickerSearchBtn.disabled = false;
            mapPickerSearchBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Tìm';
        }
    }
}

function setMapPoint(point, zoom = 16) {
    selectedMapPoint = point;
    if (!mapPicker) return;

    mapPicker.setView([point.lat, point.lng], zoom);
    if (!mapPickerMarker) {
        mapPickerMarker = window.L.marker([point.lat, point.lng]).addTo(mapPicker);
    } else {
        mapPickerMarker.setLatLng([point.lat, point.lng]);
    }
}

async function handleMapClick(event) {
    const point = { lat: event.latlng.lat, lng: event.latlng.lng };
    setMapPoint(point, mapPicker?.getZoom?.() || 16);
    setMapPickerHint("Đã chọn điểm. Đang lấy tên địa điểm…");
    const label = await reverseGeocodeMapPoint(point);
    if (label && mapPickerSearchInput) {
        mapPickerSearchInput.value = label;
        setMapPickerHint("Đã chọn điểm trên bản đồ. Có thể chỉnh lại ô tìm hoặc bấm Lưu điểm này.");
    } else {
        setMapPickerHint("Đã chọn điểm trên bản đồ. Bấm Lưu điểm này khi xong.");
    }
}

function ensureMapPicker(role) {
    if (!window.L || !mapPickerCanvas) {
        setStatus("Không tải được bản đồ. Hãy dán trực tiếp link chia sẻ Google Maps vào ô Link Maps.", "error");
        return false;
    }

    const center = getDefaultMapCenter(role);
    if (!mapPicker) {
        mapPicker = window.L.map(mapPickerCanvas).setView([center.lat, center.lng], 15);
        const streetLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap"
        }).addTo(mapPicker);
        const satelliteLayer = window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            maxZoom: 19,
            attribution: "Tiles &copy; Esri"
        });
        window.L.control.layers({ "Bản đồ": streetLayer, "Vệ tinh": satelliteLayer }, null, { position: "topright" }).addTo(mapPicker);
        mapPicker.on("click", handleMapClick);
    } else {
        mapPicker.setView([center.lat, center.lng], 15);
    }

    setMapPoint(center, 15);

    window.setTimeout(() => mapPicker.invalidateSize(), 80);
    return true;
}

function openMapPicker(role) {
    activeMapPickerRole = role;
    if (!mapPickerModal) return;
    mapPickerModal.hidden = false;
    document.body.classList.add("modal-open");

    if (mapPickerTitle) {
        mapPickerTitle.textContent = role === "bride"
            ? "Chọn điểm nhà gái trên bản đồ"
            : "Chọn điểm nhà trai trên bản đồ";
    }

    // Prefill ô tìm từ địa chỉ đã nhập (nếu có)
    const seed = getRoleAddressSeed(role);
    if (mapPickerSearchInput) {
        mapPickerSearchInput.value = seed || "";
    }
    clearMapSearchResults();
    setMapPickerHint("Nhập địa chỉ để tìm, hoặc click trực tiếp trên bản đồ rồi bấm Lưu điểm này.");

    if (!ensureMapPicker(role)) {
        closeMapPicker();
        return;
    }

    // Có địa chỉ sẵn → tự tìm 1 lần cho tiện
    if (seed && seed.length >= 6) {
        window.setTimeout(() => searchMapAddress(seed), 120);
    }

    window.setTimeout(() => mapPickerSearchInput?.focus(), 200);
}

function closeMapPicker() {
    if (!mapPickerModal) return;
    mapPickerModal.hidden = true;
    activeMapPickerRole = "";
    clearMapSearchResults();
    document.body.classList.remove("modal-open");
}

function saveSelectedMapPoint() {
    if (!activeMapPickerRole || !selectedMapPoint) {
        setStatus("Hãy click vị trí trên bản đồ hoặc tìm địa điểm trước khi lưu.", "error");
        return;
    }

    const fieldName = activeMapPickerRole === "bride" ? "brideMapUrl" : "groomMapUrl";
    setField(fieldName, buildCoordinateMapUrl(selectedMapPoint));
    closeMapPicker();
    setStatus("Đã lưu link Google Maps theo tọa độ đã chọn.", "success");
    refreshPreview(false);
}

function readBuilderTheme() {
    const data = new FormData(form);
    const weddingId = editingWeddingId || buildWeddingId(data);
    const fieldMap = Object.fromEntries(data.entries());

    weddingIdInput.value = weddingId;

    return {
        weddingId,
        date: data.get("date") || fallbackWedding.date,
        theme: {
            primaryColor: data.get("primaryColor") || BRAND_PRIMARY,
            blocks: {
                ...getDefaultBlocksConfig(),
                ...blocksFromBuilderFields(fieldMap)
            },
            fonts: {
                body: String(data.get("fontBody") || "quicksand").trim(),
                nickname: String(data.get("fontNickname") || "great-vibes").trim()
            }
        }
    };
}

function createCustomerConfig() {
    const data = new FormData(form);
    const builderTheme = readBuilderTheme();
    const groomNickname = readText(data, "groomNickname");
    const brideNickname = readText(data, "brideNickname");

    // Gói hiệu lực: đã paid → khóa theo payment.plan (chống trả 99k rồi lách multi)
    const invitePlan = getEffectiveInvitePlan();
    const guestNames = invitePlan === "multi" ? readGuestNamesFromForm() : [];

    return {
        weddingId: builderTheme.weddingId,
        date: builderTheme.date,
        music: readText(data, "music") || loadedWeddingConfig.music || fallbackWedding.music,
        plan: invitePlan,
        guests: guestNames,
        cover: {
            ...(loadedWeddingConfig.cover || fallbackWedding.cover || {}),
            guest: "Quý khách"
        },
        theme: {
            ...builderTheme.theme,
            concepts: (() => {
                const concepts = {};
                // Media: đọc thẳng field (readField) — tránh FormData miss sau setField
                if (isMediaFieldActive("coverPosterImage")) {
                    setConceptImage(
                        concepts,
                        getSelectedBlockValue("blockCover"),
                        "cover",
                        readField("coverPosterImage")
                    );
                }
                if (isMediaFieldActive("countdownImage")) {
                    setConceptImage(
                        concepts,
                        getSelectedBlockValue("blockCountdown"),
                        "countdown",
                        readField("countdownImage")
                    );
                }
                return concepts;
            })()
        },
        poster: {
            image: isMediaFieldActive("coverPosterImage") ? readField("coverPosterImage") : ""
        },
        preview: {
            image: isMediaFieldActive("previewImage") ? readField("previewImage") : ""
        },
        aboutCard: {
            // Chỉ ghi khi concept about dùng ảnh đôi (1/4)
            image: isMediaFieldActive("aboutImage") ? readField("aboutImage") : ""
        },
        groom: {
            nickname: groomNickname,
            fullName: readText(data, "groomFullName"),
            father: readText(data, "groomFather"),
            mother: readText(data, "groomMother"),
            avatar: isMediaFieldActive("groomAvatar") ? readField("groomAvatar") : ""
        },
        bride: {
            nickname: brideNickname,
            fullName: readText(data, "brideFullName"),
            father: readText(data, "brideFather"),
            mother: readText(data, "brideMother"),
            avatar: isMediaFieldActive("brideAvatar") ? readField("brideAvatar") : ""
        },
        sections: {
            ...(loadedWeddingConfig.sections || fallbackWedding.sections || {}),
            saveDate: readText(data, "titleSaveDate")
                || loadedWeddingConfig.sections?.saveDate
                || fallbackWedding.sections?.saveDate,
            about: readText(data, "titleAbout")
                || loadedWeddingConfig.sections?.about
                || fallbackWedding.sections?.about,
            timeline: readText(data, "titleTimeline")
                || loadedWeddingConfig.sections?.timeline
                || fallbackWedding.sections?.timeline,
            gallery: readText(data, "titleGallery")
                || loadedWeddingConfig.sections?.gallery
                || fallbackWedding.sections?.gallery,
            wish: readText(data, "titleWish")
                || loadedWeddingConfig.sections?.wish
                || fallbackWedding.sections?.wish,
            gift: {
                ...(loadedWeddingConfig.sections?.gift || fallbackWedding.sections?.gift || {}),
                title: readText(data, "titleGift")
                    || loadedWeddingConfig.sections?.gift?.title
                    || fallbackWedding.sections?.gift?.title
            },
            countdown: {
                ...(loadedWeddingConfig.sections?.countdown || fallbackWedding.sections?.countdown || {}),
                title: readText(data, "titleCountdown")
                    || loadedWeddingConfig.sections?.countdown?.title
                    || fallbackWedding.sections?.countdown?.title
            },
            thanks: {
                ...(loadedWeddingConfig.sections?.thanks || fallbackWedding.sections?.thanks || {}),
                title: readText(data, "titleThanks")
                    || loadedWeddingConfig.sections?.thanks?.title
                    || fallbackWedding.sections?.thanks?.title
            }
        },
        sectionSubtitles: {
            saveDate: readText(data, "subtitleSaveDate"),
            about: readText(data, "subtitleAbout"),
            timeline: readText(data, "subtitleTimeline"),
            gallery: readText(data, "subtitleGallery"),
            wish: readText(data, "subtitleWish"),
            gift: readText(data, "subtitleGift"),
            countdown: readText(data, "subtitleCountdown"),
            thanks: readText(data, "subtitleThanks")
        },
        ceremony: {
            image: isMediaFieldActive("timelineImage") ? readField("timelineImage") : "",
            bride: {
                title: readText(data, "brideCeremonyTitle")
                    || loadedWeddingConfig.ceremony?.bride?.title
                    || fallbackWedding.ceremony?.bride?.title
                    || "LỄ VU QUY",
                time: readText(data, "brideCeremonyTime"),
                address: readText(data, "brideAddress"),
                location: resolveHouseLocationInput(data, "bride", "brideAddress", "brideLocation"),
                mapUrl: readText(data, "brideMapUrl"),
                meal: {
                    title: readText(data, "brideMealTitle")
                        || loadedWeddingConfig.ceremony?.bride?.meal?.title
                        || fallbackWedding.ceremony?.bride?.meal?.title
                        || "BỮA CƠM THÂN MẬT",
                    time: formatMealTime(data.get("brideMealDate"), data.get("brideMealTime"))
                }
            },
            groom: {
                title: readText(data, "groomCeremonyTitle")
                    || loadedWeddingConfig.ceremony?.groom?.title
                    || fallbackWedding.ceremony?.groom?.title
                    || "LỄ THÀNH HÔN",
                time: readText(data, "groomCeremonyTime"),
                address: readText(data, "groomAddress"),
                location: resolveHouseLocationInput(data, "groom", "groomAddress", "groomLocation"),
                mapUrl: readText(data, "groomMapUrl"),
                meal: {
                    title: readText(data, "groomMealTitle")
                        || loadedWeddingConfig.ceremony?.groom?.meal?.title
                        || fallbackWedding.ceremony?.groom?.meal?.title
                        || "BỮA CƠM THÂN MẬT",
                    time: formatMealTime(data.get("groomMealDate"), data.get("groomMealTime"))
                }
            }
        },
        gallery: {
            photos: getGalleryPhotosFromForm()
        },
        gift: {
            groom: {
                qr: readField("giftGroomQr"),
                bank: readText(data, "giftGroomBank"),
                accountName: readText(data, "giftGroomAccountName"),
                accountNumber: readText(data, "giftGroomAccountNumber")
            },
            bride: {
                qr: readField("giftBrideQr"),
                bank: readText(data, "giftBrideBank"),
                accountName: readText(data, "giftBrideAccountName"),
                accountNumber: readText(data, "giftBrideAccountNumber")
            }
        },
        builder: {
            groomNickname,
            brideNickname,
            // Fingerprint ảnh đã upload — để Lưu Firebase lần sau bỏ qua nếu chọn lại đúng file
            mediaFingerprints: { ...mediaFingerprints }
        }
    };
}


function removeEmptyMediaFields(config) {
    const next = clone(config);
    const removeIfBlank = (object, key) => {
        if (object && String(object[key] || "").trim() === "") {
            delete object[key];
        }
    };

    removeIfBlank(next.poster, "image");
    removeIfBlank(next.preview, "image");
    removeIfBlank(next.aboutCard, "image");
    removeIfBlank(next.groom, "avatar");
    removeIfBlank(next.bride, "avatar");
    removeIfBlank(next.ceremony, "image");
    removeIfBlank(next.ceremony?.bride, "mapUrl");
    removeIfBlank(next.ceremony?.groom, "mapUrl");
    ["qr", "bank", "accountName", "accountNumber"].forEach(key => {
        removeIfBlank(next.gift?.groom, key);
        removeIfBlank(next.gift?.bride, key);
    });

    if (!next.gallery?.photos?.length) delete next.gallery;
    if (!Array.isArray(next.guests) || !next.guests.length) {
        next.guests = [];
    }

    if (!next.poster?.image) delete next.poster;
    if (!next.preview?.image) delete next.preview;
    if (!next.aboutCard?.image) delete next.aboutCard;
    if (!Object.keys(next.gift?.groom || {}).length && !Object.keys(next.gift?.bride || {}).length) delete next.gift;

    return next;
}

function createPreviewConfig() {
    const config = clone(loadedWeddingConfig || fallbackWedding);
    const customerConfig = removeEmptyMediaFields(createCustomerConfig());

    return {
        ...config,
        ...customerConfig,
        plan: getEffectiveInvitePlan({ ...config, ...customerConfig, payment: loadedWeddingConfig.payment })
            || customerConfig.plan
            || config.plan
            || "single",
        guests: Array.isArray(customerConfig.guests) ? customerConfig.guests : (config.guests || []),
        cover: {
            ...(config.cover || {}),
            ...(customerConfig.cover || {}),
            guest: "Quý khách"
        },
        theme: {
            ...(config.theme || {}),
            ...(customerConfig.theme || {}),
            blocks: {
                ...(config.theme?.blocks || {}),
                ...(customerConfig.theme?.blocks || {})
            },
            fonts: {
                ...(config.theme?.fonts || {}),
                ...(customerConfig.theme?.fonts || {})
            },
            concepts: mergeConfig(config.theme?.concepts || {}, customerConfig.theme?.concepts || {})
        },
        poster: {
            ...(config.poster || {}),
            ...(customerConfig.poster || {})
        },
        preview: {
            ...(config.preview || {}),
            ...(customerConfig.preview || {})
        },
        aboutCard: {
            ...(config.aboutCard || {}),
            ...(customerConfig.aboutCard || {})
        },
        groom: {
            ...(config.groom || {}),
            ...(customerConfig.groom || {})
        },
        bride: {
            ...(config.bride || {}),
            ...(customerConfig.bride || {})
        },
        sectionSubtitles: {
            ...(config.sectionSubtitles || {}),
            ...(customerConfig.sectionSubtitles || {})
        },
        gallery: {
            ...(config.gallery || {}),
            ...(customerConfig.gallery || {}),
            // Form > config > album mẫu (tránh preview gallery trống khi chưa upload)
            photos: resolvePreviewGalleryPhotos(customerConfig, config)
        },
        gift: {
            ...(config.gift || {}),
            groom: {
                ...(config.gift?.groom || {}),
                ...(customerConfig.gift?.groom || {})
            },
            bride: {
                ...(config.gift?.bride || {}),
                ...(customerConfig.gift?.bride || {})
            }
        },
        ceremony: {
            ...(config.ceremony || {}),
            ...(customerConfig.ceremony || {}),
            bride: {
                ...(config.ceremony?.bride || {}),
                ...(customerConfig.ceremony?.bride || {}),
                meal: {
                    ...(config.ceremony?.bride?.meal || {}),
                    ...(customerConfig.ceremony?.bride?.meal || {})
                }
            },
            groom: {
                ...(config.ceremony?.groom || {}),
                ...(customerConfig.ceremony?.groom || {}),
                meal: {
                    ...(config.ceremony?.groom?.meal || {}),
                    ...(customerConfig.ceremony?.groom?.meal || {})
                }
            }
        }
    };
}


async function findAvailableWeddingId(baseWeddingId) {
    const base = String(baseWeddingId || "").trim();
    if (!base) return "";

    if (originalEditingWeddingId) {
        return originalEditingWeddingId;
    }

    for (let index = 0; index < 50; index += 1) {
        const candidate = index === 0 ? base : `${base}-${index + 1}`;
        try {
            const doc = await db.collection("weddings").doc(candidate).get();
            if (!doc.exists) return candidate;
        } catch (error) {
            // permission-denied: doc nháp có editToken (không public get) → coi như đã tồn tại
            if (error?.code === "permission-denied") continue;
            throw error;
        }
    }

    return `${base}-${Date.now()}`;
}

function applyWeddingIdToPayload(payload, weddingId) {
    return {
        ...payload,
        weddingId,
        builder: {
            ...(payload.builder || {}),
            generatedBaseWeddingId: payload.weddingId
        }
    };
}

function createSavePayload() {
    return removeEmptyMediaFields(createCustomerConfig());
}

function fillBuilderForm(config = {}) {
    const theme = config.theme || {};
    const blocks = theme.blocks || {};
    const fonts = theme.fonts || {};
    const builder = config.builder || {};

    editingWeddingId = config.weddingId || editingWeddingId;
    weddingIdInput.value = editingWeddingId;

    setControlValue("groomNickname", builder.groomNickname || config.groom?.nickname);
    setControlValue("brideNickname", builder.brideNickname || config.bride?.nickname);
    // Ưu tiên gói đã thanh toán (payment.plan), rồi plan/guests trên doc
    const invitePlan = (config.payment?.plan === "multi" || config.payment?.plan === "single")
        ? config.payment.plan
        : (config.plan === "multi" || normalizeGuestNames(config.guests).length ? "multi" : "single");
    setInvitePlan(invitePlan);
    setControlValue(
        "guestNames",
        invitePlan === "multi" ? normalizeGuestNames(config.guests).join("\n") : ""
    );
    syncInvitePlanUI();
    setControlValue("groomFullName", config.groom?.fullName);
    setControlValue("groomFather", config.groom?.father);
    setControlValue("groomMother", config.groom?.mother);
    setControlValue("brideFullName", config.bride?.fullName);
    setControlValue("brideFather", config.bride?.father);
    setControlValue("brideMother", config.bride?.mother);
    setControlValue("groomAddress", config.ceremony?.groom?.address);
    setControlValue("brideAddress", config.ceremony?.bride?.address);
    setControlValue(
        "groomLocation",
        getProvinceFromLocation(config.ceremony?.groom?.location)
            || extractProvinceFromAddress(config.ceremony?.groom?.address)
    );
    setControlValue(
        "brideLocation",
        getProvinceFromLocation(config.ceremony?.bride?.location)
            || extractProvinceFromAddress(config.ceremony?.bride?.address)
    );
    setControlValue("groomMapUrl", config.ceremony?.groom?.mapUrl);
    setControlValue("brideMapUrl", config.ceremony?.bride?.mapUrl);
    setControlValue("date", config.date);

    setControlValue("primaryColor", theme.primaryColor || BRAND_PRIMARY);
    populateMusicOptions(config);
    setControlValue("music", config.music);
    clearAllPendingMedia();
    clearPendingQr("giftGroomQr");
    clearPendingQr("giftBrideQr");
    lastRemoteMediaUrls.clear();
    mediaFingerprints = {
        ...(config.builder?.mediaFingerprints && typeof config.builder.mediaFingerprints === "object"
            ? config.builder.mediaFingerprints
            : {})
    };

    // Chỉ nhận URL thật (https/blob). Bỏ path mẫu img/... từ thiệp fallback.
    const coverUrl = normalizeBuilderMediaUrl(
        config.poster?.image || getConceptMedia(config, "cover", "cover") || ""
    );
    const previewUrl = normalizeBuilderMediaUrl(config.preview?.image || "");
    const aboutUrl = normalizeBuilderMediaUrl(config.aboutCard?.image || "");
    const timelineUrl = normalizeBuilderMediaUrl(config.ceremony?.image || "");
    const countdownUrl = normalizeBuilderMediaUrl(getConceptMedia(config, "countdown", "countdown") || "");
    const groomAvatarUrl = normalizeBuilderMediaUrl(config.groom?.avatar || "");
    const brideAvatarUrl = normalizeBuilderMediaUrl(config.bride?.avatar || "");
    const giftGroomQrUrl = normalizeBuilderMediaUrl(config.gift?.groom?.qr || "");
    const giftBrideQrUrl = normalizeBuilderMediaUrl(config.gift?.bride?.qr || "");

    setControlValue("coverPosterImage", coverUrl);
    showMediaReady("coverPosterImage", coverUrl);
    rememberRemoteMediaUrl("coverPosterImage", coverUrl);
    setControlValue("previewImage", previewUrl);
    showMediaReady("previewImage", previewUrl);
    rememberRemoteMediaUrl("previewImage", previewUrl);
    setControlValue("aboutImage", aboutUrl);
    showMediaReady("aboutImage", aboutUrl);
    rememberRemoteMediaUrl("aboutImage", aboutUrl);
    setControlValue("timelineImage", timelineUrl);
    showMediaReady("timelineImage", timelineUrl);
    rememberRemoteMediaUrl("timelineImage", timelineUrl);
    setControlValue("countdownImage", countdownUrl);
    showMediaReady("countdownImage", countdownUrl);
    rememberRemoteMediaUrl("countdownImage", countdownUrl);
    setControlValue("groomAvatar", groomAvatarUrl);
    showMediaReady("groomAvatar", groomAvatarUrl);
    rememberRemoteMediaUrl("groomAvatar", groomAvatarUrl);
    setControlValue("brideAvatar", brideAvatarUrl);
    showMediaReady("brideAvatar", brideAvatarUrl);
    rememberRemoteMediaUrl("brideAvatar", brideAvatarUrl);

    setControlValue("giftGroomQr", giftGroomQrUrl);
    showQrReady("giftGroomQr", giftGroomQrUrl);
    rememberRemoteMediaUrl("giftGroomQr", giftGroomQrUrl);
    setControlValue("giftGroomBank", config.gift?.groom?.bank);
    setControlValue("giftGroomAccountName", config.gift?.groom?.accountName);
    setControlValue("giftGroomAccountNumber", config.gift?.groom?.accountNumber);
    setControlValue("giftBrideQr", giftBrideQrUrl);
    showQrReady("giftBrideQr", giftBrideQrUrl);
    rememberRemoteMediaUrl("giftBrideQr", giftBrideQrUrl);
    setControlValue("giftBrideBank", config.gift?.bride?.bank);
    setControlValue("giftBrideAccountName", config.gift?.bride?.accountName);
    setControlValue("giftBrideAccountNumber", config.gift?.bride?.accountNumber);

    Array.from({ length: GALLERY_SIZE }, (_, index) => {
        const fieldName = `galleryPhoto${index + 1}`;
        setControlValue(fieldName, "");
        showMediaReady(fieldName, "");
    });
    // Không fallback album mẫu — chỉ ảnh user đã lưu trên wedding này
    const galleryPhotos = Array.isArray(config.gallery?.photos) ? config.gallery.photos : [];
    galleryPhotos.slice(0, GALLERY_SIZE).forEach((photo, index) => {
        const fieldName = `galleryPhoto${index + 1}`;
        const src = normalizeBuilderMediaUrl(photo?.src || "");
        setControlValue(fieldName, src);
        showMediaReady(fieldName, src);
        rememberRemoteMediaUrl(fieldName, src);
    });
    getBuildableSections().forEach(section => {
        setControlValue(section.builderField, blocks[section.id] || section.defaultSkin);
    });
    setControlValue("fontBody", fonts.body);
    setControlValue("fontNickname", fonts.nickname);

    const sections = config.sections || {};
    setControlValue("titleSaveDate", sections.saveDate);
    setControlValue("titleAbout", sections.about);
    setControlValue("titleTimeline", sections.timeline);
    setControlValue("titleGallery", sections.gallery);
    setControlValue("titleWish", sections.wish);
    setControlValue("titleGift", sections.gift?.title);
    setControlValue("titleCountdown", sections.countdown?.title);
    setControlValue("titleThanks", sections.thanks?.title);

    const subtitles = config.sectionSubtitles || {};
    setControlValue("subtitleSaveDate", subtitles.saveDate);
    setControlValue("subtitleAbout", subtitles.about);
    setControlValue("subtitleTimeline", subtitles.timeline);
    setControlValue("subtitleGallery", subtitles.gallery);
    setControlValue("subtitleWish", subtitles.wish);
    setControlValue("subtitleGift", subtitles.gift);
    setControlValue("subtitleCountdown", subtitles.countdown);
    setControlValue("subtitleThanks", Array.isArray(subtitles.thanks) ? subtitles.thanks.join("\n") : subtitles.thanks);

    const brideMeal = splitMealTime(config.ceremony?.bride?.meal?.time);
    const groomMeal = splitMealTime(config.ceremony?.groom?.meal?.time);
    setControlValue("brideCeremonyTitle", config.ceremony?.bride?.title);
    setControlValue("groomCeremonyTitle", config.ceremony?.groom?.title);
    setControlValue("brideCeremonyTime", config.ceremony?.bride?.time);
    setControlValue("groomCeremonyTime", config.ceremony?.groom?.time);
    setControlValue("brideMealTitle", config.ceremony?.bride?.meal?.title);
    setControlValue("groomMealTitle", config.ceremony?.groom?.meal?.title);
    setControlValue("brideMealDate", brideMeal.date);
    setControlValue("brideMealTime", brideMeal.time);
    setControlValue("groomMealDate", groomMeal.date);
    setControlValue("groomMealTime", groomMeal.time);

    // Sau khi gán block concept → ẩn ô ảnh không dùng
    syncMediaUploadVisibility();
}

function buildLoadedConfigFromData(weddingId, data = {}) {
    return {
        ...clone(fallbackWedding),
        ...data,
        weddingId,
        theme: {
            ...(fallbackWedding.theme || {}),
            ...(data.theme || {})
        },
        groom: {
            ...(fallbackWedding.groom || {}),
            ...(data.groom || {})
        },
        bride: {
            ...(fallbackWedding.bride || {}),
            ...(data.bride || {})
        },
        poster: {
            ...(data.poster || {})
        },
        preview: {
            ...(data.preview || {})
        },
        aboutCard: {
            ...(data.aboutCard || {})
        },
        gallery: {
            ...(fallbackWedding.gallery || {}),
            ...(data.gallery || {}),
            photos: Array.isArray(data.gallery?.photos) ? data.gallery.photos : []
        },
        gift: {
            groom: { ...(data.gift?.groom || {}) },
            bride: { ...(data.gift?.bride || {}) }
        },
        sectionSubtitles: {
            ...(fallbackWedding.sectionSubtitles || {}),
            ...(data.sectionSubtitles || {})
        },
        ceremony: {
            ...(fallbackWedding.ceremony || {}),
            ...(data.ceremony || {}),
            bride: {
                ...(fallbackWedding.ceremony?.bride || {}),
                ...(data.ceremony?.bride || {}),
                meal: {
                    ...(fallbackWedding.ceremony?.bride?.meal || {}),
                    ...(data.ceremony?.bride?.meal || {})
                }
            },
            groom: {
                ...(fallbackWedding.ceremony?.groom || {}),
                ...(data.ceremony?.groom || {}),
                meal: {
                    ...(fallbackWedding.ceremony?.groom?.meal || {}),
                    ...(data.ceremony?.groom?.meal || {})
                }
            }
        },
        builder: {
            ...(fallbackWedding.builder || {}),
            ...(data.builder || {})
        },
        payment: {
            ...(fallbackWedding.payment || {}),
            ...(data.payment || {})
        }
    };
}

async function finishLoadBuilderConfig(weddingId, config) {
    loadedWeddingConfig = config;
    fillBuilderForm(loadedWeddingConfig);
    markWeddingEditable();
    if (getLoadedEditToken(loadedWeddingConfig)) {
        syncUrlForEdit(weddingId, getLoadedEditToken(loadedWeddingConfig));
    }
    listenWeddingPayment(weddingId);
    if (isPaymentUnlocked(loadedWeddingConfig)) {
        updateResultLinks(weddingId);
    } else {
        showPaymentModal(weddingId);
    }
    // Báo đã load xong TRƯỚC khi probe Cloudinary (probe có thể mất nhiều giây)
    if (!statusEl?.dataset?.type || statusEl.dataset.type !== "error") {
        const code = getOrderCode(config);
        setStatus(
            code ? `Đang sửa thiệp · Mã GD: ${code}` : "Đang sửa thiệp.",
            "success"
        );
    }
    refreshPreview(false);

    // Kiểm tra ảnh chết nền — không chặn hiển thị form
    try {
        await verifyAllBuilderRemoteMedia();
    } catch (error) {
        console.warn("[builder] verify media after load:", error);
    }
}

function configLooksLikeRealWedding(config = {}) {
    const groom = String(config.groom?.fullName || config.groom?.nickname || "").trim();
    const bride = String(config.bride?.fullName || config.bride?.nickname || "").trim();
    const hasMedia = Boolean(
        config.poster?.image
        || config.preview?.image
        || config.groom?.avatar
        || config.bride?.avatar
        || (Array.isArray(config.gallery?.photos) && config.gallery.photos.some(p => p?.src))
    );
    return Boolean(groom || bride || hasMedia || config.payment?.accessToken);
}

async function loadConfigForEdit() {
    const weddingId = getWeddingIdFromUrl();
    const urlEditToken = getEditTokenFromUrl();

    if (!weddingId) {
        originalEditingWeddingId = "";
        markWeddingEditable();
        setControlValue("primaryColor", BRAND_PRIMARY);
        refreshPreview();
        return;
    }

    editingWeddingId = weddingId;
    originalEditingWeddingId = weddingId;
    weddingIdInput.value = weddingId;
    setStatus(`Dang tai cau hinh: ${weddingId}`);

    try {
        // 1) Nguồn chính: weddings/{id} (đầy đủ, đúng data Firebase)
        let weddingDoc = null;
        let weddingGetDenied = false;
        try {
            weddingDoc = await db.collection("weddings").doc(weddingId).get();
        } catch (getError) {
            if (getError?.code === "permission-denied") {
                weddingGetDenied = true;
            } else {
                throw getError;
            }
        }

        if (weddingDoc?.exists) {
            const config = buildLoadedConfigFromData(weddingDoc.id, weddingDoc.data() || {});

            // Có editToken trên doc → bắt buộc ?e= khớp
            if (!canOpenBuilderEdit(config, urlEditToken)) {
                setStatus(
                    "Link sửa thiệp thiếu hoặc sai mã ?e=. Lấy đúng link (có e=) từ Firebase builder.editToken hoặc Admin.",
                    "error"
                );
                markWeddingMissing(weddingId);
                return;
            }

            if (urlEditToken) {
                try {
                    const mapDoc = await db.collection("editAccess").doc(urlEditToken).get();
                    if (mapDoc.exists) {
                        const mappedId = String(mapDoc.data()?.weddingId || "").trim();
                        if (mappedId && mappedId !== weddingId) {
                            setStatus("Mã sửa thiệp không khớp weddingId.", "error");
                            markWeddingMissing(weddingId);
                            return;
                        }
                    }
                } catch (mapError) {
                    console.warn("[builder] editAccess check:", mapError);
                }
            }

            await finishLoadBuilderConfig(weddingId, config);

            // Backfill editSessions để lần sau / máy khác vẫn có bản nháp theo ?e=
            const token = getLoadedEditToken(config) || urlEditToken;
            if (token) {
                upsertEditSession(db, token, {
                    ...config,
                    createdAt: null,
                    updatedAt: null,
                    payment: {
                        ...(config.payment || {}),
                        updatedAt: null,
                        confirmedAt: null
                    }
                }).catch(() => null);
                syncWeddingTokenMaps(db, {
                    weddingId,
                    accessToken: config.payment?.accessToken,
                    editToken: token
                }).catch(() => null);
            }
            return;
        }

        // 2) Fallback: editSessions/{e} (khi không get được weddings hoặc doc chưa có)
        if (urlEditToken) {
            const session = await loadEditSession(db, urlEditToken);
            if (session) {
                const mappedId = String(session.weddingId || "").trim();
                if (mappedId && mappedId !== weddingId) {
                    setStatus("Mã sửa thiệp không khớp weddingId.", "error");
                    markWeddingMissing(weddingId);
                    return;
                }
                const config = buildLoadedConfigFromData(weddingId, session);
                if (!canOpenBuilderEdit(config, urlEditToken)) {
                    setStatus("Link sửa thiệp không hợp lệ.", "error");
                    markWeddingMissing(weddingId);
                    return;
                }
                if (!configLooksLikeRealWedding(config) && !weddingGetDenied) {
                    setStatus(
                        `Không tìm thấy data thật cho ${weddingId}. Kiểm tra doc Firestore weddings/${weddingId}.`,
                        "error"
                    );
                    markWeddingMissing(weddingId);
                    return;
                }
                try {
                    const paySnap = await db.collection("paymentStatus").doc(weddingId).get();
                    if (paySnap.exists) {
                        config.payment = { ...(config.payment || {}), ...(paySnap.data() || {}) };
                    }
                } catch (_) { /* ignore */ }
                await finishLoadBuilderConfig(weddingId, config);
                return;
            }
        }

        // 3) Không có data
        if (weddingGetDenied) {
            setStatus(
                "Không đọc được thiệp (Rules). Publish lại firestore.rules (allow get) hoặc mở bằng Admin.",
                "error"
            );
        } else {
            setStatus(`Không tìm thấy weddings/${weddingId} trên Firebase.`, "error");
        }
        loadedWeddingConfig = { ...clone(fallbackWedding), weddingId };
        markWeddingMissing(weddingId);
    } catch (error) {
        console.error(error);
        markWeddingMissing(weddingId);
        setStatus("Khong tai duoc cau hinh. Kiem tra Firestore Rules hoac kiem tra lai weddingId.", "error");
    }
}

/**
 * Field gần nhất gắn với 1 section thiệp (concept / title / subtitle).
 * Dùng để preview nhảy đúng chỗ.
 */
let lastJumpFieldName = "";
/** Token để bỏ qua load/scroll event của iframe cũ khi refresh liên tiếp. */
let previewLoadToken = 0;

const COVER_PREVIEW_STATE = Object.freeze({ opened: false, scrollY: 0, target: "" });

/** Title / subtitle / lịch tổ chức builder → selector section trên thiệp. */
const TITLE_SUBTITLE_PREVIEW_MAP = {
    titleSaveDate: ".save-date",
    subtitleSaveDate: ".save-date",
    titleAbout: ".about",
    subtitleAbout: ".about",
    titleTimeline: ".timeline",
    subtitleTimeline: ".timeline",
    titleGallery: ".gallery",
    subtitleGallery: ".gallery",
    titleWish: ".wish",
    subtitleWish: ".wish",
    titleGift: ".gift",
    subtitleGift: ".gift",
    titleCountdown: ".countdown",
    subtitleCountdown: ".countdown",
    titleThanks: ".thanks",
    subtitleThanks: ".thanks",
    // Lịch tổ chức → timeline
    brideCeremonyTitle: ".timeline",
    groomCeremonyTitle: ".timeline",
    brideMealTitle: ".timeline",
    groomMealTitle: ".timeline",
    brideCeremonyTime: ".timeline",
    groomCeremonyTime: ".timeline",
    brideMealDate: ".timeline",
    brideMealTime: ".timeline",
    groomMealDate: ".timeline",
    groomMealTime: ".timeline"
};

function isMobileBuilderLayout() {
    return window.matchMedia("(max-width: 900px)").matches;
}

function isSectionJumpField(fieldName) {
    const name = String(fieldName || "").trim();
    if (!name) return false;
    if (name.startsWith("block")) return true;
    if (name.startsWith("title") || name.startsWith("subtitle")) return true;
    if (Object.prototype.hasOwnProperty.call(TITLE_SUBTITLE_PREVIEW_MAP, name)) return true;
    return false;
}

function readPreviewState() {
    try {
        return JSON.parse(localStorage.getItem(PREVIEW_STATE_KEY) || "null") || { ...COVER_PREVIEW_STATE };
    } catch (error) {
        return { ...COVER_PREVIEW_STATE };
    }
}

function savePreviewState(state) {
    localStorage.setItem(PREVIEW_STATE_KEY, JSON.stringify({
        opened: Boolean(state?.opened),
        scrollY: Math.max(0, Math.round(Number(state?.scrollY || 0))),
        target: String(state?.target || "")
    }));
}

function rememberJumpField(fieldName) {
    const name = String(fieldName || "").trim();
    if (!isSectionJumpField(name)) return;
    lastJumpFieldName = name;
}

function getPreviewTargetFromField(fieldName) {
    const name = String(fieldName || "").trim();
    if (name === "blockCover") return "";
    if (TITLE_SUBTITLE_PREVIEW_MAP[name]) {
        return TITLE_SUBTITLE_PREVIEW_MAP[name];
    }
    const targetMap = getPreviewTargetMap();
    return targetMap[name] || "";
}

/**
 * State preview cho 1 field (concept / title / subtitle).
 * blockCover → cover; titleAbout / blockAbout → .about; …
 */
function buildPreviewStateForField(fieldName) {
    const name = String(fieldName || "").trim();
    if (!name) return null;

    if (name === "blockCover") {
        return { ...COVER_PREVIEW_STATE };
    }

    const target = getPreviewTargetFromField(name);
    if (target) {
        return { opened: true, scrollY: 0, target };
    }

    return null;
}

/**
 * Resolve state ghi localStorage trước khi reload iframe.
 * - mode: "cover" → luôn bìa (nút Preview)
 * - previewState: object tường minh
 * - forceField: map từ tên field
 */
function resolvePreviewState(options = {}) {
    if (options.mode === "cover") {
        return { ...COVER_PREVIEW_STATE };
    }

    if (options.previewState && typeof options.previewState === "object") {
        return {
            opened: Boolean(options.previewState.opened),
            scrollY: Math.max(0, Math.round(Number(options.previewState.scrollY || 0))),
            target: String(options.previewState.target || "")
        };
    }

    if (options.forceField) {
        rememberJumpField(options.forceField);
        return buildPreviewStateForField(options.forceField) || { ...COVER_PREVIEW_STATE };
    }

    const activeName = String(document.activeElement?.name || "").trim();
    if (isSectionJumpField(activeName)) {
        rememberJumpField(activeName);
        return buildPreviewStateForField(activeName) || { ...COVER_PREVIEW_STATE };
    }

    if (lastJumpFieldName) {
        return buildPreviewStateForField(lastJumpFieldName) || { ...COVER_PREVIEW_STATE };
    }

    return { ...COVER_PREVIEW_STATE };
}

function syncPreviewStateFromFrame() {
    let previewWindow = null;
    let previewDocument = null;
    const loadToken = previewLoadToken;

    try {
        previewWindow = frame.contentWindow;
        previewDocument = frame.contentDocument;
    } catch (error) {
        return;
    }

    if (!previewWindow || !previewDocument) return;

    // Giữ nguyên target section — scroll/open không được xóa target
    const markOpened = () => {
        if (loadToken !== previewLoadToken) return;
        const previousState = readPreviewState();
        savePreviewState({
            opened: true,
            scrollY: previousWindowSafeScroll(previewWindow, previousState.scrollY),
            target: previousState.target || ""
        });
    };

    const syncScroll = () => {
        if (loadToken !== previewLoadToken) return;
        const previousState = readPreviewState();
        savePreviewState({
            opened: previousState.opened || previewWindow.scrollY > 20 || Boolean(previousState.target),
            scrollY: previousWindowSafeScroll(previewWindow, previousState.scrollY),
            target: previousState.target || ""
        });
    };

    previewDocument.getElementById("openCard")?.addEventListener("click", markOpened, { once: true });
    previewWindow.addEventListener("scroll", syncScroll, { passive: true });
}

function previousWindowSafeScroll(previewWindow, fallbackScrollY) {
    return Math.max(0, Math.round(Number(previewWindow?.scrollY || fallbackScrollY || 0)));
}

function setBuilderMobileTab(tab) {
    const next = tab === "preview" ? "preview" : "edit";
    document.body.dataset.builderTab = next;
    document.querySelectorAll("[data-builder-tab]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.builderTab === next);
    });
}

function scrollToPreviewPanel() {
    const panel = document.getElementById("previewPanel");
    if (!panel) return;

    setBuilderMobileTab("preview");
    requestAnimationFrame(() => {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

function refreshPreview(updateStatus = true, options = {}) {
    const config = createPreviewConfig();
    localStorage.setItem("weddingBuilderPreview", JSON.stringify(config));

    const previewState = resolvePreviewState(options);
    savePreviewState(previewState);

    previewLoadToken += 1;
    // Dùng cb/pt — KHÔNG dùng ?t= (đã dành cho payment.accessToken 32 hex)
    frame.src = `../index.html?preview=builder&cb=${Date.now()}&pt=${previewLoadToken}`;

    if (updateStatus) {
        const sectionHint = previewState.target ? ` → ${previewState.target}` : " → cover";
        setStatus(`Preview: ${config.weddingId || "chua-co-id"}${sectionHint}`);
    }
    if (options.focusPreview) {
        scrollToPreviewPanel();
    }
}

/** Nút "Xem preview": luôn về màn cover. */
function handlePreviewClick() {
    lastJumpFieldName = "";
    window.clearTimeout(refreshPreview.timer);
    refreshPreview(true, {
        focusPreview: true,
        mode: "cover"
    });
}

/**
 * Nhảy preview tới section gắn với field (concept / title / subtitle).
 * Mobile: mở tab preview; PC: refresh iframe tại section đó.
 */
function jumpPreviewToField(fieldName, options = {}) {
    const name = String(fieldName || "").trim();
    if (!isSectionJumpField(name)) return;

    rememberJumpField(name);
    const previewState = buildPreviewStateForField(name) || { ...COVER_PREVIEW_STATE };
    const mobile = isMobileBuilderLayout();

    window.clearTimeout(refreshPreview.timer);
    refreshPreview(options.updateStatus ?? mobile, {
        focusPreview: options.focusPreview ?? mobile,
        previewState,
        forceField: name
    });
}

/**
 * Đổi concept block → preview đúng section đó (ghi đè target cũ).
 */
function handleBlockConceptChange(event) {
    const field = event.target;
    if (!field || field.tagName !== "SELECT") return;

    const name = String(field.name || "").trim();

    // Phông chữ: select thường chỉ fire "change" (không fire "input") → phải refresh ở đây
    if (name === "fontBody" || name === "fontNickname") {
        window.clearTimeout(refreshPreview.timer);
        refreshPreview.timer = window.setTimeout(() => {
            refreshPreview(true, {
                focusPreview: false,
                mode: "cover"
            });
            setStatus(
                name === "fontNickname"
                    ? `Phông nickname: ${field.options[field.selectedIndex]?.text || field.value}`
                    : `Phông thiệp: ${field.options[field.selectedIndex]?.text || field.value}`
            );
        }, 120);
        return;
    }

    if (!name.startsWith("block")) return;

    // Đổi concept about → ẩn/hiện ô upload ảnh tương ứng
    if (name === "blockAbout" || name === "blockCover" || name === "blockCountdown"
        || name === "blockTimeline" || name === "blockGallery" || name === "blockPoster") {
        syncMediaUploadVisibility();
    }

    jumpPreviewToField(name);
}

/**
 * Sửa title/subtitle/lịch tổ chức → preview đúng phần đó.
 * PC: cập nhật khung preview bên cạnh.
 * Mobile: cập nhật state (không cướp form khi đang gõ); blur sẽ mở tab preview.
 */
function handleTitleSubtitleInput(event) {
    const field = event.target;
    const name = String(field?.name || "").trim();
    if (!TITLE_SUBTITLE_PREVIEW_MAP[name]) return;

    rememberJumpField(name);
    window.clearTimeout(refreshPreview.timer);
    refreshPreview.timer = window.setTimeout(() => {
        jumpPreviewToField(name, {
            updateStatus: false,
            // Mobile giữ tab "Chỉnh sửa" để gõ tiếp; PC luôn thấy panel bên cạnh
            focusPreview: false
        });
    }, 320);
}

/** Mobile: rời ô title/subtitle/lịch → mở preview đúng section vừa sửa. */
function handleTitleSubtitleFocusOut(event) {
    const field = event.target;
    const name = String(field?.name || "").trim();
    if (!TITLE_SUBTITLE_PREVIEW_MAP[name]) return;
    if (!isMobileBuilderLayout()) return;

    rememberJumpField(name);

    // Đợi focus chuyển sang ô khác; nếu vẫn trong cùng nhóm jump field thì không nhảy
    window.setTimeout(() => {
        const activeName = String(document.activeElement?.name || "").trim();
        if (TITLE_SUBTITLE_PREVIEW_MAP[activeName]) return;
        jumpPreviewToField(name, {
            updateStatus: true,
            focusPreview: true
        });
    }, 0);
}

async function saveConfig(event) {
    event.preventDefault();
    if (missingWeddingConfig) {
        setStatus("Link sửa thiệp không hợp lệ (thiệp không tồn tại). Không thể lưu.", "error");
        return;
    }

    // Cần weddingId sớm để folder Cloudinary đúng trước khi flush QR
    let probePayload = createSavePayload();
    if (!probePayload.weddingId) {
        setStatus("Nhập nickname chú rể và cô dâu để tạo thiệp.", "error");
        return;
    }

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Dang luu';
        }

        // Chờ nén/stage ảnh xong (tránh Lưu khi pending chưa kịp set)
        let wait = 0;
        while (mediaStageInFlight > 0 && wait < 100) {
            await new Promise(r => setTimeout(r, 50));
            wait += 1;
        }
        if (mediaStageInFlight > 0) {
            throw new Error("Đang xử lý ảnh — đợi giây lát rồi Lưu Firebase lại.");
        }

        // 1) Mọi ảnh/QR user vừa chọn (pending / blob field) → upload Cloudinary
        await recoverPendingMediaFromBlobFields();
        const pendingCount = pendingMediaBlobs.size + pendingQrBlobs.size;
        if (pendingCount) {
            setStatus(`Đang upload ${pendingCount} ảnh/QR mới lên Cloudinary…`);
        }
        if (pendingMediaBlobs.size) {
            await flushPendingMediaUploads();
        }
        if (pendingQrBlobs.size) {
            await flushPendingQrUploads();
        }

        // Đồng bộ ẩn concept + dọn blob field không active trước khi kiểm tra
        syncMediaUploadVisibility();
        assertNoBlobMediaUrls();
        const blobMedia = MEDIA_FIELD_NAMES.filter(
            name => isMediaFieldActive(name) && isBlobUrl(readField(name))
        );
        if (blobMedia.length) {
            throw new Error(`Ảnh tạm chưa upload xong: ${blobMedia.join(", ")}. Thử chọn lại rồi Lưu Firebase.`);
        }

        let payload = createSavePayload();
        const groomQr = payload.gift?.groom?.qr || "";
        const brideQr = payload.gift?.bride?.qr || "";
        if (isBlobUrl(groomQr) || isBlobUrl(brideQr)) {
            throw new Error("QR vẫn còn bản tạm (blob). Thử cắt lại rồi Lưu Firebase.");
        }

        const availableWeddingId = await findAvailableWeddingId(payload.weddingId);
        if (!availableWeddingId) {
            setStatus("Khong tao duoc weddingId. Hay kiem tra lai ten co dau chu re.", "error");
            return;
        }
        if (availableWeddingId !== payload.weddingId) {
            setStatus(`WeddingId da ton tai, tu dong luu thanh: ${availableWeddingId}`);
        }
        payload = applyWeddingIdToPayload(payload, availableWeddingId);

        // Payment: build rồi sanitize — client không bao giờ leo thang unlocked/paid
        let paymentDraft = buildPendingPayment(payload.weddingId);
        if (isInvitePlanLocked()) {
            const lockedPlan = getLockedInvitePlan();
            payload.plan = lockedPlan;
            paymentDraft = { ...paymentDraft, plan: lockedPlan };
            if (lockedPlan !== "multi") {
                payload.guests = [];
            }
            if (loadedWeddingConfig.payment?.amount !== undefined
                && loadedWeddingConfig.payment?.amount !== null
                && loadedWeddingConfig.payment?.amount !== "") {
                paymentDraft.amount = loadedWeddingConfig.payment.amount;
            }
        }
        payload.payment = sanitizePaymentForBuilderSave(
            loadedWeddingConfig.payment,
            paymentDraft
        );

        // editToken: link sửa ?e= (legacy thiệp không có token vẫn mở bằng ?wedding=)
        const existingEditToken = normalizeEditToken(loadedWeddingConfig?.builder?.editToken);
        const editToken = existingEditToken || generateEditToken();
        const prevPublicIds = Array.isArray(loadedWeddingConfig.builder?.cloudinaryPublicIds)
            ? loadedWeddingConfig.builder.cloudinaryPublicIds
            : [];
        const cloudinaryPublicIds = [...new Set([
            ...prevPublicIds,
            ...sessionCloudinaryPublicIds
        ])].filter(Boolean);

        payload.builder = {
            ...(payload.builder || {}),
            ...(loadedWeddingConfig.builder || {}),
            editToken,
            groomNickname: payload.builder?.groomNickname
                || loadedWeddingConfig.builder?.groomNickname
                || "",
            brideNickname: payload.builder?.brideNickname
                || loadedWeddingConfig.builder?.brideNickname
                || "",
            mediaFingerprints: {
                ...(loadedWeddingConfig.builder?.mediaFingerprints || {}),
                ...(payload.builder?.mediaFingerprints || {})
            },
            cloudinaryPublicIds
        };

        // Ghi dấu thời gian để admin dọn thiệp > 30 ngày
        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        if (!loadedWeddingConfig.createdAt) {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        // Gỡ field thừa: thư viện nhạc thuộc collection musicLibrary / config local, không lưu trong wedding
        payload.musicLibrary = firebase.firestore.FieldValue.delete();

        await db.collection("weddings").doc(payload.weddingId).set(payload, { merge: true });

        // Map token + orderCode (SePay) + paymentStatus + editSessions
        const sessionPayload = {
            ...payload,
            // FieldValue không serialize — dùng null, sessionUpdatedAt set trong helper
            createdAt: null,
            updatedAt: null,
            musicLibrary: null,
            payment: {
                ...(payload.payment || {}),
                updatedAt: null,
                confirmedAt: null
            }
        };
        delete sessionPayload.musicLibrary;

        await Promise.all([
            syncWeddingTokenMaps(db, {
                weddingId: payload.weddingId,
                accessToken: payload.payment?.accessToken,
                editToken
            }),
            upsertOrderCodeMap(db, payload.payment?.orderCode, {
                weddingId: payload.weddingId,
                amount: payload.payment?.amount,
                currency: payload.payment?.currency,
                plan: payload.payment?.plan || payload.plan,
                status: "pending"
            }),
            upsertPaymentStatus(db, payload.weddingId, payload.payment),
            upsertEditSession(db, editToken, sessionPayload)
        ]);

        sessionCloudinaryPublicIds = [];

        // Giữ payment (accessToken, unlocked…) sau save — createPreviewConfig không mang field này
        loadedWeddingConfig = {
            ...createPreviewConfig(),
            weddingId: payload.weddingId,
            payment: payload.payment,
            plan: payload.plan,
            builder: payload.builder,
            createdAt: loadedWeddingConfig.createdAt || true
        };
        delete loadedWeddingConfig.musicLibrary;
        editingWeddingId = payload.weddingId;
        originalEditingWeddingId = payload.weddingId;
        weddingIdInput.value = payload.weddingId;
        syncUrlForEdit(payload.weddingId, editToken);
        listenWeddingPayment(payload.weddingId);
        // Lưu nháp xong → khóa gói ngay (không chờ admin duyệt)
        setInvitePlan(payload.plan || "single");
        syncInvitePlanUI();
        const savedCode = normalizeOrderCode(payload.payment?.orderCode) || "";
        setStatus(
            savedCode
                ? `Đã lưu bản nháp. Mã giao dịch: ${savedCode}`
                : "Đã lưu bản nháp thành công.",
            "success"
        );
        refreshPreview(false);
        if (isPaymentUnlocked(payload)) {
            showUnlockedLinks(payload.weddingId, payload.payment?.accessToken || "");
        } else {
            showPaymentModal(payload.weddingId);
        }
    } catch (error) {
        console.error(error);
        const message = String(error?.message || "").trim();
        setStatus(
            message
                ? `Lưu thất bại: ${message.slice(0, 160)}`
                : "Luu Firebase that bai. Kiem tra dang nhap hoac Firestore Rules.",
            "error"
        );
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Luu Firebase';
        }
    }
}


function pickMediaFile(fieldName) {
    const input = document.querySelector(`[data-upload-target="${fieldName}"]`);
    if (!input) return;
    input.value = "";
    input.click();
}

function handleUploadClick(event) {
    const button = event.target.closest("[data-upload-button]");
    if (!button) return;

    const fieldName = button.dataset.uploadButton;
    // QR: mở file → crop modal. Media: mở file → tự stage + preview (không bấm thêm)
    if (document.querySelector(`[data-qr-input="${fieldName}"]`)) {
        pickQrFile(fieldName);
        return;
    }
    if (document.querySelector(`[data-upload-target="${fieldName}"]`)) {
        pickMediaFile(fieldName);
    }
}

function handleQrInputChange(event) {
    const input = event.target.closest("[data-qr-input]");
    if (!input) return;
    loadQrFile(input.dataset.qrInput, input.files?.[0]);
}

function handleMediaInputChange(event) {
    const input = event.target.closest("[data-upload-target]");
    if (!input) return;
    const fieldName = input.dataset.uploadTarget;
    const file = input.files?.[0];
    if (!fieldName || !file) return;
    stageImageForField(fieldName, file);
}

function handleMapButton(event) {
    const pickerButton = event.target.closest("[data-map-picker]");
    if (pickerButton) {
        openMapPicker(pickerButton.dataset.mapPicker);
    }
}

form.addEventListener("focusin", event => {
    const name = String(event.target?.name || "").trim();
    if (isSectionJumpField(name)) {
        rememberJumpField(name);
    }
});

form.addEventListener("focusout", handleTitleSubtitleFocusOut);

form.addEventListener("input", event => {
    const name = String(event.target?.name || "").trim();
    // Concept block: chỉ xử lý ở change
    if (name.startsWith("block")) {
        return;
    }
    // Title / subtitle / lịch tổ chức: nhảy đúng section
    if (TITLE_SUBTITLE_PREVIEW_MAP[name]) {
        handleTitleSubtitleInput(event);
        return;
    }
    window.clearTimeout(refreshPreview.timer);
    refreshPreview.timer = window.setTimeout(() => refreshPreview(false), 250);
});

form.addEventListener("change", handleBlockConceptChange);

form.addEventListener("change", event => {
    if (event.target?.name === "invitePlan") {
        // Chặn đổi gói sau khi đã thanh toán (kể cả bẻ DOM)
        if (isInvitePlanLocked()) {
            setInvitePlan(getLockedInvitePlan());
            setStatus(
                isPaymentUnlocked()
                    ? "Gói thiệp đã thanh toán — không thể đổi. Liên hệ admin nếu cần nâng cấp."
                    : "Gói thiệp đã lưu nháp — không thể đổi. Liên hệ admin nếu cần đổi gói.",
                "error"
            );
            return;
        }
        syncInvitePlanUI();
        window.clearTimeout(refreshPreview.timer);
        refreshPreview.timer = window.setTimeout(() => refreshPreview(false), 200);
    }
});

previewBtn.addEventListener("click", handlePreviewClick);
document.querySelectorAll("[data-builder-tab]").forEach(button => {
    button.addEventListener("click", () => {
        const tab = button.dataset.builderTab;
        setBuilderMobileTab(tab);
        if (tab === "preview") {
            // Tab preview = section vừa chỉnh (concept / title / subtitle)
            if (lastJumpFieldName) {
                jumpPreviewToField(lastJumpFieldName, {
                    updateStatus: true,
                    focusPreview: true
                });
            } else {
                refreshPreview(true, {
                    focusPreview: true,
                    mode: "cover"
                });
            }
        }
    });
});
setBuilderMobileTab("edit");
frame.addEventListener("load", syncPreviewStateFromFrame);
form.addEventListener("submit", saveConfig);
form.addEventListener("click", handleUploadClick);
form.addEventListener("change", handleQrInputChange);
form.addEventListener("change", handleMediaInputChange);
form.addEventListener("click", handleMapButton);

qrCropModal?.addEventListener("click", event => {
    if (event.target.closest("[data-close-qr-crop]")) {
        closeQrCropModal();
    }
});
[qrCropZoom, qrCropX, qrCropY].forEach(input => {
    input?.addEventListener("input", () => {
        if (activeQrField) renderQrCrop();
    });
});
qrCropSaveBtn?.addEventListener("click", () => {
    saveQrFromModal();
});
document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (qrCropModal && !qrCropModal.hidden) {
        closeQrCropModal();
    }
});
populateBuilderBlockSelects(form);
renderBuilderGalleryFields();
syncMediaUploadVisibility();
Promise.all([
    loadPaymentSettings(),
    loadMusicLibrary()
]).then(() => loadConfigForEdit()).then(() => {
    populateMusicOptions(loadedWeddingConfig);
    syncMediaUploadVisibility();
});

if (saveModal) {
    saveModal.addEventListener("click", event => {
        if (event.target.closest("[data-close-modal]")) {
            hideSaveModal();
        }
    });
}

copyInvitationLink?.addEventListener("click", () => {
    copyText(modalInvitationLink?.href || "", copyInvitationLink);
});

copyEditLink?.addEventListener("click", () => {
    copyText(modalEditLink?.href || "", copyEditLink);
});

// Copy từng link khách trong modal / result list
document.addEventListener("click", event => {
    const button = event.target.closest("[data-copy-url]");
    if (!button) return;
    copyText(button.dataset.copyUrl || "", button);
});

copyPaymentOrderCodeBtn?.addEventListener("click", () => {
    const code = paymentOrderCodeText?.textContent?.trim() || getOrderCode() || "";
    if (!code || code === "—") {
        setStatus("Chưa có mã giao dịch. Hãy Lưu Firebase trước.", "error");
        return;
    }
    copyText(code, copyPaymentOrderCodeBtn);
});

copyPaymentEditLink?.addEventListener("click", () => {
    copyText(paymentEditLink?.href || "", copyPaymentEditLink);
});

paymentModal?.addEventListener("click", event => {
    if (event.target.closest("[data-close-payment-modal]")) {
        hidePaymentModal();
    }
});

saveMapPointBtn?.addEventListener("click", saveSelectedMapPoint);
mapPickerSearchBtn?.addEventListener("click", () => {
    searchMapAddress(mapPickerSearchInput?.value || "");
});
mapPickerSearchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        searchMapAddress(mapPickerSearchInput.value);
    }
});
mapPickerModal?.addEventListener("click", event => {
    if (event.target.closest("[data-close-map-picker]")) {
        closeMapPicker();
    }
});

window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        hideSaveModal();
    }
});
