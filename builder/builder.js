import { wedding as fallbackWedding } from "../js/config.js";
import { db } from "../js/firebase.js";

const form = document.getElementById("builderForm");
const frame = document.getElementById("previewFrame");
const statusEl = document.getElementById("status");
const weddingIdInput = document.getElementById("weddingId");
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

function showSaveModal(weddingId) {
    updateResultLinks(weddingId);
    if (!saveModal) {
        return;
    }

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
    const data = new FormData(form);
    const builderTheme = readBuilderTheme();

    return {
        weddingId: builderTheme.weddingId,
        date: builderTheme.date,
        theme: builderTheme.theme,
        builder: {
            groomNickname: data.get("groomNickname") || "",
            brideNickname: data.get("brideNickname") || ""
        }
    };
}

function fillBuilderForm(config = {}) {
    const theme = config.theme || {};
    const blocks = theme.blocks || {};
    const fonts = theme.fonts || {};
    const builder = config.builder || {};

    editingWeddingId = config.weddingId || editingWeddingId;
    weddingIdInput.value = editingWeddingId;

    setControlValue("groomNickname", builder.groomNickname);
    setControlValue("brideNickname", builder.brideNickname);
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
            updateResultLinks(weddingId);
            setStatus(`Dang sua: ${weddingId}`);
        } else {
            updateResultLinks(weddingId);
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
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Dang luu';
        }

        await db.collection("weddings").doc(payload.weddingId).set(payload, { merge: true });
        editingWeddingId = payload.weddingId;
        weddingIdInput.value = payload.weddingId;
        syncUrlForEdit(payload.weddingId);
        updateResultLinks(payload.weddingId);
        setStatus(`Da luu Firebase thanh cong: ${payload.weddingId}`, "success");
        refreshPreview(false);
        showSaveModal(payload.weddingId);
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

form.addEventListener("input", () => {
    window.clearTimeout(refreshPreview.timer);
    refreshPreview.timer = window.setTimeout(refreshPreview, 250);
});
previewBtn.addEventListener("click", refreshPreview);
form.addEventListener("submit", saveConfig);
loadConfigForEdit();

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

window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        hideSaveModal();
    }
});
