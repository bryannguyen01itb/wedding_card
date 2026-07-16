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
    extractCloudinaryPublicId,
    requestCloudinaryCleanup,
    destroyCloudinaryByDeleteToken
} from "../js/utils/security.js";

/** public_id Cloudinary đã upload trong phiên (ghi vào builder.cloudinaryPublicIds) */
let sessionCloudinaryPublicIds = [];
/** public_id cần xóa khi user xóa/đổi ảnh (flush sau Lưu Firebase) */
const orphanedCloudinaryPublicIds = new Set();
/** fieldName → public_id Cloudinary đang gắn (chính xác từ upload response) */
const lastRemotePublicIds = new Map();
/** public_id → delete_token (xóa được từ browser, không cần secret) */
const cloudinaryDeleteTokens = new Map();
const DELETE_TOKEN_STORAGE_KEY = "weddingBuilderCloudinaryDeleteTokens";

function loadDeleteTokensFromSession() {
    try {
        const raw = sessionStorage.getItem(DELETE_TOKEN_STORAGE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        const now = Date.now();
        Object.entries(obj || {}).forEach(([id, meta]) => {
            const token = String(meta?.token || "").trim();
            const exp = Number(meta?.exp || 0);
            if (id && token && exp > now) cloudinaryDeleteTokens.set(id, token);
        });
    } catch (_) {
        /* ignore */
    }
}

function persistDeleteToken(publicId, deleteToken) {
    const id = String(publicId || "").trim();
    const token = String(deleteToken || "").trim();
    if (!id || !token) return;
    cloudinaryDeleteTokens.set(id, token);
    try {
        const raw = sessionStorage.getItem(DELETE_TOKEN_STORAGE_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        // Token Cloudinary thường ~10 phút
        obj[id] = { token, exp: Date.now() + 9 * 60 * 1000 };
        // dọn hết hạn
        const now = Date.now();
        Object.keys(obj).forEach(key => {
            if (!obj[key]?.exp || obj[key].exp <= now) delete obj[key];
        });
        sessionStorage.setItem(DELETE_TOKEN_STORAGE_KEY, JSON.stringify(obj));
    } catch (_) {
        /* ignore */
    }
}

function forgetDeleteToken(publicId) {
    const id = String(publicId || "").trim();
    if (!id) return;
    cloudinaryDeleteTokens.delete(id);
    try {
        const raw = sessionStorage.getItem(DELETE_TOKEN_STORAGE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        delete obj[id];
        sessionStorage.setItem(DELETE_TOKEN_STORAGE_KEY, JSON.stringify(obj));
    } catch (_) {
        /* ignore */
    }
}

loadDeleteTokensFromSession();

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

/** tabId + localStorage bridge (sessionStorage parent≠iframe) */
function getBuilderPreviewTabId() {
    try {
        let id = sessionStorage.getItem("weddingBuilderPreviewTabId");
        if (!id) {
            id = `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            sessionStorage.setItem("weddingBuilderPreviewTabId", id);
        }
        return id;
    } catch {
        return "default";
    }
}

function writeBuilderPreviewConfig(config) {
    const id = getBuilderPreviewTabId();
    const raw = JSON.stringify(config ?? null);
    try { sessionStorage.setItem("weddingBuilderPreview", raw); } catch { /* ignore */ }
    try {
        localStorage.setItem(`weddingBuilderPreview:${id}`, raw);
        localStorage.setItem("weddingBuilderPreview", raw);
    } catch { /* ignore */ }
    return id;
}

function writeBuilderPreviewState(state) {
    const id = getBuilderPreviewTabId();
    const raw = JSON.stringify(state ?? null);
    try { sessionStorage.setItem(PREVIEW_STATE_KEY, raw); } catch { /* ignore */ }
    try {
        localStorage.setItem(`weddingBuilderPreviewState:${id}`, raw);
        localStorage.setItem(PREVIEW_STATE_KEY, raw);
    } catch { /* ignore */ }
    return id;
}
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
        // Tổ chức chung: layout joint chưa dùng ảnh ceremony (concept joint thêm sau)
        if (getSelectedCeremonyMode() === "joint") return false;
        const opts = getSectionSkinOptions("timeline", getSelectedBlockValue("blockTimeline"));
        // default true nếu skin chưa khai báo
        return opts.usesCeremonyImage !== false;
    }

    // cover, poster, preview, countdown, gallery — luôn dùng ảnh
    return true;
}

/** separate | joint */
function getSelectedCeremonyMode() {
    const checked = form?.querySelector('input[name="ceremonyMode"]:checked');
    const value = String(checked?.value || readField("ceremonyMode") || "separate").trim();
    return value === "joint" ? "joint" : "separate";
}

function setCeremonyMode(mode) {
    const next = mode === "joint" ? "joint" : "separate";
    form?.querySelectorAll('input[name="ceremonyMode"]').forEach(input => {
        input.checked = input.value === next;
    });
}

/* --- Ceremony events (joint / bride / groom): N sự kiện, sắp xếp --- */
const CEREMONY_EVENT_ICON_OPTIONS = [
    { id: "cup", label: "Bữa tiệc", bi: "bi-cup-hot" },
    { id: "hearts", label: "Lễ cưới", bi: "bi-hearts" },
    { id: "camera", label: "Chụp ảnh", bi: "bi-camera" },
    { id: "mic", label: "Phát biểu", bi: "bi-mic" },
    { id: "music", label: "Âm nhạc", bi: "bi-music-note-beamed" },
    { id: "gift", label: "Quà tặng", bi: "bi-gift" },
    { id: "car", label: "Di chuyển", bi: "bi-car-front" },
    { id: "star", label: "Khác", bi: "bi-stars" }
];
/** alias cũ */
const JOINT_EVENT_ICON_OPTIONS = CEREMONY_EVENT_ICON_OPTIONS;
const MIN_CEREMONY_EVENTS = 1;
const MAX_CEREMONY_EVENTS = 8;

const CEREMONY_EVENTS_LIST_IDS = {
    joint: "jointEventsList",
    bride: "brideEventsList",
    groom: "groomEventsList"
};
const CEREMONY_EVENTS_ADD_IDS = {
    joint: "addJointEventBtn",
    bride: "addBrideEventBtn",
    groom: "addGroomEventBtn"
};

/** @type {Record<"joint"|"bride"|"groom", { id: string, title: string, date: string, time: string, icon: string }[]>} */
const ceremonyEventsState = {
    joint: [],
    bride: [],
    groom: []
};

function newCeremonyEventId() {
    return `ce_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getMainWeddingDate() {
    return String(readField("date") || fallbackWedding.date || "").trim() || "2026-09-12";
}

function shiftDateIso(isoDate, dayDelta) {
    const base = toDateInputValue(isoDate) || getMainWeddingDate();
    const [y, m, d] = base.split("-").map(Number);
    if (!y || !m || !d) return base;
    const dt = new Date(y, m - 1, d + dayDelta);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function createDefaultCeremonyEvents(role = "joint", mainDate = getMainWeddingDate()) {
    const date = mainDate || getMainWeddingDate();
    if (role === "bride") {
        return [
            {
                id: newCeremonyEventId(),
                title: "BỮA CƠM THÂN MẬT",
                date: shiftDateIso(date, -1),
                time: "17:00",
                icon: "cup"
            },
            {
                id: newCeremonyEventId(),
                title: "LỄ VU QUY",
                date,
                time: "10:00",
                icon: "hearts"
            }
        ];
    }
    if (role === "groom") {
        return [
            {
                id: newCeremonyEventId(),
                title: "BỮA CƠM THÂN MẬT",
                date,
                time: "16:00",
                icon: "cup"
            },
            {
                id: newCeremonyEventId(),
                title: "LỄ THÀNH HÔN",
                date,
                time: "17:00",
                icon: "hearts"
            }
        ];
    }
    // joint
    return [
        {
            id: newCeremonyEventId(),
            title: "TIỆC CƯỚI",
            date,
            time: "18:00",
            icon: "cup"
        },
        {
            id: newCeremonyEventId(),
            title: "LỄ THÀNH HÔN",
            date,
            time: "19:00",
            icon: "hearts"
        }
    ];
}

function createDefaultJointEvents(mainDate = getMainWeddingDate()) {
    return createDefaultCeremonyEvents("joint", mainDate);
}

/** Normalize events từ Firebase / form → mảng sạch. */
function normalizeCeremonyEventsList(rawEvents, role = "joint", mainDate = getMainWeddingDate()) {
    if (!Array.isArray(rawEvents) || !rawEvents.length) {
        return createDefaultCeremonyEvents(role, mainDate);
    }

    return rawEvents
        .slice(0, MAX_CEREMONY_EVENTS)
        .map((ev, index) => {
            const iconId = String(ev?.icon || "").trim();
            const known = CEREMONY_EVENT_ICON_OPTIONS.some(opt => opt.id === iconId);
            return {
                id: String(ev?.id || "").trim() || newCeremonyEventId(),
                title: String(ev?.title || "").trim() || `Sự kiện ${index + 1}`,
                date: toDateInputValue(ev?.date || mainDate) || mainDate,
                time: String(ev?.time || "").split("•")[0].trim() || "18:00",
                icon: known ? iconId : (index === 0 ? "cup" : index === 1 ? "hearts" : "star")
            };
        });
}

function normalizeJointEventsList(rawEvents, mainDate = getMainWeddingDate()) {
    return normalizeCeremonyEventsList(rawEvents, "joint", mainDate);
}

/** Migrate thiệp cũ (title/time/meal) → events[]. */
function ceremonyEventsFromLegacyHouse(house = {}, role = "joint", mainDate = "") {
    const date = mainDate || house?.date || getMainWeddingDate();
    if (Array.isArray(house?.events) && house.events.length) {
        return normalizeCeremonyEventsList(house.events, role, date);
    }

    const mealSplit = splitMealTime(house?.meal?.time);
    const events = [];
    const defaultMeal = role === "joint" ? "TIỆC CƯỚI" : "BỮA CƠM THÂN MẬT";
    const defaultCeremony = role === "bride" ? "LỄ VU QUY" : "LỄ THÀNH HÔN";

    if (house?.meal?.title || mealSplit.time || mealSplit.date) {
        events.push({
            id: newCeremonyEventId(),
            title: house?.meal?.title || defaultMeal,
            date: mealSplit.date || toDateInputValue(date) || date,
            time: mealSplit.time || (role === "bride" ? "17:00" : "16:00"),
            icon: "cup"
        });
    }

    if (house?.title || house?.time || house?.date) {
        events.push({
            id: newCeremonyEventId(),
            title: house?.title || defaultCeremony,
            date: toDateInputValue(house?.date || date) || date,
            time: String(house?.time || (role === "bride" ? "10:00" : "17:00")).split("•")[0].trim(),
            icon: "hearts"
        });
    }

    return events.length
        ? normalizeCeremonyEventsList(events, role, date)
        : createDefaultCeremonyEvents(role, date);
}

function jointEventsFromLegacyJoint(joint = {}, mainDate = "") {
    return ceremonyEventsFromLegacyHouse(joint, "joint", mainDate);
}

function syncCeremonyEventsStateFromDom(role) {
    const listId = CEREMONY_EVENTS_LIST_IDS[role];
    const list = listId ? document.getElementById(listId) : null;
    if (!list) return ceremonyEventsState[role] || [];

    const rows = [...list.querySelectorAll("[data-ceremony-event-id]")];
    if (!rows.length) return ceremonyEventsState[role] || [];

    ceremonyEventsState[role] = rows.map((row, index) => {
        const id = row.dataset.ceremonyEventId || newCeremonyEventId();
        return {
            id,
            title: String(row.querySelector('[data-ceremony-field="title"]')?.value || "").trim()
                || `Sự kiện ${index + 1}`,
            date: String(row.querySelector('[data-ceremony-field="date"]')?.value || "").trim()
                || getMainWeddingDate(),
            time: String(row.querySelector('[data-ceremony-field="time"]')?.value || "").trim() || "18:00",
            icon: String(row.querySelector('[data-ceremony-field="icon"]')?.value || "star").trim() || "star"
        };
    });

    return ceremonyEventsState[role];
}

function syncJointEventsStateFromDom() {
    return syncCeremonyEventsStateFromDom("joint");
}

function getCeremonyEventsForSave(role) {
    syncCeremonyEventsStateFromDom(role);
    return normalizeCeremonyEventsList(
        ceremonyEventsState[role] || [],
        role,
        getMainWeddingDate()
    );
}

function getJointEventsForSave() {
    return getCeremonyEventsForSave("joint");
}

/** Mirror events → title/time/meal (tương thích thiệp / code cũ). */
function buildCeremonyLegacyMirror(events, role, mainDate) {
    const list = normalizeCeremonyEventsList(events, role, mainDate);
    const first = list[0] || null;
    const second = list[1] || first;
    const defaultMeal = role === "joint" ? "TIỆC CƯỚI" : "BỮA CƠM THÂN MẬT";
    const defaultCeremony = role === "bride"
        ? "LỄ VU QUY"
        : "LỄ THÀNH HÔN";
    return {
        title: second?.title || defaultCeremony,
        date: second?.date || mainDate,
        time: second?.time || (role === "bride" ? "10:00" : "17:00"),
        meal: {
            title: first?.title || defaultMeal,
            time: formatMealTime(first?.date || mainDate, first?.time || "18:00")
        }
    };
}

function buildJointLegacyMirror(events, mainDate) {
    return buildCeremonyLegacyMirror(events, "joint", mainDate);
}

function updateAddCeremonyEventButton(role) {
    const btnId = CEREMONY_EVENTS_ADD_IDS[role];
    const btn = btnId ? document.getElementById(btnId) : null;
    if (!btn) return;
    const len = (ceremonyEventsState[role] || []).length;
    const full = len >= MAX_CEREMONY_EVENTS;
    btn.disabled = full;
    btn.setAttribute("aria-disabled", full ? "true" : "false");
    btn.title = full ? `Tối đa ${MAX_CEREMONY_EVENTS} sự kiện` : "Thêm sự kiện";
}

function renderCeremonyEventsList(role) {
    const listId = CEREMONY_EVENTS_LIST_IDS[role];
    const list = listId ? document.getElementById(listId) : null;
    if (!list) return;

    if (!ceremonyEventsState[role]?.length) {
        ceremonyEventsState[role] = createDefaultCeremonyEvents(role);
    }

    const events = ceremonyEventsState[role];
    list.textContent = "";
    events.forEach((ev, index) => {
        const row = document.createElement("div");
        row.className = "joint-event-row";
        row.dataset.ceremonyEventId = ev.id;
        row.dataset.ceremonyEventsRole = role;

        const head = document.createElement("div");
        head.className = "joint-event-row__head";
        head.innerHTML = `<strong>Sự kiện ${index + 1}</strong>`;

        const actions = document.createElement("div");
        actions.className = "joint-event-row__actions";
        actions.innerHTML = `
            <button type="button" class="joint-event-btn" data-ceremony-move="-1" title="Lên" ${index === 0 ? "disabled" : ""} aria-label="Đưa lên">
                <i class="bi bi-arrow-up"></i>
            </button>
            <button type="button" class="joint-event-btn" data-ceremony-move="1" title="Xuống" ${index >= events.length - 1 ? "disabled" : ""} aria-label="Đưa xuống">
                <i class="bi bi-arrow-down"></i>
            </button>
            <button type="button" class="joint-event-btn joint-event-btn--danger" data-ceremony-remove title="Xóa" ${events.length <= MIN_CEREMONY_EVENTS ? "disabled" : ""} aria-label="Xóa sự kiện">
                <i class="bi bi-trash"></i>
            </button>
        `;
        head.appendChild(actions);
        row.appendChild(head);

        const titleLabel = document.createElement("label");
        titleLabel.textContent = "Tên sự kiện";
        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.dataset.ceremonyField = "title";
        titleInput.value = ev.title || "";
        titleInput.placeholder = "vd: BỮA CƠM, LỄ VU QUY…";
        titleLabel.appendChild(titleInput);
        row.appendChild(titleLabel);

        const dt = document.createElement("div");
        dt.className = "grid two compact-grid datetime-grid";
        const dateLabel = document.createElement("label");
        dateLabel.textContent = "Ngày";
        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.dataset.ceremonyField = "date";
        dateInput.value = ev.date || getMainWeddingDate();
        dateLabel.appendChild(dateInput);
        const timeLabel = document.createElement("label");
        timeLabel.textContent = "Giờ";
        const timeInput = document.createElement("input");
        timeInput.type = "time";
        timeInput.dataset.ceremonyField = "time";
        timeInput.value = ev.time || "18:00";
        timeLabel.appendChild(timeInput);
        dt.appendChild(dateLabel);
        dt.appendChild(timeLabel);
        row.appendChild(dt);

        const iconLabel = document.createElement("label");
        iconLabel.textContent = "Icon (concept timeline)";
        const iconSelect = document.createElement("select");
        iconSelect.dataset.ceremonyField = "icon";
        CEREMONY_EVENT_ICON_OPTIONS.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.id;
            option.textContent = opt.label;
            if (opt.id === ev.icon) option.selected = true;
            iconSelect.appendChild(option);
        });
        iconLabel.appendChild(iconSelect);
        row.appendChild(iconLabel);
        enhanceCustomSelect(iconSelect);

        list.appendChild(row);
    });

    updateAddCeremonyEventButton(role);
    if (typeof enhanceDateTimePickers === "function") {
        enhanceDateTimePickers(list);
    }
}

function renderJointEventsList() {
    renderCeremonyEventsList("joint");
}

function renderAllCeremonyEventsLists() {
    ["joint", "bride", "groom"].forEach(role => renderCeremonyEventsList(role));
}

function addCeremonyEvent(role) {
    syncCeremonyEventsStateFromDom(role);
    const list = ceremonyEventsState[role] || [];
    if (list.length >= MAX_CEREMONY_EVENTS) return;
    list.push({
        id: newCeremonyEventId(),
        title: `SỰ KIỆN ${list.length + 1}`,
        date: getMainWeddingDate(),
        time: "18:00",
        icon: "star"
    });
    ceremonyEventsState[role] = list;
    renderCeremonyEventsList(role);
    scheduleCeremonyEventsPreview();
}

function removeCeremonyEvent(role, eventId) {
    syncCeremonyEventsStateFromDom(role);
    let list = ceremonyEventsState[role] || [];
    if (list.length <= MIN_CEREMONY_EVENTS) return;
    list = list.filter(ev => ev.id !== eventId);
    if (!list.length) list = createDefaultCeremonyEvents(role);
    ceremonyEventsState[role] = list;
    renderCeremonyEventsList(role);
    scheduleCeremonyEventsPreview();
}

function moveCeremonyEvent(role, eventId, delta) {
    syncCeremonyEventsStateFromDom(role);
    const list = [...(ceremonyEventsState[role] || [])];
    const index = list.findIndex(ev => ev.id === eventId);
    if (index < 0) return;
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(next, 0, item);
    ceremonyEventsState[role] = list;
    renderCeremonyEventsList(role);
    scheduleCeremonyEventsPreview();
}

function scheduleCeremonyEventsPreview() {
    window.clearTimeout(scheduleCeremonyEventsPreview.timer);
    scheduleCeremonyEventsPreview.timer = window.setTimeout(() => {
        if (typeof refreshPreview !== "function") return;
        // Mobile: không auto mở tab preview khi sửa lịch / địa điểm
        refreshPreview(true, {
            focusPreview: false,
            previewState: { opened: true, scrollY: 0, target: ".timeline" }
        });
    }, 280);
}

function scheduleJointEventsPreview() {
    scheduleCeremonyEventsPreview();
}

function isCeremonyEventControl(target) {
    return Boolean(
        target?.closest?.("[data-ceremony-events-role]")
        || target?.closest?.("[data-ceremony-event-id]")
        || target?.dataset?.ceremonyField
        || target?.dataset?.jointField
    );
}

function isJointEventControl(target) {
    return isCeremonyEventControl(target);
}

/** Ẩn/hiện form lịch+maps theo mode + làm mới select concept timeline. */
function syncCeremonyModeUI() {
    const mode = getSelectedCeremonyMode();
    const separate = mode === "separate";

    const separatePanel = document.getElementById("ceremonySeparatePanel");
    const jointPanel = document.getElementById("ceremonyJointPanel");

    if (separatePanel) separatePanel.hidden = !separate;
    if (jointPanel) jointPanel.hidden = separate;

    if (separate) {
        if (!ceremonyEventsState.bride?.length) {
            ceremonyEventsState.bride = createDefaultCeremonyEvents("bride");
        }
        if (!ceremonyEventsState.groom?.length) {
            ceremonyEventsState.groom = createDefaultCeremonyEvents("groom");
        }
        renderCeremonyEventsList("bride");
        renderCeremonyEventsList("groom");
    } else if (!ceremonyEventsState.joint?.length) {
        ceremonyEventsState.joint = createDefaultCeremonyEvents("joint");
        renderCeremonyEventsList("joint");
    }

    populateBuilderBlockSelects(form, { ceremonyMode: mode });
    enhanceAllCustomSelects(form);
    syncMediaUploadVisibility();
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
        if (field.tagName === "SELECT") refreshCustomSelect(field);
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
    refreshCustomSelect(musicSelect);
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
    const emptyHint = document.getElementById("linksStepEmptyHint");
    if (emptyHint) emptyHint.hidden = true;
    document.body.dataset.hasResultLinks = "1";
    document.getElementById("builderLinksNavBtn")?.classList.add("has-links");
}

/** Mở tab Link thiệp (sau khi lưu / mở khóa). */
function goToLinksStep(options = {}) {
    goToBuilderStep(8, { scroll: true, ...options });
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
    // Đã mở sẵn → chỉ refresh nội dung, không “bật lại” lần 2
    const alreadyOpen = paymentModal.hidden === false;
    if (saveModal) saveModal.hidden = true;
    if (resultLinks) resultLinks.hidden = true;

    const { editUrl } = getShareUrls(weddingId);
    const orderCode = getOrderCode() || "—";
    if (paymentOrderCodeText) paymentOrderCodeText.textContent = orderCode;
    // Số tiền theo payment của wedding này (đã snapshot lúc lưu), không đọc settings live
    paymentAmountText.textContent = formatPaymentAmount(resolvePaymentAmountSource(loadedWeddingConfig));
    // Mã GD đã hiện ở #paymentOrderCodeText — không lặp “Mã của bạn: …”
    paymentMessageText.textContent = paymentSettings.message || DEFAULT_PAYMENT_SETTINGS.message;

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
    // Bắt đầu nghe unlock (SePay webhook → paymentStatus) — luôn (re)subscribe
    listenWeddingPayment(weddingId);
    if (alreadyOpen) {
        /* nội dung đã refresh ở trên */
    }
}

function showUnlockedLinks(weddingId, accessToken = getWeddingAccessToken()) {
    hidePaymentModal();
    updateResultLinks(weddingId, accessToken);
    showSaveModal(weddingId);
    goToLinksStep({ scroll: true });
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

/** Tránh snapshot paymentStatus/wedding bật lại popup đã đóng (hoặc bật 2 lần sau Lưu). */
let paymentUnlockPopupShown = false;

function applyPaymentSnapshot(payment = {}, weddingId = "") {
    if (!payment || typeof payment !== "object") return;
    loadedWeddingConfig = {
        ...loadedWeddingConfig,
        payment: { ...(loadedWeddingConfig.payment || {}), ...payment },
        plan: payment.plan || loadedWeddingConfig.plan
    };
    syncInvitePlanUI();
    const paid = payment.unlocked === true || payment.status === "paid";
    if (!paid) {
        paymentUnlockPopupShown = false;
        return;
    }
    // Chỉ hiện popup "đã mở khóa" một lần khi chuyển sang paid (SePay/admin)
    if (paymentUnlockPopupShown) return;
    paymentUnlockPopupShown = true;
    setStatus(`Da mo khoa thiep: ${weddingId}`, "success");
    showUnlockedLinks(weddingId, payment.accessToken || "");
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
    // Danh sách link nằm tab 8 — chuyển sẵn (popup vẫn mở)
    goToLinksStep({ scroll: false, instant: true });
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
    const text = String(value || "").trim();
    if (!text) {
        setStatus("Chưa có nội dung để copy.", "error");
        return;
    }
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
        }
        if (button) {
            const original = button.innerHTML;
            const iconOnly = button.classList.contains("guest-links__icon-btn");
            button.classList.add("is-copied");
            button.innerHTML = iconOnly
                ? '<i class="bi bi-check-lg"></i>'
                : '<i class="bi bi-check-lg"></i> Đã copy';
            window.setTimeout(() => {
                button.innerHTML = original;
                button.classList.remove("is-copied");
            }, 1400);
        }
    } catch (error) {
        console.error(error);
        setStatus("Không copy được, hãy copy thủ công.", "error");
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
        row.dataset.mediaField = fieldName;
        row.innerHTML = `
            <input type="hidden" name="${fieldName}">
            <input type="file" accept="image/*" data-upload-target="${fieldName}" tabindex="-1" aria-hidden="true">
            <div class="media-chip">
                <button type="button" class="media-chip__body" data-media-focus="${fieldName}" title="Xem gallery trên thiệp">
                    <span class="media-chip__thumb" aria-hidden="true">
                        <i class="bi bi-image media-chip__placeholder"></i>
                        <img alt="" data-media-thumb="${fieldName}" hidden>
                    </span>
                    <span class="media-chip__text">
                        <strong class="media-chip__title">Ảnh album ${number}</strong>
                        <em class="media-chip__hint" data-media-hint="${fieldName}">Chưa có ảnh</em>
                    </span>
                </button>
                <div class="media-chip__actions">
                    <button type="button" class="media-chip__btn media-chip__btn--upload" data-upload-button="${fieldName}">
                        <i class="bi bi-cloud-upload" aria-hidden="true"></i><span>Upload</span>
                    </button>
                    <button type="button" class="media-chip__btn media-chip__btn--delete" data-media-clear="${fieldName}" disabled aria-label="Xóa ảnh">
                        <i class="bi bi-trash" aria-hidden="true"></i><span>Xóa</span>
                    </button>
                </div>
            </div>
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

function rememberRemoteMediaUrl(fieldName, url, publicId = "") {
    if (fieldName && isRemoteMediaUrl(url)) {
        lastRemoteMediaUrls.set(fieldName, String(url).trim());
    }
    const id = String(publicId || extractCloudinaryPublicId(url) || "").trim();
    if (fieldName && id) {
        lastRemotePublicIds.set(fieldName, id);
    }
}

function getPreviousRemotePublicId(fieldName) {
    if (lastRemotePublicIds.has(fieldName)) {
        return lastRemotePublicIds.get(fieldName) || "";
    }
    return extractCloudinaryPublicId(getPreviousRemoteUrl(fieldName));
}

function normalizePublicIdCandidate(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const fromUrl = extractCloudinaryPublicId(s);
    if (fromUrl) return fromUrl;
    // raw public_id
    if (/^[\w./-]+$/.test(s) && !/^https?:/i.test(s)) {
        return s.replace(/\.[a-z0-9]+$/i, "");
    }
    return "";
}

/** Đưa public_id vào hàng đợi xóa (đổi/xóa ảnh). */
function queueCloudinaryDelete(urlOrPublicId, { force = false } = {}) {
    const id = normalizePublicIdCandidate(urlOrPublicId);
    if (!id) {
        console.warn("[builder] queueCloudinaryDelete: cannot parse public_id from", String(urlOrPublicId || "").slice(0, 120));
        return "";
    }
    // Không xóa nếu field khác vẫn trỏ cùng asset (trừ force)
    if (!force && isCloudinaryPublicIdInUse(id)) {
        console.info("[builder] skip queue delete (still in use):", id);
        return "";
    }
    orphanedCloudinaryPublicIds.add(id);
    console.info("[builder] queued Cloudinary delete:", id);
    return id;
}

function isCloudinaryPublicIdInUse(publicId, extraUrls = []) {
    const target = String(publicId || "").trim();
    if (!target) return false;
    const sameId = (a, b) => a && b && (a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`));
    const check = url => sameId(extractCloudinaryPublicId(url), target);
    for (const name of [...MEDIA_FIELD_NAMES, ...QR_PENDING_FIELDS]) {
        // Chỉ URL live https trên form — blob/empty không giữ asset
        const val = readField(name);
        if (!isRemoteMediaUrl(val)) continue;
        if (check(val)) return true;
    }
    for (const url of extraUrls) {
        if (check(url)) return true;
    }
    return false;
}

/** Public ids đang gắn trên form (URL https Cloudinary + map field). */
function collectLiveCloudinaryPublicIdsFromForm() {
    const ids = new Set();
    for (const name of [...MEDIA_FIELD_NAMES, ...QR_PENDING_FIELDS]) {
        const val = readField(name);
        if (!isRemoteMediaUrl(val)) continue;
        const fromUrl = extractCloudinaryPublicId(val);
        if (fromUrl) ids.add(fromUrl);
        const mapped = lastRemotePublicIds.get(name);
        if (mapped) ids.add(mapped);
    }
    return [...ids];
}

/**
 * Xóa 1 public_id: ưu tiên delete_token (browser), fallback /api/cloudinary-cleanup.
 */
async function destroyOneCloudinaryAsset(publicId) {
    const id = String(publicId || "").trim();
    if (!id) return { ok: false, publicId: id, error: "empty" };

    // Token có thể map đúng id hoặc id không có folder prefix
    let token = cloudinaryDeleteTokens.get(id);
    if (!token) {
        for (const [key, value] of cloudinaryDeleteTokens.entries()) {
            if (key === id || key.endsWith(`/${id}`) || id.endsWith(`/${key}`)) {
                token = value;
                break;
            }
        }
    }
    if (token) {
        const byToken = await destroyCloudinaryByDeleteToken(CLOUDINARY_CLOUD_NAME, token);
        if (byToken.ok) {
            forgetDeleteToken(id);
            // dọn alias keys
            [...cloudinaryDeleteTokens.keys()].forEach(key => {
                if (key === id || key.endsWith(`/${id}`) || id.endsWith(`/${key}`)) {
                    forgetDeleteToken(key);
                }
            });
            console.info("[builder] deleted via delete_token:", id);
            return { ok: true, publicId: id, method: "delete_token" };
        }
        console.warn("[builder] delete_by_token failed:", id, byToken.error || byToken);
    }

    const api = await requestCloudinaryCleanup([id]);
    if (api.ok && !api.skipped) {
        forgetDeleteToken(id);
        console.info("[builder] deleted via cleanup API:", id, api);
        return { ok: true, publicId: id, method: "cleanup_api", deleted: api.deleted };
    }
    if (
        api.skipped
        || api.error === "local_static_server_no_api"
        || api.error === "local_cleanup_proxy_offline"
        || api.error === "local_no_cleanup_api"
    ) {
        return {
            ok: false,
            publicId: id,
            error: api.error || "local_no_cleanup_api",
            hint: api.hint
                || "Local: chạy `npm run dev:cloudinary` (API_KEY+SECRET) hoặc bật Return delete token trên preset"
        };
    }
    return {
        ok: false,
        publicId: id,
        error: api.error || "cleanup_failed",
        status: api.status
    };
}

/** Xóa ngay 1 asset cũ (sau khi upload ảnh mới / clear). */
async function deleteReplacedCloudinaryAsset(oldPublicIdOrUrl, newPublicId = "") {
    const oldId = normalizePublicIdCandidate(oldPublicIdOrUrl);
    const newId = normalizePublicIdCandidate(newPublicId);
    if (!oldId || (newId && (oldId === newId))) return { ok: true, skipped: true };
    // Tạm gỡ map field trỏ old để isCloudinaryPublicIdInUse không chặn
    const touched = [];
    for (const name of [...MEDIA_FIELD_NAMES, ...QR_PENDING_FIELDS]) {
        if (lastRemotePublicIds.get(name) === oldId) {
            touched.push([name, lastRemotePublicIds.get(name)]);
            lastRemotePublicIds.delete(name);
        }
    }
    queueCloudinaryDelete(oldId, { force: true });
    const result = await destroyOneCloudinaryAsset(oldId);
    if (!result.ok) {
        // giữ trong orphan queue để flush lúc save
        orphanedCloudinaryPublicIds.add(oldId);
        // restore maps if delete failed and field still needs them? no — already replaced
    } else {
        orphanedCloudinaryPublicIds.delete(oldId);
    }
    return result;
}

/**
 * Xóa ảnh Cloudinary đã đánh dấu orphan.
 * 1) delete_token (local + production)
 * 2) /api/cloudinary-cleanup (CF Pages + env secret)
 */
async function flushOrphanedCloudinaryDeletes(liveIds = null) {
    const live = new Set(
        (liveIds || collectLiveCloudinaryPublicIdsFromForm()).map(s => String(s).trim()).filter(Boolean)
    );
    // prev list trên wedding − live = rác
    const prevListed = Array.isArray(loadedWeddingConfig.builder?.cloudinaryPublicIds)
        ? loadedWeddingConfig.builder.cloudinaryPublicIds
        : [];
    prevListed.forEach(item => {
        const id = String(item || "").trim().replace(/\.[a-z0-9]+$/i, "");
        if (id && !live.has(id) && ![...live].some(l => l === id || l.endsWith(`/${id}`) || id.endsWith(`/${l}`))) {
            orphanedCloudinaryPublicIds.add(id);
        }
    });

    // lastRemotePublicIds của field đã trống / đã đổi
    for (const name of [...MEDIA_FIELD_NAMES, ...QR_PENDING_FIELDS]) {
        const val = readField(name);
        const mapped = lastRemotePublicIds.get(name);
        if (!mapped) continue;
        if (!isRemoteMediaUrl(val)) {
            // field đã xóa / blob pending
            if (!isBlobUrl(val)) orphanedCloudinaryPublicIds.add(mapped);
        } else {
            const liveId = extractCloudinaryPublicId(val);
            if (liveId && liveId !== mapped) orphanedCloudinaryPublicIds.add(mapped);
        }
    }

    const toDelete = [...orphanedCloudinaryPublicIds].filter(id => {
        if (!id) return false;
        if (live.has(id)) return false;
        if ([...live].some(l => l === id || l.endsWith(`/${id}`) || id.endsWith(`/${l}`))) return false;
        return true;
    });
    orphanedCloudinaryPublicIds.clear();
    if (!toDelete.length) {
        console.info("[builder] Cloudinary cleanup: nothing to delete");
        return { ok: true, deleted: 0, skipped: true };
    }

    console.info("[builder] Cloudinary cleanup trying:", toDelete);

    sessionCloudinaryPublicIds = sessionCloudinaryPublicIds.filter(id => !toDelete.includes(id));

    let deleted = 0;
    const failed = [];
    for (const id of toDelete) {
        // eslint-disable-next-line no-await-in-loop
        const result = await destroyOneCloudinaryAsset(id);
        if (result.ok) deleted += 1;
        else {
            failed.push(id);
            orphanedCloudinaryPublicIds.add(id);
            console.warn("[builder] Cloudinary delete failed:", id, result.error || result);
        }
    }

    if (failed.length) {
        console.warn(
            "[builder] Còn %s ảnh chưa xóa được. Local: cần delete_token từ preset; production: /api/cloudinary-cleanup + env Cloudinary.",
            failed.length
        );
    } else {
        console.info("[builder] Cloudinary cleanup ok:", deleted, "asset(s)");
    }
    return { ok: failed.length === 0, deleted, failed };
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
            `Có ${broken.length} ảnh không còn trên Cloudinary (đã xóa/hỏng). Chọn lại ảnh rồi Lưu thiệp.`,
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

    async function postUpload(withDeleteToken) {
        const data = new FormData();
        data.append("file", blob, filename);
        data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        data.append("folder", folder);
        data.append("public_id", publicId);
        // Xin delete_token — xóa ảnh sau không cần API secret (preset phải cho phép)
        if (withDeleteToken) data.append("return_delete_token", "1");

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: data
        });
        const detail = await response.text();
        let parsed = {};
        try {
            parsed = detail ? JSON.parse(detail) : {};
        } catch (_) {
            parsed = { raw: detail };
        }
        return { ok: response.ok, status: response.status, detail, parsed };
    }

    // 1) Ưu tiên có delete_token; 2) fallback nếu preset chặn param
    let uploadResult = await postUpload(true);
    if (!uploadResult.ok) {
        const errMsg = String(uploadResult.parsed?.error?.message || uploadResult.detail || "");
        if (/delete_token|not allowed|invalid/i.test(errMsg)) {
            console.warn("[builder] return_delete_token bị preset chặn — upload lại không token");
            uploadResult = await postUpload(false);
        }
    }
    if (!uploadResult.ok) {
        throw new Error(formatCloudinaryError(uploadResult.detail));
    }

    const result = uploadResult.parsed || {};
    const url = String(result.secure_url || "").trim();
    if (!url) throw new Error("Cloudinary không trả về URL ảnh.");
    recordUpload();
    const storedPublicId = String(result.public_id || "").trim()
        || extractCloudinaryPublicId(url);
    if (storedPublicId && !sessionCloudinaryPublicIds.includes(storedPublicId)) {
        sessionCloudinaryPublicIds.push(storedPublicId);
    }
    const deleteToken = String(result.delete_token || "").trim();
    if (storedPublicId && deleteToken) {
        persistDeleteToken(storedPublicId, deleteToken);
    } else if (storedPublicId && !deleteToken) {
        console.warn(
            "[builder] Upload không có delete_token — bật Return delete token trên preset",
            CLOUDINARY_UPLOAD_PRESET,
            "hoặc deploy /api/cloudinary-cleanup"
        );
    }
    const version = result.version || Date.now();
    const versioned = url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
    return {
        url: versioned,
        publicId: storedPublicId,
        deleteToken
    };
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
        previousRemoteUrl: String(meta.previousRemoteUrl || ""),
        previousPublicId: String(meta.previousPublicId || "").trim()
    });
    return objectUrl;
}

function formatMediaBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 1024) return `${Math.round(n)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getMediaItemEl(fieldName) {
    return document.querySelector(`.media-item[data-media-field="${fieldName}"]`)
        || document.querySelector(`[data-upload-button="${fieldName}"]`)?.closest(".media-item")
        || null;
}

/**
 * Chip file gọn: empty = placeholder + “Chạm để chọn”; có ảnh = thumb + meta + nút xóa.
 * @param {string} fieldName
 * @param {string} url
 * @param {{ fileName?: string, fileSize?: number }} [meta]
 */
function showMediaReady(fieldName, url, meta = {}) {
    const item = getMediaItemEl(fieldName);
    const thumb = document.querySelector(`[data-media-thumb="${fieldName}"]`);
    const hint = document.querySelector(`[data-media-hint="${fieldName}"]`);
    const clearBtn = document.querySelector(`[data-media-clear="${fieldName}"]`);
    const pickBtn = document.querySelector(`[data-upload-button="${fieldName}"]`);
    if (!item && !thumb) return;

    const displayUrl = normalizeBuilderMediaUrl(url);
    if (displayUrl) {
        item?.classList.add("is-filled");
        if (thumb) {
            thumb.hidden = false;
            thumb.onload = null;
            thumb.onerror = () => {
                if (isRemoteMediaUrl(displayUrl) && readField(fieldName) === displayUrl) {
                    invalidateBrokenRemoteField(fieldName);
                } else {
                    showMediaReady(fieldName, "");
                }
            };
            thumb.src = isRemoteMediaUrl(displayUrl) ? cacheBustMediaUrl(displayUrl) : displayUrl;
        }
        if (hint) {
            const name = String(meta.fileName || item?.dataset.mediaFileName || "").trim();
            const size = formatMediaBytes(meta.fileSize ?? item?.dataset.mediaFileSize);
            if (name && size) hint.textContent = `${name} · ${size}`;
            else if (name) hint.textContent = name;
            else if (size) hint.textContent = size;
            else hint.textContent = isRemoteMediaUrl(displayUrl) ? "Đã lưu trên cloud" : "Đã chọn — lưu khi bấm Lưu thiệp";
        }
        if (clearBtn) {
            clearBtn.hidden = false;
            clearBtn.disabled = false;
        }
        if (pickBtn) {
            pickBtn.setAttribute("aria-label", "Upload / đổi ảnh");
            const label = pickBtn.querySelector("span");
            if (label && label.textContent.trim() === "Upload") {
                /* keep Upload label */
            }
        }

        if (isRemoteMediaUrl(displayUrl)) {
            remoteMediaUrlAlive(displayUrl).then(alive => {
                if (!alive && readField(fieldName) === displayUrl) {
                    invalidateBrokenRemoteField(fieldName);
                }
            });
        }
    } else {
        item?.classList.remove("is-filled");
        if (item) {
            delete item.dataset.mediaFileName;
            delete item.dataset.mediaFileSize;
        }
        if (thumb) {
            thumb.onload = null;
            thumb.onerror = null;
            thumb.removeAttribute("src");
            thumb.hidden = true;
        }
        if (hint) hint.textContent = "Chưa có ảnh · bấm để xem vị trí trên thiệp";
        if (clearBtn) {
            clearBtn.hidden = false;
            clearBtn.disabled = true;
        }
        if (pickBtn) pickBtn.setAttribute("aria-label", "Upload ảnh");
    }
}

function clearMediaField(fieldName) {
    if (!fieldName) return;
    // Lấy public_id / URL trước khi xóa field — xóa Cloudinary ngay (best-effort)
    const current = readField(fieldName);
    const previous = getPreviousRemoteUrl(fieldName) || lastRemoteMediaUrls.get(fieldName) || "";
    const oldPublicId = lastRemotePublicIds.get(fieldName)
        || extractCloudinaryPublicId(isRemoteMediaUrl(current) ? current : previous);
    clearPendingMedia(fieldName);
    clearPendingQr(fieldName);
    lastRemoteMediaUrls.delete(fieldName);
    lastRemotePublicIds.delete(fieldName);
    clearStoredFingerprint(fieldName);
    setField(fieldName, "");
    const input = document.querySelector(`[data-upload-target="${fieldName}"], [data-qr-input="${fieldName}"]`);
    if (input) input.value = "";
    if (isQrMediaField(fieldName)) showQrReady(fieldName, "");
    else showMediaReady(fieldName, "");
    setStatus("");
    refreshPreview(false);
    if (oldPublicId) {
        deleteReplacedCloudinaryAsset(oldPublicId).then(result => {
            if (!result?.ok && !result?.skipped) {
                console.warn("[builder] clearMediaField delete failed:", oldPublicId, result);
            }
        });
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
    const item = getMediaItemEl(fieldName);
    const hint = document.querySelector(`[data-media-hint="${fieldName}"]`);
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
        if (button) button.disabled = true;
        if (item) item.classList.add("is-processing");
        if (hint) hint.textContent = "Đang xử lý…";

        const fileMeta = {
            fileName: String(file.name || "image").trim() || "image",
            fileSize: Number(file.size) || 0
        };
        if (item) {
            item.dataset.mediaFileName = fileMeta.fileName;
            item.dataset.mediaFileSize = String(fileMeta.fileSize || "");
        }

        const previousRemoteUrl = getPreviousRemoteUrl(fieldName);
        const previousPublicId = getPreviousRemotePublicId(fieldName)
            || extractCloudinaryPublicId(previousRemoteUrl);
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
            showMediaReady(fieldName, previousRemoteUrl, fileMeta);
            rememberRemoteMediaUrl(fieldName, previousRemoteUrl, previousPublicId);
            setStatus("");
            refreshPreview(false);
            return;
        }

        const blob = await compressImageFile(file, options);
        if (!blob) throw new Error("Không nén được ảnh.");
        // Ảnh mới (hoặc URL cũ chết) → pending, Lưu Firebase sẽ upload public_id unique
        const objectUrl = setPendingMediaBlob(fieldName, blob, {
            sourceHash,
            previousRemoteUrl,
            previousPublicId
        });
        setField(fieldName, objectUrl);
        showMediaReady(fieldName, objectUrl, {
            ...fileMeta,
            fileSize: Number(blob.size) || fileMeta.fileSize
        });
        setStatus("");
        refreshPreview(false);
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Xử lý ảnh thất bại.", "error");
        // Khôi phục hint nếu fail
        const current = readField(fieldName);
        showMediaReady(fieldName, current);
    } finally {
        mediaStageInFlight = Math.max(0, mediaStageInFlight - 1);
        if (button) button.disabled = false;
        if (item) item.classList.remove("is-processing");
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
                previousRemoteUrl: lastRemoteMediaUrls.get(fieldName) || "",
                previousPublicId: lastRemotePublicIds.get(fieldName)
                    || extractCloudinaryPublicId(lastRemoteMediaUrls.get(fieldName) || "")
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
        const oldPublicId = pending.previousPublicId
            || getPreviousRemotePublicId(fieldName)
            || extractCloudinaryPublicId(pending.previousRemoteUrl)
            || extractCloudinaryPublicId(lastRemoteMediaUrls.get(fieldName) || "");
        // Gỡ map public_id cũ TRƯỚC khi ghi URL mới (tránh “still in use”)
        if (oldPublicId) lastRemotePublicIds.delete(fieldName);

        const uploaded = await uploadBlobToCloudinary(pending.blob, `${fieldName}.jpg`, {
            assetKey: fieldName
        });
        const url = uploaded?.url || "";
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
        rememberRemoteMediaUrl(fieldName, url, uploaded.publicId);

        // Xóa ngay ảnh cũ trên Cloudinary (delete_token hoặc cleanup API)
        if (oldPublicId && oldPublicId !== uploaded.publicId) {
            setStatus(`Đang xóa ảnh cũ ${fieldName} trên Cloudinary…`);
            // eslint-disable-next-line no-await-in-loop
            const del = await deleteReplacedCloudinaryAsset(oldPublicId, uploaded.publicId);
            if (!del.ok && !del.skipped) {
                console.warn("[builder] immediate delete failed, will retry on flush:", oldPublicId, del);
            }
        }
    }
}

function assertNoBlobMediaUrls() {
    const bad = MEDIA_FIELD_NAMES.filter(
        name => isMediaFieldActive(name) && isBlobUrl(readField(name))
    );
    if (bad.length) {
        throw new Error(`Ảnh vẫn còn bản tạm: ${bad.join(", ")}. Thử chọn lại rồi Lưu thiệp.`);
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
        previousRemoteUrl: String(meta.previousRemoteUrl || ""),
        previousPublicId: String(meta.previousPublicId || "").trim()
    });
    return objectUrl;
}

function showQrReady(fieldName, url) {
    // Đồng bộ UI chip (thumb + nút Xóa) giống media
    showMediaReady(fieldName, url, {
        fileName: url ? `Đã cắt ${QR_FIELD_LABELS[fieldName] || "QR"}` : ""
    });
    const ready = document.querySelector(`[data-qr-ready="${fieldName}"]`);
    if (ready) ready.hidden = true; // legacy marker — UI dùng chip
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
        const oldPublicId = pending.previousPublicId
            || getPreviousRemotePublicId(fieldName)
            || extractCloudinaryPublicId(pending.previousRemoteUrl)
            || extractCloudinaryPublicId(lastRemoteMediaUrls.get(fieldName) || "");
        if (oldPublicId) lastRemotePublicIds.delete(fieldName);

        const uploaded = await uploadBlobToCloudinary(pending.blob, `${fieldName}.png`, {
            assetKey: fieldName
        });
        const url = uploaded?.url || "";
        if (!url || !isRemoteMediaUrl(url)) {
            throw new Error(`Upload ${QR_FIELD_LABELS[fieldName] || fieldName} thất bại.`);
        }
        if (pending.sourceHash) setStoredFingerprint(fieldName, pending.sourceHash);
        clearPendingQr(fieldName);
        setField(fieldName, url);
        showQrReady(fieldName, url);
        rememberRemoteMediaUrl(fieldName, url, uploaded.publicId);

        if (oldPublicId && oldPublicId !== uploaded.publicId) {
            setStatus(`Đang xóa QR cũ trên Cloudinary…`);
            // eslint-disable-next-line no-await-in-loop
            const del = await deleteReplacedCloudinaryAsset(oldPublicId, uploaded.publicId);
            if (!del.ok && !del.skipped) {
                console.warn("[builder] QR immediate delete failed:", oldPublicId, del);
            }
        }
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
        const previousPublicId = getPreviousRemotePublicId(fieldName)
            || extractCloudinaryPublicId(previousRemoteUrl);
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
            rememberRemoteMediaUrl(fieldName, previousRemoteUrl, previousPublicId);
            closeQrCropModal();
            setStatus("");
            refreshPreview(false);
            return;
        }

        // QR mới / crop khác — pending, Lưu Firebase mới upload
        const objectUrl = setPendingQrBlob(fieldName, blob, {
            sourceHash,
            previousRemoteUrl,
            previousPublicId
        });
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
    const urlPoint = parseLatLngFromMapUrl(readField(getMapUrlFieldForRole(role)));
    if (urlPoint) return urlPoint;
    return { lat: 20.8449, lng: 106.6881 };
}

function getRoleAddressSeed(role) {
    if (role === "joint") return readField("jointAddress");
    return readField(role === "bride" ? "brideAddress" : "groomAddress");
}

function getMapUrlFieldForRole(role) {
    if (role === "joint") return "jointMapUrl";
    return role === "bride" ? "brideMapUrl" : "groomMapUrl";
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
        mapPickerTitle.textContent = role === "joint"
            ? "Chọn địa điểm tổ chức chung trên bản đồ"
            : role === "bride"
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

    const fieldName = getMapUrlFieldForRole(activeMapPickerRole);
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
            mode: getSelectedCeremonyMode(),
            image: isMediaFieldActive("timelineImage") ? readField("timelineImage") : "",
            joint: (() => {
                const mainDate = readText(data, "date") || fallbackWedding.date || "";
                const events = getJointEventsForSave();
                const legacy = buildJointLegacyMirror(events, mainDate);
                return {
                    events,
                    ...legacy,
                    address: readText(data, "jointAddress"),
                    location: String(readText(data, "jointAddress") || "")
                        ? (extractProvinceFromAddress(readText(data, "jointAddress")) || "")
                        : (loadedWeddingConfig.ceremony?.joint?.location || ""),
                    mapUrl: readText(data, "jointMapUrl")
                };
            })(),
            bride: (() => {
                const mainDate = readText(data, "date") || fallbackWedding.date || "";
                const events = getCeremonyEventsForSave("bride");
                const legacy = buildCeremonyLegacyMirror(events, "bride", mainDate);
                return {
                    events,
                    ...legacy,
                    address: readText(data, "brideAddress"),
                    location: resolveHouseLocationInput(data, "bride", "brideAddress", "brideLocation"),
                    mapUrl: readText(data, "brideMapUrl")
                };
            })(),
            groom: (() => {
                const mainDate = readText(data, "date") || fallbackWedding.date || "";
                const events = getCeremonyEventsForSave("groom");
                const legacy = buildCeremonyLegacyMirror(events, "groom", mainDate);
                return {
                    events,
                    ...legacy,
                    address: readText(data, "groomAddress"),
                    location: resolveHouseLocationInput(data, "groom", "groomAddress", "groomLocation"),
                    mapUrl: readText(data, "groomMapUrl")
                };
            })()
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
    removeIfBlank(next.ceremony?.joint, "mapUrl");
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
    setControlValue("jointMapUrl", config.ceremony?.joint?.mapUrl);
    setControlValue("date", config.date);

    const ceremonyMode = config.ceremony?.mode === "joint" ? "joint" : "separate";
    setCeremonyMode(ceremonyMode);

    const mainWeddingDate = config.date || getMainWeddingDate();
    ceremonyEventsState.joint = jointEventsFromLegacyJoint(
        config.ceremony?.joint || {},
        mainWeddingDate
    );
    ceremonyEventsState.bride = ceremonyEventsFromLegacyHouse(
        config.ceremony?.bride || {},
        "bride",
        mainWeddingDate
    );
    ceremonyEventsState.groom = ceremonyEventsFromLegacyHouse(
        config.ceremony?.groom || {},
        "groom",
        mainWeddingDate
    );
    renderAllCeremonyEventsLists();
    setControlValue("jointAddress", config.ceremony?.joint?.address);

    setControlValue("primaryColor", theme.primaryColor || BRAND_PRIMARY);
    populateMusicOptions(config);
    setControlValue("music", config.music);
    clearAllPendingMedia();
    clearPendingQr("giftGroomQr");
    clearPendingQr("giftBrideQr");
    lastRemoteMediaUrls.clear();
    lastRemotePublicIds.clear();
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
    rememberRemoteMediaUrl("coverPosterImage", coverUrl, extractCloudinaryPublicId(coverUrl));
    setControlValue("previewImage", previewUrl);
    showMediaReady("previewImage", previewUrl);
    rememberRemoteMediaUrl("previewImage", previewUrl, extractCloudinaryPublicId(previewUrl));
    setControlValue("aboutImage", aboutUrl);
    showMediaReady("aboutImage", aboutUrl);
    rememberRemoteMediaUrl("aboutImage", aboutUrl, extractCloudinaryPublicId(aboutUrl));
    setControlValue("timelineImage", timelineUrl);
    showMediaReady("timelineImage", timelineUrl);
    rememberRemoteMediaUrl("timelineImage", timelineUrl, extractCloudinaryPublicId(timelineUrl));
    setControlValue("countdownImage", countdownUrl);
    showMediaReady("countdownImage", countdownUrl);
    rememberRemoteMediaUrl("countdownImage", countdownUrl, extractCloudinaryPublicId(countdownUrl));
    setControlValue("groomAvatar", groomAvatarUrl);
    showMediaReady("groomAvatar", groomAvatarUrl);
    rememberRemoteMediaUrl("groomAvatar", groomAvatarUrl, extractCloudinaryPublicId(groomAvatarUrl));
    setControlValue("brideAvatar", brideAvatarUrl);
    showMediaReady("brideAvatar", brideAvatarUrl);
    rememberRemoteMediaUrl("brideAvatar", brideAvatarUrl, extractCloudinaryPublicId(brideAvatarUrl));

    setControlValue("giftGroomQr", giftGroomQrUrl);
    showQrReady("giftGroomQr", giftGroomQrUrl);
    rememberRemoteMediaUrl("giftGroomQr", giftGroomQrUrl, extractCloudinaryPublicId(giftGroomQrUrl));
    setControlValue("giftGroomBank", config.gift?.groom?.bank);
    setControlValue("giftGroomAccountName", config.gift?.groom?.accountName);
    setControlValue("giftGroomAccountNumber", config.gift?.groom?.accountNumber);
    setControlValue("giftBrideQr", giftBrideQrUrl);
    showQrReady("giftBrideQr", giftBrideQrUrl);
    rememberRemoteMediaUrl("giftBrideQr", giftBrideQrUrl, extractCloudinaryPublicId(giftBrideQrUrl));
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
        rememberRemoteMediaUrl(fieldName, src, extractCloudinaryPublicId(src));
    });
    // Fill timeline skins theo mode trước khi gán value
    populateBuilderBlockSelects(form, { ceremonyMode });
    enhanceAllCustomSelects(form);
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

    // Mode lịch + ẩn/hiện form + ô ảnh theo concept
    // (events bride/groom/joint đã render ở trên)
    syncCeremonyModeUI();
}

/**
 * Load doc Firebase → config builder.
 * Thiệp cũ không có ceremony.mode / events[] / joint → giữ title/time/meal,
 * không dính events mẫu từ fallbackWedding (tránh lịch sai khi mở sửa).
 */
function buildLoadedConfigFromData(weddingId, data = {}) {
    const rawCeremony = data.ceremony || {};
    const stripFallbackEvents = (role, fallbackHouse = {}, rawHouse = {}) => {
        const meal = {
            ...(fallbackHouse.meal || {}),
            ...(rawHouse.meal || {})
        };
        const merged = {
            ...(fallbackHouse || {}),
            ...(rawHouse || {}),
            meal
        };
        // Doc không có events[] → bỏ mảng mẫu, migrate lúc fill form từ title/meal
        if (!Array.isArray(rawHouse?.events) || !rawHouse.events.length) {
            delete merged.events;
        }
        return merged;
    };

    const hasRawJoint = rawCeremony.joint && typeof rawCeremony.joint === "object";
    const ceremony = {
        ...(fallbackWedding.ceremony || {}),
        ...rawCeremony,
        // Thiệp cũ không có mode → separate (2 nhà)
        mode: rawCeremony.mode === "joint" ? "joint" : "separate",
        bride: stripFallbackEvents(
            "bride",
            fallbackWedding.ceremony?.bride,
            rawCeremony.bride || {}
        ),
        groom: stripFallbackEvents(
            "groom",
            fallbackWedding.ceremony?.groom,
            rawCeremony.groom || {}
        ),
        joint: hasRawJoint
            ? stripFallbackEvents("joint", fallbackWedding.ceremony?.joint, rawCeremony.joint)
            : {
                // Không ghi events mẫu vào state load — form joint dùng default khi user bật mode joint
                address: "",
                location: "",
                mapUrl: "",
                title: "",
                time: "",
                meal: { title: "", time: "" }
            }
    };

    // Thiệp cũ không field image → đừng dính path img/ mẫu
    if (!Object.prototype.hasOwnProperty.call(rawCeremony, "image")
        || !String(rawCeremony.image || "").trim()) {
        if (String(ceremony.image || "").startsWith("img/")) {
            delete ceremony.image;
        }
        if (!String(rawCeremony.image || "").trim()) {
            delete ceremony.image;
        }
    }

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
        ceremony,
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
    // Lịch tổ chức — ngày chính (poster / countdown / save-date)
    date: ".poster",
    // Lịch tổ chức riêng / chung → timeline
    brideAddress: ".timeline",
    groomAddress: ".timeline",
    jointAddress: ".timeline",
    // Poster (cô dâu / chú rể)
    brideLocation: ".poster",
    groomLocation: ".poster"
};

/** Ô upload ảnh → section preview (click body chip để nhảy đúng chỗ trên thiệp).
 *  previewImage = ảnh OG khi gửi link — không hiện trên thiệp → không map. */
const MEDIA_PREVIEW_MAP = {
    coverPosterImage: ".poster",
    aboutImage: ".about",
    timelineImage: ".timeline",
    countdownImage: ".countdown",
    groomAvatar: ".about",
    brideAvatar: ".about",
    giftGroomQr: ".gift",
    giftBrideQr: ".gift",
    ...Object.fromEntries(
        Array.from({ length: GALLERY_SIZE }, (_, i) => [`galleryPhoto${i + 1}`, ".gallery"])
    )
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
    if (Object.prototype.hasOwnProperty.call(MEDIA_PREVIEW_MAP, name)) return true;
    return false;
}

function readPreviewState() {
    try {
        const id = getBuilderPreviewTabId();
        return JSON.parse(
            sessionStorage.getItem(PREVIEW_STATE_KEY)
            || localStorage.getItem(`weddingBuilderPreviewState:${id}`)
            || localStorage.getItem(PREVIEW_STATE_KEY)
            || "null"
        ) || { ...COVER_PREVIEW_STATE };
    } catch (error) {
        return { ...COVER_PREVIEW_STATE };
    }
}

function savePreviewState(state) {
    writeBuilderPreviewState({
        opened: Boolean(state?.opened),
        scrollY: Math.max(0, Math.round(Number(state?.scrollY || 0))),
        target: String(state?.target || "")
    });
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
    if (MEDIA_PREVIEW_MAP[name]) {
        return MEDIA_PREVIEW_MAP[name];
    }
    const targetMap = getPreviewTargetMap();
    return targetMap[name] || "";
}

/** Highlight ô ảnh đang focus + nhảy preview thiệp (nếu field có trên thiệp). */
function focusMediaFieldPreview(fieldName) {
    const name = String(fieldName || "").trim();
    if (!name) return;
    // Ảnh preview gửi link — không có section trên thiệp, không nhảy màn preview
    if (name === "previewImage") return;

    document.querySelectorAll(".media-item.is-preview-focus, .qr-upload.is-preview-focus").forEach(el => {
        el.classList.remove("is-preview-focus");
    });
    const item = document.querySelector(`.media-item[data-media-field="${name}"], .qr-upload[data-qr-box="${name}"]`);
    item?.classList.add("is-preview-focus");
    if (isSectionJumpField(name)) {
        jumpPreviewToField(name, {
            updateStatus: false,
            focusPreview: isMobileBuilderLayout()
        });
    }
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
    // Đóng drawer bước khi sang preview
    if (next === "preview") setBuilderSidebarOpen(false);
}

function scrollToPreviewPanel() {
    const panel = document.getElementById("previewPanel");
    if (!panel) return;

    setBuilderMobileTab("preview");
    requestAnimationFrame(() => {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

/** postMessage type — khớp js/app.js BUILDER_PREVIEW_SOFT_MSG */
const BUILDER_PREVIEW_SOFT_MSG = "wedding-builder-preview-soft";

/**
 * Soft update: iframe đã load preview=builder → chỉ postMessage + localStorage.
 * Tránh frame.src = …&cb= → full reload HTML/CSS/JS + re-fetch ảnh Cloudinary.
 * Hard reload khi: iframe chưa sẵn sàng, options.hard, hoặc srcdoc lỗi.
 */
function isPreviewFrameSoftReady() {
    if (!frame) return false;
    try {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        if (!win || !doc) return false;
        // srcdoc trang lỗi (thiếu wedding) — không soft
        if (frame.srcdoc) return false;
        const href = String(win.location?.href || "");
        if (!href || href === "about:blank") return false;
        const params = new URLSearchParams(win.location.search || "");
        return params.get("preview") === "builder";
    } catch {
        return false;
    }
}

function softNotifyPreviewFrame(previewState) {
    try {
        const win = frame?.contentWindow;
        if (!win) return false;
        win.postMessage({
            type: BUILDER_PREVIEW_SOFT_MSG,
            previewState: {
                opened: Boolean(previewState?.opened),
                scrollY: Number(previewState?.scrollY || 0),
                target: String(previewState?.target || "")
            },
            ts: Date.now()
        }, window.location.origin);
        return true;
    } catch {
        return false;
    }
}

function hardReloadPreviewFrame(previewState) {
    previewLoadToken += 1;
    // section + open + ptab: iframe đọc đúng config tab này
    // vd ?preview=builder&open=1&section=timeline&ptab=pt_xxx
    const sectionId = String(previewState.target || "").replace(/^\./, "").trim();
    const ptab = getBuilderPreviewTabId();
    const qs = new URLSearchParams({
        preview: "builder",
        open: (previewState.opened || sectionId) ? "1" : "0",
        cb: String(Date.now()),
        pt: String(previewLoadToken),
        ptab
    });
    if (sectionId) qs.set("section", sectionId);
    // Xóa srcdoc lỗi (nếu có) trước khi gán src
    try {
        frame.removeAttribute("srcdoc");
    } catch {
        /* ignore */
    }
    frame.src = `../index.html?${qs.toString()}`;
}

function refreshPreview(updateStatus = true, options = {}) {
    const config = createPreviewConfig();
    // localStorage + ptab: iframe đọc được (sessionStorage parent ≠ iframe)
    writeBuilderPreviewConfig(config);

    const previewState = resolvePreviewState(options);
    // Có target section → luôn opened (bỏ màn cover)
    if (previewState.target) {
        previewState.opened = true;
    }
    savePreviewState(previewState);

    const sectionId = String(previewState.target || "").replace(/^\./, "").trim();
    const forceHard = options.hard === true || options.forceHard === true;
    const canSoft = !forceHard && isPreviewFrameSoftReady();

    if (canSoft && softNotifyPreviewFrame(previewState)) {
        // Soft: không đụng frame.src → ảnh Cloudinary đã cache trong DOM không tải lại
        // Không toast "Đã cập nhật preview · …" — khách không cần thấy
        if (options.focusPreview) {
            scrollToPreviewPanel();
        }
        return;
    }

    hardReloadPreviewFrame(previewState);

    if (options.focusPreview) {
        scrollToPreviewPanel();
    }
}

/** Nút "Xem preview" / "Xem từ đầu": hard-load cover — tin cậy (soft chỉ cho gõ form). */
function handlePreviewClick() {
    lastJumpFieldName = "";
    window.clearTimeout(refreshPreview.timer);
    refreshPreview(true, {
        focusPreview: true,
        mode: "cover",
        // Hard: tránh soft kẹt cover trắng / isOpening sau nhiều lần soft
        hard: true
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

/**
 * Mobile: rời ô title/subtitle/lịch → chỉ nhớ section, KHÔNG auto mở tab preview
 * (bước “Lịch & địa điểm” + “Tiêu đề & mô tả”). User bấm “Xem” khi cần.
 */
function handleTitleSubtitleFocusOut(event) {
    const field = event.target;
    const name = String(field?.name || "").trim();
    if (!TITLE_SUBTITLE_PREVIEW_MAP[name]) return;
    if (!isMobileBuilderLayout()) return;

    // Chỉ ghi nhớ field để khi user mở preview thủ công → đúng section
    rememberJumpField(name);
}

/** Chặn double-submit (Enter / double-click) → popup Lưu 2 lần. */
let saveConfigInFlight = false;

async function saveConfig(event) {
    event.preventDefault();
    if (saveConfigInFlight) return;
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

    saveConfigInFlight = true;
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
            throw new Error("Đang xử lý ảnh — đợi giây lát rồi Lưu thiệp lại.");
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
            throw new Error(`Ảnh tạm chưa upload xong: ${blobMedia.join(", ")}. Thử chọn lại rồi Lưu thiệp.`);
        }

        let payload = createSavePayload();
        const groomQr = payload.gift?.groom?.qr || "";
        const brideQr = payload.gift?.bride?.qr || "";
        if (isBlobUrl(groomQr) || isBlobUrl(brideQr)) {
            throw new Error("QR vẫn còn bản tạm (blob). Thử cắt lại rồi Lưu thiệp.");
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
        // Chỉ lưu public_id còn gắn URL trên form (đã flush upload)
        const liveCloudinaryIds = collectLiveCloudinaryPublicIdsFromForm();

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
            cloudinaryPublicIds: liveCloudinaryIds
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

        // Xóa ảnh Cloudinary đã bỏ / thay (delete_token hoặc cleanup API)
        let cleanupNote = "";
        try {
            const cleanupResult = await flushOrphanedCloudinaryDeletes(liveCloudinaryIds);
            if (cleanupResult?.deleted > 0) {
                cleanupNote = ` · đã xóa ${cleanupResult.deleted} ảnh cũ Cloudinary`;
            } else if (cleanupResult?.failed?.length) {
                cleanupNote = ` · ${cleanupResult.failed.length} ảnh cũ chưa xóa được (cần delete_token / API cleanup)`;
                console.warn("[builder] orphan cleanup failed ids:", cleanupResult.failed);
            }
        } catch (cleanupError) {
            console.warn("[builder] orphan Cloudinary cleanup error:", cleanupError);
        }

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
        // Lưu nháp xong → khóa gói ngay (không chờ admin duyệt)
        setInvitePlan(payload.plan || "single");
        syncInvitePlanUI();
        const savedCode = normalizeOrderCode(payload.payment?.orderCode) || "";
        setStatus(
            (savedCode
                ? `Đã lưu bản nháp. Mã giao dịch: ${savedCode}`
                : "Đã lưu bản nháp thành công.") + cleanupNote,
            "success"
        );
        refreshPreview(false);
        // Một lần hiện popup: paid → link thiệp; chưa paid → chờ TT.
        // Không gọi listenWeddingPayment trước — showPaymentModal / snapshot SePay tự listen.
        // Đánh dấu unlock đã “xử lý UI” nếu đã paid để onSnapshot không bật lại popup.
        if (isPaymentUnlocked(payload)) {
            paymentUnlockPopupShown = true;
            showUnlockedLinks(payload.weddingId, payload.payment?.accessToken || "");
            listenWeddingPayment(payload.weddingId);
        } else {
            paymentUnlockPopupShown = false;
            showPaymentModal(payload.weddingId);
        }
    } catch (error) {
        console.error(error);
        const message = String(error?.message || "").trim();
        setStatus(
            message
                ? `Lưu thất bại: ${message.slice(0, 160)}`
                : "Lưu thiệp thất bại. Kiem tra dang nhap hoac Firestore Rules.",
            "error"
        );
    } finally {
        saveConfigInFlight = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Lưu thiệp';
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
    const clearBtn = event.target.closest("[data-media-clear]");
    if (clearBtn) {
        event.preventDefault();
        event.stopPropagation();
        if (clearBtn.disabled) return;
        // Xóa ảnh: chỉ clear field, không chuyển màn preview
        clearMediaField(clearBtn.dataset.mediaClear);
        return;
    }

    // Upload / đổi ảnh: chỉ mở file picker — không nhảy màn preview
    const button = event.target.closest("[data-upload-button]");
    if (button) {
        event.preventDefault();
        event.stopPropagation();
        const fieldName = button.dataset.uploadButton;
        if (document.querySelector(`[data-qr-input="${fieldName}"]`)) {
            pickQrFile(fieldName);
            return;
        }
        if (document.querySelector(`[data-upload-target="${fieldName}"]`)) {
            pickMediaFile(fieldName);
        }
        return;
    }

    // Click body ô ảnh → nhảy preview đúng section (trừ previewImage — OG link)
    const focusBtn = event.target.closest("[data-media-focus]");
    if (focusBtn) {
        event.preventDefault();
        const fieldName = focusBtn.dataset.mediaFocus;
        if (fieldName === "previewImage") return;
        focusMediaFieldPreview(fieldName);
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
    // Sự kiện joint / nhà trai / nhà gái
    if (isCeremonyEventControl(event.target)) {
        const role = event.target.closest("[data-ceremony-events-role]")?.dataset?.ceremonyEventsRole
            || event.target.closest("[data-ceremony-event-id]")?.dataset?.ceremonyEventsRole
            || "joint";
        syncCeremonyEventsStateFromDom(role);
        scheduleCeremonyEventsPreview();
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
    if (isCeremonyEventControl(event.target)) {
        const role = event.target.closest("[data-ceremony-events-role]")?.dataset?.ceremonyEventsRole
            || event.target.closest("[data-ceremony-event-id]")?.dataset?.ceremonyEventsRole
            || "joint";
        syncCeremonyEventsStateFromDom(role);
        scheduleCeremonyEventsPreview();
        return;
    }
    if (event.target?.name === "ceremonyMode") {
        syncCeremonyModeUI();
        // Mobile: không auto sang preview khi đổi hình thức tổ chức
        refreshPreview(true, {
            focusPreview: false,
            previewState: { opened: true, scrollY: 0, target: ".timeline" }
        });
    }
});

// Ceremony events: thêm / xóa / sắp xếp (joint + bride + groom)
document.querySelectorAll("[data-add-ceremony-events]").forEach(btn => {
    btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-add-ceremony-events");
        if (role) addCeremonyEvent(role);
    });
});
document.querySelectorAll("[data-ceremony-events-role]").forEach(list => {
    list.addEventListener("click", event => {
        const row = event.target.closest("[data-ceremony-event-id]");
        if (!row) return;
        const role = row.dataset.ceremonyEventsRole
            || list.dataset.ceremonyEventsRole
            || "joint";
        const id = row.dataset.ceremonyEventId;
        if (event.target.closest("[data-ceremony-remove]")) {
            removeCeremonyEvent(role, id);
            return;
        }
        const moveBtn = event.target.closest("[data-ceremony-move]");
        if (moveBtn) {
            const delta = Number(moveBtn.getAttribute("data-ceremony-move") || 0);
            moveCeremonyEvent(role, id, delta);
        }
    });
});

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
            // Logic cũ: mở preview đúng section vừa chỉnh (concept/title…)
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

// Nút riêng "Xem từ đầu" → cover (không đụng logic jump concept)
// Desktop: preview-panel__head · Mobile: chrome khi đang preview
["previewFromStartBtn", "previewFromStartBtnMobile"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => {
        handlePreviewClick();
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
populateBuilderBlockSelects(form, { ceremonyMode: getSelectedCeremonyMode() });
// Custom select gắn sau initCustomSelects; block options đã có sẵn cho observer
renderBuilderGalleryFields();
ceremonyEventsState.joint = createDefaultCeremonyEvents("joint");
ceremonyEventsState.bride = createDefaultCeremonyEvents("bride");
ceremonyEventsState.groom = createDefaultCeremonyEvents("groom");
renderAllCeremonyEventsLists();
syncCeremonyModeUI();
Promise.all([
    loadPaymentSettings(),
    loadMusicLibrary()
]).then(() => loadConfigForEdit()).then(() => {
    populateMusicOptions(loadedWeddingConfig);
    if (!ceremonyEventsState.joint?.length) {
        ceremonyEventsState.joint = createDefaultCeremonyEvents("joint");
    }
    if (!ceremonyEventsState.bride?.length) {
        ceremonyEventsState.bride = createDefaultCeremonyEvents("bride");
    }
    if (!ceremonyEventsState.groom?.length) {
        ceremonyEventsState.groom = createDefaultCeremonyEvents("groom");
    }
    renderAllCeremonyEventsLists();
    syncCeremonyModeUI();
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
        setStatus("Chưa có mã giao dịch. Hãy Lưu thiệp trước.", "error");
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

/* ============================================================
   Custom date / time pickers — native popup không đổi màu brand
   ============================================================ */
const MONTH_LABELS_VI = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];

const datePopover = document.getElementById("builderDatePopover");
const dateMonthLabel = document.getElementById("builderDateMonthLabel");
const dateGrid = document.getElementById("builderDateGrid");
const timePopover = document.getElementById("builderTimePopover");
const timeHoursList = document.getElementById("builderTimeHours");
const timeMinutesList = document.getElementById("builderTimeMinutes");

let activeDateInput = null;
let activeTimeInput = null;
let pickerViewYear = 0;
let pickerViewMonth = 0; // 0–11
let pendingTimeHour = 0;
let pendingTimeMinute = 0;

function pad2(n) {
    return String(n).padStart(2, "0");
}

function parseIsoDate(value) {
    const m = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    return dt;
}

function parseTimeValue(value) {
    const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return { hour: 18, minute: 0 };
    return {
        hour: Math.min(23, Math.max(0, Number(m[1]) || 0)),
        minute: Math.min(59, Math.max(0, Number(m[2]) || 0))
    };
}

function positionPopover(popover, anchor) {
    if (!popover || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const pw = popover.offsetWidth || 292;
    const ph = popover.offsetHeight || 320;
    let left = rect.left;
    let top = rect.bottom + gap;

    if (left + pw > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - pw - 12);
    }
    if (left < 12) left = 12;

    if (top + ph > window.innerHeight - 12) {
        top = Math.max(12, rect.top - ph - gap);
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
}

function closeDatePopover() {
    if (datePopover) datePopover.hidden = true;
    activeDateInput = null;
}

function closeTimePopover() {
    if (timePopover) timePopover.hidden = true;
    activeTimeInput = null;
}

function closeAllPickers() {
    closeDatePopover();
    closeTimePopover();
}

function renderDateGrid() {
    if (!dateGrid || !dateMonthLabel) return;
    dateMonthLabel.textContent = `${MONTH_LABELS_VI[pickerViewMonth]} ${pickerViewYear}`;

    const selected = parseIsoDate(activeDateInput?.value || "");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const first = new Date(pickerViewYear, pickerViewMonth, 1);
    // Monday-first: Sun=0 → 6, Mon=1 → 0, ...
    let startPad = first.getDay() - 1;
    if (startPad < 0) startPad = 6;

    const daysInMonth = new Date(pickerViewYear, pickerViewMonth + 1, 0).getDate();
    const prevDays = new Date(pickerViewYear, pickerViewMonth, 0).getDate();

    dateGrid.textContent = "";

    const totalCells = 42;
    for (let i = 0; i < totalCells; i += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "b-picker__day";

        let y = pickerViewYear;
        let m = pickerViewMonth;
        let d;

        if (i < startPad) {
            d = prevDays - startPad + i + 1;
            m -= 1;
            if (m < 0) {
                m = 11;
                y -= 1;
            }
            btn.disabled = true;
        } else if (i >= startPad + daysInMonth) {
            d = i - startPad - daysInMonth + 1;
            m += 1;
            if (m > 11) {
                m = 0;
                y += 1;
            }
            btn.disabled = true;
        } else {
            d = i - startPad + 1;
            const cellDate = new Date(y, m, d);
            if (cellDate.getTime() === today.getTime()) btn.classList.add("is-today");
            if (
                selected
                && selected.getFullYear() === y
                && selected.getMonth() === m
                && selected.getDate() === d
            ) {
                btn.classList.add("is-selected");
            }
            btn.addEventListener("click", () => {
                if (!activeDateInput) return;
                activeDateInput.value = `${y}-${pad2(m + 1)}-${pad2(d)}`;
                activeDateInput.dispatchEvent(new Event("input", { bubbles: true }));
                activeDateInput.dispatchEvent(new Event("change", { bubbles: true }));
                closeDatePopover();
            });
        }

        btn.textContent = String(d);
        dateGrid.appendChild(btn);
    }
}

function openDatePopover(input) {
    if (!datePopover || !input) return;
    closeTimePopover();
    activeDateInput = input;

    const parsed = parseIsoDate(input.value);
    const base = parsed || new Date();
    pickerViewYear = base.getFullYear();
    pickerViewMonth = base.getMonth();

    datePopover.hidden = false;
    renderDateGrid();
    positionPopover(datePopover, input);
}

function scrollTimeListToSelected(list) {
    if (!list) return;
    const selected = list.querySelector("button.is-selected");
    if (selected) {
        selected.scrollIntoView({ block: "center", behavior: "instant" in window ? "instant" : "auto" });
    }
}

function renderTimeLists() {
    if (!timeHoursList || !timeMinutesList) return;

    timeHoursList.textContent = "";
    for (let h = 0; h < 24; h += 1) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = pad2(h);
        if (h === pendingTimeHour) btn.classList.add("is-selected");
        btn.addEventListener("click", () => {
            pendingTimeHour = h;
            renderTimeLists();
            scrollTimeListToSelected(timeHoursList);
            scrollTimeListToSelected(timeMinutesList);
        });
        li.appendChild(btn);
        timeHoursList.appendChild(li);
    }

    timeMinutesList.textContent = "";
    for (let m = 0; m < 60; m += 1) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = pad2(m);
        if (m === pendingTimeMinute) btn.classList.add("is-selected");
        btn.addEventListener("click", () => {
            pendingTimeMinute = m;
            renderTimeLists();
            scrollTimeListToSelected(timeHoursList);
            scrollTimeListToSelected(timeMinutesList);
        });
        li.appendChild(btn);
        timeMinutesList.appendChild(li);
    }

    requestAnimationFrame(() => {
        scrollTimeListToSelected(timeHoursList);
        scrollTimeListToSelected(timeMinutesList);
    });
}

function applyPendingTime() {
    if (!activeTimeInput) return;
    activeTimeInput.value = `${pad2(pendingTimeHour)}:${pad2(pendingTimeMinute)}`;
    activeTimeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeTimeInput.dispatchEvent(new Event("change", { bubbles: true }));
    closeTimePopover();
}

function openTimePopover(input) {
    if (!timePopover || !input) return;
    closeDatePopover();
    activeTimeInput = input;
    const t = parseTimeValue(input.value);
    pendingTimeHour = t.hour;
    pendingTimeMinute = t.minute;
    timePopover.hidden = false;
    renderTimeLists();
    positionPopover(timePopover, input);
}

function blockNativePicker(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== "date" && input.type !== "time") return;
    if (!form?.contains(input)) return;

    // Chặn native calendar / time spinner (màu xanh trình duyệt)
    event.preventDefault();
    event.stopPropagation();
    if (typeof input.showPicker === "function") {
        try {
            input.showPicker = () => {};
        } catch (_) {
            /* ignore */
        }
    }

    if (input.type === "date") openDatePopover(input);
    else openTimePopover(input);
}

function enhanceDateTimePickers(root = form) {
    if (!root) return;
    root.querySelectorAll('input[type="date"], input[type="time"]').forEach(input => {
        if (input.dataset.customPicker === "1") return;
        input.dataset.customPicker = "1";
        input.classList.add("is-custom-picker");
        input.setAttribute("autocomplete", "off");
        // capture: chặn trước khi browser mở native UI
        input.addEventListener("mousedown", blockNativePicker, true);
        input.addEventListener("click", blockNativePicker, true);
        input.addEventListener("focus", event => {
            // tránh focus mở native trên 1 số browser
            event.preventDefault();
            blockNativePicker(event);
        }, true);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
                event.preventDefault();
                blockNativePicker(event);
            }
            if (event.key === "Escape") closeAllPickers();
        });
    });
}

// Nav / actions
datePopover?.addEventListener("click", event => {
    event.stopPropagation();
    const nav = event.target.closest("[data-date-nav]");
    if (nav) {
        const delta = Number(nav.getAttribute("data-date-nav") || 0);
        pickerViewMonth += delta;
        if (pickerViewMonth > 11) {
            pickerViewMonth = 0;
            pickerViewYear += 1;
        } else if (pickerViewMonth < 0) {
            pickerViewMonth = 11;
            pickerViewYear -= 1;
        }
        renderDateGrid();
        return;
    }
    if (event.target.closest("[data-date-clear]")) {
        if (activeDateInput) {
            activeDateInput.value = "";
            activeDateInput.dispatchEvent(new Event("input", { bubbles: true }));
            activeDateInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        closeDatePopover();
        return;
    }
    if (event.target.closest("[data-date-today]")) {
        const now = new Date();
        if (activeDateInput) {
            activeDateInput.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
            activeDateInput.dispatchEvent(new Event("input", { bubbles: true }));
            activeDateInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        closeDatePopover();
    }
});

timePopover?.addEventListener("click", event => {
    event.stopPropagation();
    if (event.target.closest("[data-time-cancel]")) {
        closeTimePopover();
        return;
    }
    if (event.target.closest("[data-time-apply]")) {
        applyPendingTime();
    }
});

document.addEventListener("mousedown", event => {
    const t = event.target;
    if (datePopover && !datePopover.hidden) {
        if (!datePopover.contains(t) && t !== activeDateInput) closeDatePopover();
    }
    if (timePopover && !timePopover.hidden) {
        if (!timePopover.contains(t) && t !== activeTimeInput) closeTimePopover();
    }
});

window.addEventListener("resize", () => {
    if (datePopover && !datePopover.hidden && activeDateInput) {
        positionPopover(datePopover, activeDateInput);
    }
    if (timePopover && !timePopover.hidden && activeTimeInput) {
        positionPopover(timePopover, activeTimeInput);
    }
});

// Init + re-bind khi form đổi (load config không recreate inputs, đủ 1 lần)
enhanceDateTimePickers(form);

/* ============================================================
   Wizard steps — 1 màn / bước, nav pills + Quay lại / Tiếp theo
   ============================================================ */
const BUILDER_STEPS = [
    { id: 1, title: "Thông tin chính" },
    { id: 2, title: "Cô dâu & chú rể" },
    { id: 3, title: "Lịch và địa điểm tổ chức" },
    { id: 4, title: "Giao diện & phông chữ" },
    { id: 5, title: "Tiêu đề & mô tả từng phần" },
    { id: 6, title: "Ảnh thiệp" },
    { id: 7, title: "QR mừng cưới" },
    { id: 8, title: "Link thiệp" }
];

let currentBuilderStep = 1;
const maxVisitedStep = { value: 1 };

function getBuilderStepSection(stepId) {
    return document.getElementById(`builderStep${stepId}`);
}

function goToBuilderStep(stepId, options = {}) {
    const id = Math.min(BUILDER_STEPS.length, Math.max(1, Number(stepId) || 1));
    currentBuilderStep = id;
    if (id > maxVisitedStep.value) maxVisitedStep.value = id;

    BUILDER_STEPS.forEach(step => {
        const section = getBuilderStepSection(step.id);
        if (!section) return;
        const active = step.id === id;
        section.hidden = !active;
        section.classList.toggle("is-active", active);
    });

    document.querySelectorAll("[data-goto-step]").forEach(btn => {
        const sid = Number(btn.getAttribute("data-goto-step") || 0);
        const active = sid === id;
        const done = sid < id || sid < maxVisitedStep.value && sid !== id;
        btn.classList.toggle("is-active", active);
        btn.classList.toggle("is-done", done && !active);
        btn.setAttribute("aria-current", active ? "step" : "false");
    });

    const meta = BUILDER_STEPS.find(s => s.id === id);
    const mobileCount = document.getElementById("builderMobileStepCount");
    const mobileTitle = document.getElementById("builderMobileStepTitle");
    if (mobileCount) mobileCount.textContent = `${id}/${BUILDER_STEPS.length}`;
    if (mobileTitle) mobileTitle.textContent = meta?.title || "";
    const footerMeta = document.getElementById("stepFooterMeta");
    if (footerMeta) footerMeta.textContent = `${id} / ${BUILDER_STEPS.length}`;

    const prevBtn = document.getElementById("stepPrevBtn");
    const nextBtn = document.getElementById("stepNextBtn");
    if (prevBtn) prevBtn.disabled = id <= 1;
    if (nextBtn) {
        const last = id >= BUILDER_STEPS.length;
        // Bước cuối: ẩn Tiếp theo — chỉ còn Lưu thiệp trên thanh dưới
        nextBtn.hidden = last;
        nextBtn.disabled = last;
        nextBtn.innerHTML = `<span>Tiếp theo</span><i class="bi bi-arrow-right"></i>`;
        nextBtn.dataset.stepAction = "next";
    }
    document.getElementById("builderActions")?.classList.toggle("is-last-step", id >= BUILDER_STEPS.length);

    // Scroll form to top of step content
    if (options.scroll !== false) {
        const panel = document.querySelector("[data-builder-panel='edit']");
        if (panel) {
            panel.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
        }
        // Keep active menu item in view (sidebar dọc / chip ngang mobile)
        document.querySelector(`[data-goto-step="${id}"]`)?.scrollIntoView({
            behavior: options.instant ? "auto" : "smooth",
            inline: "center",
            block: "nearest"
        });
    }
}

function setBuilderSidebarOpen(open) {
    const on = !!open && isMobileBuilderLayout();
    document.body.classList.toggle("builder-sidebar-open", on);
    const toggle = document.getElementById("builderSidebarToggle");
    const backdrop = document.getElementById("builderSidebarBackdrop");
    if (toggle) {
        toggle.setAttribute("aria-expanded", on ? "true" : "false");
        toggle.setAttribute("aria-label", on ? "Đóng danh sách bước" : "Mở danh sách bước");
        const icon = toggle.querySelector("i");
        if (icon) icon.className = on ? "bi bi-x-lg" : "bi bi-list";
    }
    if (backdrop) backdrop.hidden = !on;
}

function initBuilderWizard() {
    document.getElementById("builderStepNav")?.addEventListener("click", event => {
        const btn = event.target.closest("[data-goto-step]");
        if (!btn) return;
        goToBuilderStep(btn.getAttribute("data-goto-step"));
        setBuilderSidebarOpen(false);
    });

    document.getElementById("stepPrevBtn")?.addEventListener("click", () => {
        goToBuilderStep(currentBuilderStep - 1);
    });

    document.getElementById("stepNextBtn")?.addEventListener("click", () => {
        if (currentBuilderStep >= BUILDER_STEPS.length) return;
        goToBuilderStep(currentBuilderStep + 1);
    });

    document.getElementById("builderSidebarToggle")?.addEventListener("click", () => {
        const open = !document.body.classList.contains("builder-sidebar-open");
        setBuilderSidebarOpen(open);
    });
    document.getElementById("builderSidebarClose")?.addEventListener("click", () => {
        setBuilderSidebarOpen(false);
    });
    document.getElementById("builderSidebarBackdrop")?.addEventListener("click", () => {
        setBuilderSidebarOpen(false);
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && document.body.classList.contains("builder-sidebar-open")) {
            setBuilderSidebarOpen(false);
        }
    });
    window.addEventListener("resize", () => {
        if (!isMobileBuilderLayout()) setBuilderSidebarOpen(false);
    });

    goToBuilderStep(1, { scroll: false, instant: true });
}

/** Custom select: list brand (native <option> list do OS vẽ, CSS không đụng được). */
let openCustomSelectWrap = null;

function closeOpenCustomSelect() {
    if (!openCustomSelectWrap) return;
    const panel = openCustomSelectWrap.querySelector(".b-select__panel");
    if (panel) panel.hidden = true;
    openCustomSelectWrap.classList.remove("is-open");
    openCustomSelectWrap.querySelector(".b-select__trigger")?.setAttribute("aria-expanded", "false");
    openCustomSelectWrap = null;
}

function getCustomSelectLabelText(select) {
    const selected = select.selectedOptions?.[0];
    if (selected) return selected.textContent?.trim() || selected.value || "—";
    if (select.options?.length) return select.options[0].textContent?.trim() || "—";
    return "—";
}

function rebuildCustomSelectPanel(select, wrap) {
    const panel = wrap.querySelector(".b-select__panel");
    const labelEl = wrap.querySelector(".b-select__label");
    const trigger = wrap.querySelector(".b-select__trigger");
    if (!panel || !labelEl || !trigger) return;

    labelEl.textContent = getCustomSelectLabelText(select);
    wrap.classList.toggle("is-disabled", !!select.disabled);
    trigger.disabled = !!select.disabled;
    panel.innerHTML = "";

    const nodes = Array.from(select.childNodes);
    let hasOptions = false;

    const appendOption = (option) => {
        if (option.disabled && !option.value && !option.textContent) return;
        hasOptions = true;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "b-select__option";
        btn.setAttribute("role", "option");
        btn.dataset.value = option.value;
        btn.textContent = option.textContent?.trim() || option.value || "—";
        if (option.disabled) btn.disabled = true;
        if (option.selected || option.value === select.value) {
            btn.classList.add("is-selected");
            btn.setAttribute("aria-selected", "true");
        } else {
            btn.setAttribute("aria-selected", "false");
        }
        btn.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            if (select.disabled || option.disabled) return;
            const next = option.value;
            if (select.value !== next) {
                select.value = next;
                select.dispatchEvent(new Event("input", { bubbles: true }));
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
            labelEl.textContent = getCustomSelectLabelText(select);
            panel.querySelectorAll(".b-select__option").forEach(el => {
                const on = el.dataset.value === select.value;
                el.classList.toggle("is-selected", on);
                el.setAttribute("aria-selected", on ? "true" : "false");
            });
            closeOpenCustomSelect();
        });
        panel.appendChild(btn);
    };

    nodes.forEach(node => {
        if (node.nodeName === "OPTGROUP") {
            const group = document.createElement("div");
            group.className = "b-select__group";
            group.textContent = node.label || "";
            panel.appendChild(group);
            Array.from(node.children).forEach(child => {
                if (child.nodeName === "OPTION") appendOption(child);
            });
            return;
        }
        if (node.nodeName === "OPTION") appendOption(node);
    });

    if (!hasOptions) {
        const empty = document.createElement("div");
        empty.className = "b-select__empty";
        empty.textContent = "Không có lựa chọn";
        panel.appendChild(empty);
    }
}

function positionCustomSelectPanel(wrap) {
    const panel = wrap?.querySelector(".b-select__panel");
    const trigger = wrap?.querySelector(".b-select__trigger");
    if (!panel || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxH = Math.min(280, window.innerHeight * 0.5);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const height = Math.min(maxH, openUp ? spaceAbove : spaceBelow);
    panel.style.position = "fixed";
    panel.style.left = `${Math.max(8, rect.left)}px`;
    panel.style.width = `${Math.max(rect.width, 160)}px`;
    panel.style.right = "auto";
    panel.style.maxHeight = `${Math.max(120, height)}px`;
    if (openUp) {
        panel.style.top = "auto";
        panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
        panel.style.top = `${rect.bottom + 6}px`;
        panel.style.bottom = "auto";
    }
}

function openCustomSelect(wrap) {
    if (!wrap || wrap.classList.contains("is-disabled")) return;
    if (openCustomSelectWrap && openCustomSelectWrap !== wrap) {
        closeOpenCustomSelect();
    }
    const panel = wrap.querySelector(".b-select__panel");
    const trigger = wrap.querySelector(".b-select__trigger");
    if (!panel) return;
    panel.hidden = false;
    wrap.classList.add("is-open");
    trigger?.setAttribute("aria-expanded", "true");
    openCustomSelectWrap = wrap;
    positionCustomSelectPanel(wrap);
    const selected = panel.querySelector(".b-select__option.is-selected");
    selected?.scrollIntoView({ block: "nearest" });
}

function enhanceCustomSelect(select) {
    if (!select || select.tagName !== "SELECT") return;
    if (select.dataset.bSelect === "1") {
        refreshCustomSelect(select);
        return;
    }

    const wrap = document.createElement("div");
    wrap.className = "b-select";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("b-select__native");
    select.dataset.bSelect = "1";
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "b-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const labelEl = document.createElement("span");
    labelEl.className = "b-select__label";
    const chevron = document.createElement("i");
    chevron.className = "bi bi-chevron-down b-select__chevron";
    chevron.setAttribute("aria-hidden", "true");
    trigger.appendChild(labelEl);
    trigger.appendChild(chevron);

    const panel = document.createElement("div");
    panel.className = "b-select__panel";
    panel.setAttribute("role", "listbox");
    panel.hidden = true;

    wrap.appendChild(trigger);
    wrap.appendChild(panel);

    trigger.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (select.disabled) return;
        if (openCustomSelectWrap === wrap) {
            closeOpenCustomSelect();
        } else {
            rebuildCustomSelectPanel(select, wrap);
            openCustomSelect(wrap);
        }
    });

    select.addEventListener("change", () => {
        labelEl.textContent = getCustomSelectLabelText(select);
        panel.querySelectorAll(".b-select__option").forEach(el => {
            const on = el.dataset.value === select.value;
            el.classList.toggle("is-selected", on);
            el.setAttribute("aria-selected", on ? "true" : "false");
        });
    });

    const observer = new MutationObserver(() => {
        rebuildCustomSelectPanel(select, wrap);
    });
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

    rebuildCustomSelectPanel(select, wrap);
}

function refreshCustomSelect(select) {
    if (!select || select.dataset.bSelect !== "1") {
        enhanceCustomSelect(select);
        return;
    }
    const wrap = select.closest(".b-select");
    if (wrap) rebuildCustomSelectPanel(select, wrap);
}

function enhanceAllCustomSelects(root = form) {
    if (!root) return;
    root.querySelectorAll("select").forEach(enhanceCustomSelect);
}

function initCustomSelects() {
    enhanceAllCustomSelects(form);

    document.addEventListener("click", event => {
        if (!openCustomSelectWrap) return;
        if (openCustomSelectWrap.contains(event.target)) return;
        closeOpenCustomSelect();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && openCustomSelectWrap) {
            closeOpenCustomSelect();
        }
    });

    // Khi scroll form / resize → đóng panel (tránh lệch vị trí absolute)
    document.querySelector(".builder-panel")?.addEventListener("scroll", () => {
        if (openCustomSelectWrap) closeOpenCustomSelect();
    }, { passive: true });
    window.addEventListener("resize", () => {
        if (openCustomSelectWrap) closeOpenCustomSelect();
    });
}

initBuilderWizard();
initCustomSelects();
