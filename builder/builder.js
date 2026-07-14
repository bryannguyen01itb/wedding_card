import { wedding as fallbackWedding } from "../js/config.js";
import { db } from "../js/firebase.js";

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
const paymentWeddingIdText = document.getElementById("paymentWeddingIdText");
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

const WEDDING_QUERY_KEY = "wedding";
const PREVIEW_STATE_KEY = "weddingBuilderPreviewState";
const GALLERY_SIZE = 7;
const DEFAULT_PAYMENT_SETTINGS = {
    amount: 0,
    currency: "VND",
    contactUrl: "",
    qrImage: "",
    receiver: "",
    message: "Vui lòng chuyển khoản với nội dung là Wedding ID, sau đó liên hệ admin để được mở khóa link thiệp."
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
const qrCropStates = new Map();

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

function normalizeLocationProvince(value) {
    const province = String(value || "")
        .replace(/,?\s*vi[eệ]t\s*nam\s*$/i, "")
        .trim()
        .toLocaleUpperCase("vi-VN");

    return province ? `${province}, VIỆT NAM` : fallbackWedding.location;
}

function getProvinceFromLocation(value) {
    return String(value || "")
        .replace(/,?\s*VIỆT\s*NAM\s*$/i, "")
        .trim();
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

function getMusicLibrary(config = {}) {
    const library = Array.isArray(config.musicLibrary) ? config.musicLibrary : [];
    const fallbackLibrary = Array.isArray(fallbackWedding.musicLibrary) ? fallbackWedding.musicLibrary : [];
    const combined = [...fallbackLibrary, ...remoteMusicLibrary, ...library];
    const seen = new Set();

    return combined.filter(item => {
        const url = String(item?.url || "").trim();
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
    });
}

function populateMusicOptions(config = loadedWeddingConfig) {
    if (!musicSelect) return;

    const currentMusic = config.music || fallbackWedding.music || "";
    const library = getMusicLibrary(config);
    const hasCurrentMusic = library.some(item => item.url === currentMusic);

    musicSelect.innerHTML = "";

    library.forEach(item => {
        const option = document.createElement("option");
        option.value = item.url;
        option.textContent = item.title || item.name || item.url;
        musicSelect.appendChild(option);
    });

    if (currentMusic && !hasCurrentMusic) {
        const option = document.createElement("option");
        option.value = currentMusic;
        option.textContent = "Nhạc hiện tại";
        musicSelect.prepend(option);
    }

    musicSelect.value = currentMusic;
}

async function loadMusicLibrary() {
    try {
        const snapshot = await db.collection("musicLibrary").orderBy("title").get();
        remoteMusicLibrary = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.active !== false && item.url);
    } catch (error) {
        console.warn("Khong tai duoc musicLibrary tu Firebase, dung danh sach mac dinh.", error);
        remoteMusicLibrary = [];
    }

    populateMusicOptions(loadedWeddingConfig);
}

function setStatus(message, type = "") {
    statusEl.textContent = message;
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
}

function buildInvitationUrl(weddingId) {
    const url = new URL("../", window.location.href);
    url.searchParams.set(WEDDING_QUERY_KEY, weddingId);
    return url.toString();
}

function buildEditUrl(weddingId) {
    const url = new URL(window.location.href);
    url.searchParams.set(WEDDING_QUERY_KEY, weddingId);
    return url.toString();
}

function applyLink(anchor, url) {
    if (!anchor) {
        return;
    }

    anchor.href = url;
    anchor.textContent = url;
}

function getShareUrls(weddingId) {
    return {
        invitationUrl: buildInvitationUrl(weddingId),
        editUrl: buildEditUrl(weddingId)
    };
}

function updateResultLinks(weddingId) {
    if (!weddingId || !resultLinks || !invitationLink || !editLink) {
        return;
    }

    const { invitationUrl, editUrl } = getShareUrls(weddingId);

    applyLink(invitationLink, invitationUrl);
    applyLink(editLink, editUrl);
    applyLink(modalInvitationLink, invitationUrl);
    applyLink(modalEditLink, editUrl);
    resultLinks.hidden = false;
}

function hasPaymentAmount(settings = paymentSettings) {
    return settings.amount !== undefined && settings.amount !== null && settings.amount !== "";
}

function formatPaymentAmount(settings = paymentSettings) {
    if (!hasPaymentAmount(settings)) return "Chưa cấu hình số tiền";

    const amount = Number(settings.amount);
    if (Number.isNaN(amount)) return "Chưa cấu hình số tiền";
    return new Intl.NumberFormat("vi-VN").format(amount) + ` ${settings.currency || "VND"}`;
}

function isPaymentUnlocked(config = loadedWeddingConfig) {
    return config.payment?.unlocked === true || config.payment?.status === "paid";
}

function hidePaymentModal() {
    if (!paymentModal) return;
    paymentModal.hidden = true;
    document.body.classList.remove("modal-open");
}

function showPaymentModal(weddingId) {
    if (!paymentModal || !weddingId) return;
    if (saveModal) saveModal.hidden = true;
    if (resultLinks) resultLinks.hidden = true;

    const { editUrl } = getShareUrls(weddingId);
    paymentWeddingIdText.textContent = weddingId;
    paymentAmountText.textContent = formatPaymentAmount();
    paymentMessageText.textContent = paymentSettings.message || DEFAULT_PAYMENT_SETTINGS.message;
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
}

function showUnlockedLinks(weddingId) {
    hidePaymentModal();
    showSaveModal(weddingId);
}

function buildPendingPayment(weddingId) {
    const current = loadedWeddingConfig.payment || {};
    if (current.unlocked === true || current.status === "paid") {
        return current;
    }

    return {
        status: "pending",
        unlocked: false,
        amount: hasPaymentAmount(paymentSettings) ? Number(paymentSettings.amount) : 0,
        currency: paymentSettings.currency || "VND",
        weddingId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function listenWeddingPayment(weddingId) {
    if (unsubscribeWeddingPayment) {
        unsubscribeWeddingPayment();
        unsubscribeWeddingPayment = null;
    }
    if (!weddingId) return;

    unsubscribeWeddingPayment = db.collection("weddings").doc(weddingId).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data() || {};
        loadedWeddingConfig = mergeConfig(loadedWeddingConfig, data);
        if (data.payment?.unlocked === true || data.payment?.status === "paid") {
            setStatus(`Da mo khoa thiep: ${weddingId}`, "success");
            showUnlockedLinks(weddingId);
        }
    });
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
}

function showSaveModal(weddingId) {
    updateResultLinks(weddingId);
    if (!saveModal) {
        return;
    }

    hidePaymentModal();
    saveModal.hidden = false;
    document.body.classList.add("modal-open");
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

function syncUrlForEdit(weddingId) {
    if (!weddingId) {
        return;
    }

    const editUrl = buildEditUrl(weddingId);
    window.history.replaceState({}, "", editUrl);
}


function buildCloudinaryFolder() {
    const data = new FormData(form);
    const weddingId = editingWeddingId || buildWeddingId(data) || "draft";
    return `${CLOUDINARY_FOLDER_PREFIX}/${weddingId}`;
}

function getField(name) {
    return form.elements[name];
}

function readField(name) {
    return String(getField(name)?.value || "").trim();
}

function setField(name, value) {
    const field = getField(name);
    if (field && value !== undefined && value !== null) {
        field.value = value;
    }
}

function renderBuilderGalleryFields() {
    if (!builderGalleryFields) return;
    builderGalleryFields.textContent = "";

    Array.from({ length: GALLERY_SIZE }, (_, index) => {
        const number = index + 1;
        const row = document.createElement("div");
        row.className = "builder-gallery-row";
        row.innerHTML = `
            <div class="gallery-index">Ảnh ${number}<input type="hidden" name="galleryPhoto${number}"></div>
            <div class="upload-row"><input type="file" accept="image/*" data-upload-target="galleryPhoto${number}"><button type="button" data-upload-button="galleryPhoto${number}"><i class="bi bi-cloud-arrow-up-fill"></i> Upload</button></div>
        `;
        builderGalleryFields.appendChild(row);
    });
}

function getConceptMedia(config, blockName, imageKey) {
    const blockValue = config.theme?.blocks?.[blockName] || fallbackWedding.theme?.blocks?.[blockName] || "concept-1";
    return config.theme?.concepts?.[blockValue]?.images?.[imageKey] || "";
}

function getSelectedBlockValue(name) {
    return readField(name) || "concept-1";
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

async function uploadBlobToCloudinary(blob, filename) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error("Chua cau hinh CLOUDINARY_CLOUD_NAME hoac CLOUDINARY_UPLOAD_PRESET trong builder.js");
    }

    const data = new FormData();
    data.append("file", blob, filename);
    data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    data.append("folder", buildCloudinaryFolder());

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: data
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Upload Cloudinary that bai");
    }

    const result = await response.json();
    return result.secure_url;
}

async function uploadImageForField(fieldName, file, options = {}) {
    const button = document.querySelector(`[data-upload-button="${fieldName}"]`);
    const oldLabel = button?.innerHTML;

    try {
        if (!file) {
            setStatus("Chon file anh truoc khi upload.", "error");
            return;
        }
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading';
        }
        setStatus("Dang nen anh va upload Cloudinary...");
        const blob = await compressImageFile(file, options);
        const url = await uploadBlobToCloudinary(blob, `${fieldName}.jpg`);
        setField(fieldName, url);
        setStatus("Da upload anh va dien URL vao form.", "success");
        refreshPreview(false);
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Upload Cloudinary that bai.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = oldLabel;
        }
    }
}

function getQrBox(fieldName) {
    return document.querySelector(`[data-qr-box="${fieldName}"]`);
}

function renderQrCrop(fieldName) {
    const state = qrCropStates.get(fieldName);
    const box = getQrBox(fieldName);
    const crop = box?.querySelector(".qr-crop");
    const canvas = crop?.querySelector("canvas");
    if (!state || !canvas) return;

    crop.hidden = false;
    const context = canvas.getContext("2d");
    const size = canvas.width;
    const zoom = Number(crop.querySelector("[data-qr-zoom]")?.value || 1);
    const shiftX = Number(crop.querySelector("[data-qr-x]")?.value || 0) / 100;
    const shiftY = Number(crop.querySelector("[data-qr-y]")?.value || 0) / 100;
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

async function loadQrFile(fieldName, file) {
    if (!file) return;
    const image = await loadImageFromFile(file);
    qrCropStates.set(fieldName, { image, file });
    renderQrCrop(fieldName);
}

async function uploadQrForField(fieldName) {
    const state = qrCropStates.get(fieldName);
    const button = document.querySelector(`[data-upload-button="${fieldName}"]`);
    const oldLabel = button?.innerHTML;

    if (!state) {
        const input = document.querySelector(`[data-qr-input="${fieldName}"]`);
        if (input?.files?.[0]) await loadQrFile(fieldName, input.files[0]);
    }

    const box = getQrBox(fieldName);
    const canvas = box?.querySelector("canvas");
    if (!canvas || !qrCropStates.has(fieldName)) {
        setStatus("Chon file QR truoc khi upload.", "error");
        return;
    }

    try {
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading';
        }
        setStatus("Dang cat QR va upload Cloudinary...");
        renderQrCrop(fieldName);
        const blob = await canvasToBlob(canvas, "image/png", 0.95);
        const url = await uploadBlobToCloudinary(blob, `${fieldName}.png`);
        setField(fieldName, url);
        setStatus("Da upload QR va dien URL vao form.", "success");
        refreshPreview(false);
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Upload QR that bai.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = oldLabel;
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


function ensureMapPicker(role) {
    if (!window.L || !mapPickerCanvas) {
        setStatus("Khong tai duoc ban do. Hay dan truc tiep link chia se Google Maps vao o Link Maps.", "error");
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
        mapPicker.on("click", event => {
            selectedMapPoint = { lat: event.latlng.lat, lng: event.latlng.lng };
            if (!mapPickerMarker) {
                mapPickerMarker = window.L.marker(event.latlng).addTo(mapPicker);
            } else {
                mapPickerMarker.setLatLng(event.latlng);
            }
        });
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
    if (!ensureMapPicker(role)) {
        closeMapPicker();
    }
}

function closeMapPicker() {
    if (!mapPickerModal) return;
    mapPickerModal.hidden = true;
    activeMapPickerRole = "";
    document.body.classList.remove("modal-open");
}

function saveSelectedMapPoint() {
    if (!activeMapPickerRole || !selectedMapPoint) {
        setStatus("Hay click vao vi tri tren ban do truoc khi luu.", "error");
        return;
    }

    const fieldName = activeMapPickerRole === "bride" ? "brideMapUrl" : "groomMapUrl";
    setField(fieldName, buildCoordinateMapUrl(selectedMapPoint));
    closeMapPicker();
    setStatus("Da luu link Google Maps theo toa do da chon.", "success");
    refreshPreview(false);
}

function readBuilderTheme() {
    const data = new FormData(form);
    const weddingId = editingWeddingId || buildWeddingId(data);

    weddingIdInput.value = weddingId;

    return {
        weddingId,
        date: data.get("date") || fallbackWedding.date,
        theme: {
            primaryColor: data.get("primaryColor") || "#c9974f",
            blocks: {
                cover: data.get("blockCover"),
                poster: data.get("blockPoster"),
                saveDate: data.get("blockSaveDate"),
                about: data.get("blockAbout"),
                timeline: data.get("blockTimeline"),
                gallery: data.get("blockGallery"),
                countdown: data.get("blockCountdown"),
                divider: data.get("blockDivider")
            },
            fonts: {
                body: data.get("fontBody"),
                nickname: data.get("fontNickname")
            }
        }
    };
}

function createCustomerConfig() {
    const data = new FormData(form);
    const builderTheme = readBuilderTheme();
    const groomNickname = readText(data, "groomNickname");
    const brideNickname = readText(data, "brideNickname");

    return {
        weddingId: builderTheme.weddingId,
        date: builderTheme.date,
        location: normalizeLocationProvince(data.get("locationProvince")),
        music: readText(data, "music") || loadedWeddingConfig.music || fallbackWedding.music,
        theme: {
            ...builderTheme.theme,
            concepts: (() => {
                const concepts = {};
                setConceptImage(concepts, getSelectedBlockValue("blockCover"), "cover", readText(data, "coverPosterImage"));
                setConceptImage(concepts, getSelectedBlockValue("blockCountdown"), "countdown", readText(data, "countdownImage"));
                return concepts;
            })()
        },
        poster: {
            image: readText(data, "coverPosterImage")
        },
        preview: {
            image: readText(data, "previewImage")
        },
        aboutCard: {
            image: readText(data, "aboutImage")
        },
        groom: {
            nickname: groomNickname,
            fullName: readText(data, "groomFullName"),
            father: readText(data, "groomFather"),
            mother: readText(data, "groomMother"),
            avatar: readText(data, "groomAvatar")
        },
        bride: {
            nickname: brideNickname,
            fullName: readText(data, "brideFullName"),
            father: readText(data, "brideFather"),
            mother: readText(data, "brideMother"),
            avatar: readText(data, "brideAvatar")
        },
        sectionSubtitles: {
            about: readText(data, "subtitleAbout"),
            timeline: readText(data, "subtitleTimeline"),
            gallery: readText(data, "subtitleGallery"),
            wish: readText(data, "subtitleWish"),
            gift: readText(data, "subtitleGift"),
            countdown: readText(data, "subtitleCountdown"),
            thanks: readText(data, "subtitleThanks")
        },
        ceremony: {
            image: readText(data, "timelineImage"),
            bride: {
                time: readText(data, "brideCeremonyTime"),
                address: readText(data, "brideAddress"),
                mapUrl: readText(data, "brideMapUrl"),
                meal: {
                    time: formatMealTime(data.get("brideMealDate"), data.get("brideMealTime"))
                }
            },
            groom: {
                time: readText(data, "groomCeremonyTime"),
                address: readText(data, "groomAddress"),
                mapUrl: readText(data, "groomMapUrl"),
                meal: {
                    time: formatMealTime(data.get("groomMealDate"), data.get("groomMealTime"))
                }
            }
        },
        gallery: {
            photos: getGalleryPhotosFromForm()
        },
        gift: {
            groom: {
                qr: readText(data, "giftGroomQr"),
                bank: readText(data, "giftGroomBank"),
                accountName: readText(data, "giftGroomAccountName"),
                accountNumber: readText(data, "giftGroomAccountNumber")
            },
            bride: {
                qr: readText(data, "giftBrideQr"),
                bank: readText(data, "giftBrideBank"),
                accountName: readText(data, "giftBrideAccountName"),
                accountNumber: readText(data, "giftBrideAccountNumber")
            }
        },
        builder: {
            groomNickname,
            brideNickname
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
            photos: customerConfig.gallery?.photos?.length ? customerConfig.gallery.photos : config.gallery?.photos
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
        musicLibrary: getMusicLibrary(config),
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
        const doc = await db.collection("weddings").doc(candidate).get();
        if (!doc.exists) return candidate;
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
    setControlValue("groomFullName", config.groom?.fullName);
    setControlValue("groomFather", config.groom?.father);
    setControlValue("groomMother", config.groom?.mother);
    setControlValue("brideFullName", config.bride?.fullName);
    setControlValue("brideFather", config.bride?.father);
    setControlValue("brideMother", config.bride?.mother);
    setControlValue("groomAddress", config.ceremony?.groom?.address);
    setControlValue("brideAddress", config.ceremony?.bride?.address);
    setControlValue("groomMapUrl", config.ceremony?.groom?.mapUrl);
    setControlValue("brideMapUrl", config.ceremony?.bride?.mapUrl);
    setControlValue("date", config.date);
    setControlValue("locationProvince", getProvinceFromLocation(config.location));
    setControlValue("primaryColor", theme.primaryColor);
    populateMusicOptions(config);
    setControlValue("music", config.music);
    setControlValue("coverPosterImage", config.poster?.image || getConceptMedia(config, "cover", "cover"));
    setControlValue("previewImage", config.preview?.image);
    setControlValue("aboutImage", config.aboutCard?.image);
    setControlValue("timelineImage", config.ceremony?.image);
    setControlValue("countdownImage", getConceptMedia(config, "countdown", "countdown"));
    setControlValue("groomAvatar", config.groom?.avatar);
    setControlValue("brideAvatar", config.bride?.avatar);
    setControlValue("giftGroomQr", config.gift?.groom?.qr);
    setControlValue("giftGroomBank", config.gift?.groom?.bank);
    setControlValue("giftGroomAccountName", config.gift?.groom?.accountName);
    setControlValue("giftGroomAccountNumber", config.gift?.groom?.accountNumber);
    setControlValue("giftBrideQr", config.gift?.bride?.qr);
    setControlValue("giftBrideBank", config.gift?.bride?.bank);
    setControlValue("giftBrideAccountName", config.gift?.bride?.accountName);
    setControlValue("giftBrideAccountNumber", config.gift?.bride?.accountNumber);
    Array.from({ length: GALLERY_SIZE }, (_, index) => {
        setControlValue(`galleryPhoto${index + 1}`, "");
    });
    const galleryPhotos = config.gallery?.photos?.length ? config.gallery.photos : fallbackWedding.gallery?.photos || [];
    galleryPhotos.slice(0, GALLERY_SIZE).forEach((photo, index) => {
        setControlValue(`galleryPhoto${index + 1}`, photo.src);
    });
    setControlValue("blockCover", blocks.cover);
    setControlValue("blockPoster", blocks.poster);
    setControlValue("blockSaveDate", blocks.saveDate);
    setControlValue("blockAbout", blocks.about);
    setControlValue("blockTimeline", blocks.timeline);
    setControlValue("blockGallery", blocks.gallery);
    setControlValue("blockCountdown", blocks.countdown);
    setControlValue("blockDivider", blocks.divider);
    setControlValue("fontBody", fonts.body);
    setControlValue("fontNickname", fonts.nickname);

    const subtitles = config.sectionSubtitles || {};
    setControlValue("subtitleAbout", subtitles.about);
    setControlValue("subtitleTimeline", subtitles.timeline);
    setControlValue("subtitleGallery", subtitles.gallery);
    setControlValue("subtitleWish", subtitles.wish);
    setControlValue("subtitleGift", subtitles.gift);
    setControlValue("subtitleCountdown", subtitles.countdown);
    setControlValue("subtitleThanks", Array.isArray(subtitles.thanks) ? subtitles.thanks.join("\n") : subtitles.thanks);

    const brideMeal = splitMealTime(config.ceremony?.bride?.meal?.time);
    const groomMeal = splitMealTime(config.ceremony?.groom?.meal?.time);
    setControlValue("brideCeremonyTime", config.ceremony?.bride?.time);
    setControlValue("groomCeremonyTime", config.ceremony?.groom?.time);
    setControlValue("brideMealDate", brideMeal.date);
    setControlValue("brideMealTime", brideMeal.time);
    setControlValue("groomMealDate", groomMeal.date);
    setControlValue("groomMealTime", groomMeal.time);
}

async function loadConfigForEdit() {
    const weddingId = getWeddingIdFromUrl();

    if (!weddingId) {
        originalEditingWeddingId = "";
        markWeddingEditable();
        refreshPreview();
        return;
    }

    editingWeddingId = weddingId;
    originalEditingWeddingId = weddingId;
    weddingIdInput.value = weddingId;
    setStatus(`Dang tai cau hinh: ${weddingId}`);

    try {
        const doc = await db.collection("weddings").doc(weddingId).get();
        if (doc.exists) {
            loadedWeddingConfig = {
                ...clone(fallbackWedding),
                ...doc.data(),
                weddingId: doc.id,
                theme: {
                    ...(fallbackWedding.theme || {}),
                    ...(doc.data().theme || {})
                },
                groom: {
                    ...(fallbackWedding.groom || {}),
                    ...(doc.data().groom || {})
                },
                bride: {
                    ...(fallbackWedding.bride || {}),
                    ...(doc.data().bride || {})
                },
                poster: {
                    ...(fallbackWedding.poster || {}),
                    ...(doc.data().poster || {})
                },
                preview: {
                    ...(fallbackWedding.preview || {}),
                    ...(doc.data().preview || {})
                },
                aboutCard: {
                    ...(fallbackWedding.aboutCard || {}),
                    ...(doc.data().aboutCard || {})
                },
                gallery: {
                    ...(fallbackWedding.gallery || {}),
                    ...(doc.data().gallery || {}),
                    photos: doc.data().gallery?.photos?.length
                        ? doc.data().gallery.photos
                        : fallbackWedding.gallery?.photos
                },
                gift: {
                    ...(fallbackWedding.gift || {}),
                    ...(doc.data().gift || {}),
                    groom: {
                        ...(fallbackWedding.gift?.groom || {}),
                        ...(doc.data().gift?.groom || {})
                    },
                    bride: {
                        ...(fallbackWedding.gift?.bride || {}),
                        ...(doc.data().gift?.bride || {})
                    }
                },
                sectionSubtitles: {
                    ...(fallbackWedding.sectionSubtitles || {}),
                    ...(doc.data().sectionSubtitles || {})
                },
                ceremony: {
                    ...(fallbackWedding.ceremony || {}),
                    ...(doc.data().ceremony || {}),
                    bride: {
                        ...(fallbackWedding.ceremony?.bride || {}),
                        ...(doc.data().ceremony?.bride || {}),
                        meal: {
                            ...(fallbackWedding.ceremony?.bride?.meal || {}),
                            ...(doc.data().ceremony?.bride?.meal || {})
                        }
                    },
                    groom: {
                        ...(fallbackWedding.ceremony?.groom || {}),
                        ...(doc.data().ceremony?.groom || {}),
                        meal: {
                            ...(fallbackWedding.ceremony?.groom?.meal || {}),
                            ...(doc.data().ceremony?.groom?.meal || {})
                        }
                    }
                }
            };
            fillBuilderForm(loadedWeddingConfig);
            markWeddingEditable();
            listenWeddingPayment(weddingId);
            if (isPaymentUnlocked(loadedWeddingConfig)) {
                updateResultLinks(weddingId);
            } else {
                showPaymentModal(weddingId);
            }
            setStatus(`Dang sua: ${weddingId}`);
            refreshPreview(false);
        } else {
            loadedWeddingConfig = { ...clone(fallbackWedding), weddingId };
            markWeddingMissing(weddingId);
        }
    } catch (error) {
        console.error(error);
        markWeddingMissing(weddingId);
        setStatus("Khong tai duoc cau hinh. Kiem tra Firestore Rules hoac kiem tra lai weddingId.", "error");
    }
}

function readPreviewState() {
    try {
        return JSON.parse(localStorage.getItem(PREVIEW_STATE_KEY) || "null") || { opened: false, scrollY: 0, target: "" };
    } catch (error) {
        return { opened: false, scrollY: 0, target: "" };
    }
}

function savePreviewState(state) {
    localStorage.setItem(PREVIEW_STATE_KEY, JSON.stringify({
        opened: Boolean(state?.opened),
        scrollY: Math.max(0, Math.round(Number(state?.scrollY || 0))),
        target: String(state?.target || "")
    }));
}

function getPreviewTargetFromField(fieldName) {
    const targetMap = {
        blockPoster: ".poster",
        blockSaveDate: ".save-date",
        blockAbout: ".about",
        blockTimeline: ".timeline",
        blockGallery: ".gallery",
        blockCountdown: ".countdown",
        blockDivider: ".section-divider"
    };

    return targetMap[fieldName] || "";
}

function getCurrentPreviewState() {
    const activeField = document.activeElement?.name || "";
    const target = getPreviewTargetFromField(activeField);

    if (activeField === "blockCover") {
        return { opened: false, scrollY: 0, target: "" };
    }

    if (target) {
        return { opened: true, scrollY: 0, target };
    }

    return { opened: false, scrollY: 0, target: "" };
}

function syncPreviewStateFromFrame() {
    let previewWindow = null;
    let previewDocument = null;

    try {
        previewWindow = frame.contentWindow;
        previewDocument = frame.contentDocument;
    } catch (error) {
        return;
    }

    if (!previewWindow || !previewDocument) return;

    const markOpened = () => savePreviewState({ opened: true, scrollY: previewWindow.scrollY || 0 });
    const syncScroll = () => {
        const previousState = readPreviewState();
        savePreviewState({
            opened: previousState.opened || previewWindow.scrollY > 20,
            scrollY: previousWindowSafeScroll(previewWindow, previousState.scrollY)
        });
    };

    previewDocument.getElementById("openCard")?.addEventListener("click", markOpened, { once: true });
    previewWindow.addEventListener("scroll", syncScroll, { passive: true });
}

function previousWindowSafeScroll(previewWindow, fallbackScrollY) {
    return Math.max(0, Math.round(Number(previewWindow?.scrollY || fallbackScrollY || 0)));
}

function refreshPreview(updateStatus = true) {
    const config = createPreviewConfig();
    localStorage.setItem("weddingBuilderPreview", JSON.stringify(config));
    savePreviewState(getCurrentPreviewState());
    frame.src = `../index.html?preview=builder&t=${Date.now()}`;
    if (updateStatus) {
        setStatus(`Preview: ${config.weddingId || "chua-co-id"}`);
    }
}

async function saveConfig(event) {
    event.preventDefault();
    if (missingWeddingConfig) {
        setStatus("Wedding ID nay khong ton tai, khong the luu de tranh tao nham thiep.", "error");
        return;
    }
    let payload = createSavePayload();

    if (!payload.weddingId) {
        setStatus("Nhap ten co dau va chu re de tao weddingId.", "error");
        return;
    }

    try {
        const availableWeddingId = await findAvailableWeddingId(payload.weddingId);
        if (!availableWeddingId) {
            setStatus("Khong tao duoc weddingId. Hay kiem tra lai ten co dau chu re.", "error");
            return;
        }
        if (availableWeddingId !== payload.weddingId) {
            setStatus(`WeddingId da ton tai, tu dong luu thanh: ${availableWeddingId}`);
        }
        payload = applyWeddingIdToPayload(payload, availableWeddingId);
        payload.payment = buildPendingPayment(payload.weddingId);

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Dang luu';
        }

        await db.collection("weddings").doc(payload.weddingId).set(payload, { merge: true });
        loadedWeddingConfig = createPreviewConfig();
        editingWeddingId = payload.weddingId;
        originalEditingWeddingId = payload.weddingId;
        weddingIdInput.value = payload.weddingId;
        syncUrlForEdit(payload.weddingId);
        listenWeddingPayment(payload.weddingId);
        setStatus(`Da luu ban nhap Firebase: ${payload.weddingId}`, "success");
        refreshPreview(false);
        if (isPaymentUnlocked(payload)) {
            showUnlockedLinks(payload.weddingId);
        } else {
            showPaymentModal(payload.weddingId);
        }
    } catch (error) {
        console.error(error);
        setStatus("Luu Firebase that bai. Kiem tra dang nhap hoac Firestore Rules.", "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Luu Firebase';
        }
    }
}


function handleUploadClick(event) {
    const button = event.target.closest("[data-upload-button]");
    if (!button) return;

    const fieldName = button.dataset.uploadButton;
    if (document.querySelector(`[data-qr-input="${fieldName}"]`)) {
        uploadQrForField(fieldName);
        return;
    }

    const input = document.querySelector(`[data-upload-target="${fieldName}"]`);
    uploadImageForField(fieldName, input?.files?.[0]);
}

function handleQrInputChange(event) {
    const input = event.target.closest("[data-qr-input]");
    if (!input) return;
    loadQrFile(input.dataset.qrInput, input.files?.[0]);
}

function handleQrCropInput(event) {
    const box = event.target.closest("[data-qr-box]");
    if (!box || !event.target.matches("[data-qr-zoom], [data-qr-x], [data-qr-y]")) return;
    renderQrCrop(box.dataset.qrBox);
}

function handleMapButton(event) {
    const pickerButton = event.target.closest("[data-map-picker]");
    if (pickerButton) {
        openMapPicker(pickerButton.dataset.mapPicker);
    }
}

form.addEventListener("input", () => {
    window.clearTimeout(refreshPreview.timer);
    refreshPreview.timer = window.setTimeout(refreshPreview, 250);
});
previewBtn.addEventListener("click", refreshPreview);
frame.addEventListener("load", syncPreviewStateFromFrame);
form.addEventListener("submit", saveConfig);
form.addEventListener("click", handleUploadClick);
form.addEventListener("change", handleQrInputChange);
form.addEventListener("input", handleQrCropInput);
form.addEventListener("click", handleMapButton);
renderBuilderGalleryFields();
Promise.all([
    loadPaymentSettings(),
    loadMusicLibrary()
]).then(() => loadConfigForEdit()).then(() => populateMusicOptions(loadedWeddingConfig));

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

copyPaymentEditLink?.addEventListener("click", () => {
    copyText(paymentEditLink?.href || "", copyPaymentEditLink);
});

paymentModal?.addEventListener("click", event => {
    if (event.target.closest("[data-close-payment-modal]")) {
        hidePaymentModal();
    }
});

saveMapPointBtn?.addEventListener("click", saveSelectedMapPoint);
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
