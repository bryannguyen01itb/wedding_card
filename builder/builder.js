import { wedding as fallbackWedding } from "../js/config.js";
import { db } from "../js/firebase.js";

const form = document.getElementById("builderForm");
const frame = document.getElementById("previewFrame");
const statusEl = document.getElementById("status");
const weddingIdInput = document.getElementById("weddingId");
const previewBtn = document.getElementById("previewBtn");

const BASE_CONCEPT = "concept-1";
const WEDDING_QUERY_KEY = "wedding";

let editingWeddingId = "";

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function removeVietnamese(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
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

function buildWeddingId(data) {
    return [
        slugify(data.get("groomNickname")),
        slugify(data.get("brideNickname")),
        getYear(data.get("date"))
    ].filter(Boolean).join("-");
}

function getWeddingIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get(WEDDING_QUERY_KEY)?.trim() || "";
}

function setControlValue(name, value) {
    const field = form.elements[name];
    if (field && value !== undefined && value !== null && value !== "") {
        field.value = value;
    }
}

function setStatus(message, type = "") {
    statusEl.textContent = message;
    statusEl.dataset.type = type;
}

function readBuilderTheme() {
    const data = new FormData(form);
    const weddingId = editingWeddingId || buildWeddingId(data);

    weddingIdInput.value = weddingId;

    return {
        weddingId,
        date: data.get("date") || fallbackWedding.date,
        theme: {
            concept: BASE_CONCEPT,
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

function createPreviewConfig() {
    const builderTheme = readBuilderTheme();
    const config = clone(fallbackWedding);

    config.weddingId = builderTheme.weddingId;
    config.date = builderTheme.date;
    config.theme = {
        ...(config.theme || {}),
        ...builderTheme.theme
    };

    return config;
}

function createSavePayload() {
    const builderTheme = readBuilderTheme();

    return {
        weddingId: builderTheme.weddingId,
        date: builderTheme.date,
        theme: builderTheme.theme
    };
}

function fillBuilderForm(config = {}) {
    const theme = config.theme || {};
    const blocks = theme.blocks || {};
    const fonts = theme.fonts || {};

    editingWeddingId = config.weddingId || editingWeddingId;
    weddingIdInput.value = editingWeddingId;

    setControlValue("date", config.date);
    setControlValue("primaryColor", theme.primaryColor);
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
}

async function loadConfigForEdit() {
    const weddingId = getWeddingIdFromUrl();

    if (!weddingId) {
        refreshPreview();
        return;
    }

    editingWeddingId = weddingId;
    weddingIdInput.value = weddingId;
    setStatus(`Dang tai cau hinh: ${weddingId}`);

    try {
        const doc = await db.collection("weddings").doc(weddingId).get();
        if (doc.exists) {
            fillBuilderForm({ ...doc.data(), weddingId: doc.id });
            setStatus(`Dang sua: ${weddingId}`);
        } else {
            setStatus(`Chua co cau hinh Firebase cho: ${weddingId}. Co the luu de tao moi.`, "error");
        }
    } catch (error) {
        console.error(error);
        setStatus("Khong tai duoc cau hinh. Kiem tra Firestore Rules.", "error");
    }

    refreshPreview(false);
}

function refreshPreview(updateStatus = true) {
    const config = createPreviewConfig();
    localStorage.setItem("weddingBuilderPreview", JSON.stringify(config));
    frame.src = `../index.html?preview=builder&t=${Date.now()}`;
    if (updateStatus) {
        setStatus(`Preview: ${config.weddingId || "chua-co-id"}`);
    }
}

async function saveConfig(event) {
    event.preventDefault();
    const payload = createSavePayload();

    if (!payload.weddingId) {
        setStatus("Nhap ten co dau va chu re de tao weddingId.", "error");
        return;
    }

    try {
        await db.collection("weddings").doc(payload.weddingId).set(payload, { merge: true });
        editingWeddingId = payload.weddingId;
        weddingIdInput.value = payload.weddingId;
        setStatus(`Da luu Firebase: ${payload.weddingId}`);
        refreshPreview();
    } catch (error) {
        console.error(error);
        setStatus("Luu Firebase that bai. Kiem tra dang nhap hoac Firestore Rules.", "error");
    }
}

form.addEventListener("input", () => {
    window.clearTimeout(refreshPreview.timer);
    refreshPreview.timer = window.setTimeout(refreshPreview, 250);
});
previewBtn.addEventListener("click", refreshPreview);
form.addEventListener("submit", saveConfig);
loadConfigForEdit();
