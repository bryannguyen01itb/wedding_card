import { wedding as fallbackWedding } from "../js/config.js";
import { db } from "../js/firebase.js";

const DEFAULT_PRIMARY = "#c9974f";
const DEFAULT_MEDIA_CONCEPT = "concept-1";
const GALLERY_SIZE = 7;
// Có thể điền email admin ở đây để ẩn UI nếu đăng nhập nhầm tài khoản.
// Bảo mật thật vẫn phải nằm ở Firestore Rules.
const ADMIN_EMAILS = [];

const auth = firebase.auth();
const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
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

let currentConfig = createDefaultConfig();
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

function createDefaultConfig() {
    return mergeConfig(clone(fallbackWedding), {
        theme: {
            primaryColor: DEFAULT_PRIMARY
        }
    });
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

    const url = new URL("../index.html", window.location.href);
    url.searchParams.set("wedding", weddingId);
    previewLink.href = url.href;
    previewLink.textContent = url.href;
}

function fillForm(config) {
    currentConfig = mergeConfig(createDefaultConfig(), config || {});

    [...form.elements].forEach(field => {
        if (!field.name || field.name === "theme.primaryColorText") return;
        const value = getByPath(currentConfig, field.name);
        field.value = Array.isArray(value) ? value.join("\n") : value ?? "";
    });

    syncColorInputs(currentConfig.theme?.primaryColor || DEFAULT_PRIMARY);
    loadInput.value = currentConfig.weddingId || loadInput.value;
    updatePreviewLink(currentConfig.weddingId);
}

function readForm() {
    const nextConfig = mergeConfig(createDefaultConfig(), currentConfig);

    [...form.elements].forEach(field => {
        if (!field.name || field.name === "theme.primaryColorText") return;

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

    return nextConfig;
}

async function loadConfigById(weddingId) {
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang tải';

    try {
        if (!weddingId) {
            fillForm(createDefaultConfig());
            showToast("Đang dùng form mẫu cho khách mới.");
            return;
        }

        const doc = await db.collection("weddings").doc(weddingId).get();
        const config = doc.exists
            ? mergeConfig(createDefaultConfig(), { ...doc.data(), weddingId: doc.id })
            : mergeConfig(createDefaultConfig(), { weddingId });

        fillForm(config);
        showToast(doc.exists ? "Đã tải config từ Firebase." : "Chưa có config, đã tạo form mẫu theo weddingId này.");
    } catch (error) {
        console.error(error);
        showToast("Không tải được config. Kiểm tra đăng nhập và Firestore Rules.", "error");
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = '<i class="bi bi-search"></i> Tải';
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
        updatePreviewLink(config.weddingId);
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
    const allowedEmails = ADMIN_EMAILS.filter(Boolean);
    return !allowedEmails.length || allowedEmails.includes(user.email);
}

function showLoggedOut() {
    loginPanel.classList.remove("is-hidden");
    adminHero.classList.add("is-hidden");
    form.classList.add("is-hidden");
}

async function showLoggedIn(user) {
    if (!canUseAdmin(user)) {
        showToast("Email này chưa được thêm vào danh sách admin trong code.", "error");
        await auth.signOut();
        return;
    }

    loginPanel.classList.add("is-hidden");
    adminHero.classList.remove("is-hidden");
    form.classList.remove("is-hidden");
    accountEmail.textContent = user.email;

    if (!hasLoadedInitialConfig) {
        const params = new URLSearchParams(window.location.search);
        await loadConfigById(params.get("wedding") || "");
        hasLoadedInitialConfig = true;
    }
}

function initEvents() {
    loginForm.addEventListener("submit", login);
    logoutBtn.addEventListener("click", () => auth.signOut());
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
    document.getElementById("mediaConcept")?.addEventListener("change", event => {
        currentConfig = readForm();
        activeMediaConcept = event.target.value || DEFAULT_MEDIA_CONCEPT;
        fillForm(currentConfig);
    });
    form.elements["theme.primaryColor"].addEventListener("input", event => syncColorInputs(event.target.value));
    form.elements["theme.primaryColorText"].addEventListener("input", event => {
        if (/^#[0-9a-fA-F]{6}$/.test(event.target.value.trim())) {
            syncColorInputs(event.target.value.trim());
        }
    });
}

fillGalleryFields();
fillForm(createDefaultConfig());
initEvents();
auth.onAuthStateChanged(user => {
    if (user) {
        showLoggedIn(user);
    } else {
        showLoggedOut();
        hasLoadedInitialConfig = false;
    }
});
