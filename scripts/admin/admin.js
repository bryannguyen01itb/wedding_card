const DEFAULT_PRIMARY = "#c9974f";
const GALLERY_SIZE = 7;

const form = document.getElementById("adminForm");
const loadInput = document.getElementById("loadWeddingId");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const toast = document.getElementById("toast");
const previewLink = document.getElementById("previewLink");
const galleryFields = document.getElementById("galleryFields");

let currentConfig = {};

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getActiveConcept(config = currentConfig) {
    return config?.theme?.concept || "concept-1";
}

function resolveActivePath(path, config = currentConfig) {
    if (!path.includes(".active.")) return path;
    return path.replace(".active.", `.${getActiveConcept(config)}.`);
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

function hexToRgb(hex) {
    const clean = String(hex || DEFAULT_PRIMARY).replace("#", "");
    const value = parseInt(
        clean.length === 3 ? clean.split("").map(char => char + char).join("") : clean,
        16
    );

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

function syncColorInputs(primaryColor) {
    const value = /^#[0-9a-fA-F]{6}$/.test(primaryColor || "") ? primaryColor : DEFAULT_PRIMARY;
    const rgb = hexToRgb(value);

    form.elements["theme.primaryColor"].value = value;
    form.elements["theme.primaryColorText"].value = value;
    document.documentElement.style.setProperty("--admin-primary", value);
    document.documentElement.style.setProperty("--admin-primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
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

function updatePreviewLink(weddingId) {
    if (!weddingId) {
        previewLink.textContent = "chưa có weddingId";
        previewLink.href = "#";
        return;
    }

    const url = new URL("/site/index.html", window.location.origin);
    url.searchParams.set("wedding", weddingId);
    previewLink.href = url.href;
    previewLink.textContent = url.href;
}

function fillForm(config) {
    currentConfig = clone(config || {});

    [...form.elements].forEach(field => {
        if (!field.name || field.name === "theme.primaryColorText") return;
        const value = getByPath(currentConfig, field.name);
        field.value = Array.isArray(value) ? value.join("\n") : value ?? "";
    });

    form.elements["theme.concept"].value = getActiveConcept(currentConfig);
    syncColorInputs(currentConfig.theme?.primaryColor || DEFAULT_PRIMARY);
    loadInput.value = currentConfig.weddingId || loadInput.value;
    updatePreviewLink(currentConfig.weddingId);
}

function readForm() {
    const nextConfig = clone(currentConfig);

    [...form.elements].forEach(field => {
        if (!field.name || field.name === "theme.primaryColorText") return;

        let value = field.value.trim();
        if (field.name === "sectionSubtitles.thanks") {
            value = value.split("\n").map(line => line.trim()).filter(Boolean);
        }

        setByPath(nextConfig, field.name, value);
    });

    nextConfig.theme = nextConfig.theme || {};
    nextConfig.theme.primaryColor = form.elements["theme.primaryColorText"].value.trim() || DEFAULT_PRIMARY;
    nextConfig.gallery = nextConfig.gallery || {};
    nextConfig.gallery.photos = Array.from({ length: GALLERY_SIZE }, (_, index) => ({
        src: form.elements[`gallery.photos.${index}.src`].value.trim(),
        alt: form.elements[`gallery.photos.${index}.alt`].value.trim() || `Ảnh cưới ${index + 1}`
    })).filter(photo => photo.src);

    return nextConfig;
}

async function fetchConfig(weddingId = "") {
    const query = weddingId ? `?id=${encodeURIComponent(weddingId)}` : "";
    const response = await fetch(`/api/config${query}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Không tải được config");
    }

    return data;
}

async function loadConfigById(weddingId) {
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang tải';

    try {
        const data = await fetchConfig(weddingId);
        fillForm(data.config);
        showToast(data.exists ? "Đã tải config từ Firebase." : "Đang dùng form mẫu cho weddingId này.");
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = '<i class="bi bi-search"></i> Tải';
    }
}

async function saveConfig(event) {
    event.preventDefault();
    const config = readForm();

    if (!config.weddingId) {
        showToast("Wedding ID không được để trống.", "error");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang lưu';

    try {
        const response = await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Lưu thất bại");
        }

        currentConfig = config;
        loadInput.value = config.weddingId;
        updatePreviewLink(config.weddingId);
        showToast("Đã lưu config lên Firebase.");
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Lưu Firebase';
    }
}

function initEvents() {
    loadBtn.addEventListener("click", () => loadConfigById(loadInput.value.trim()));
    loadInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            loadConfigById(loadInput.value.trim());
        }
    });

    form.addEventListener("submit", saveConfig);
    resetBtn.addEventListener("click", () => loadConfigById(""));
    form.elements["weddingId"].addEventListener("input", event => updatePreviewLink(event.target.value.trim()));
    form.elements["theme.concept"].addEventListener("change", () => {
        currentConfig = readForm();
        fillForm(currentConfig);
    });
    form.elements["theme.primaryColor"].addEventListener("input", event => syncColorInputs(event.target.value));
    form.elements["theme.primaryColorText"].addEventListener("input", event => {
        if (/^#[0-9a-fA-F]{6}$/.test(event.target.value.trim())) {
            syncColorInputs(event.target.value.trim());
        }
    });
}

async function init() {
    fillGalleryFields();
    initEvents();

    const params = new URLSearchParams(window.location.search);
    await loadConfigById(params.get("wedding") || "");
}

init();
