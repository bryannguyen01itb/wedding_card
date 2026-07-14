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
const paymentCurrency = document.getElementById("paymentCurrency");
const paymentContactUrl = document.getElementById("paymentContactUrl");
const paymentQrImage = document.getElementById("paymentQrImage");
const paymentReceiver = document.getElementById("paymentReceiver");
const paymentMessage = document.getElementById("paymentMessage");
const paymentWeddingInfo = document.getElementById("paymentWeddingInfo");
const markPendingBtn = document.getElementById("markPendingBtn");
const unlockWeddingBtn = document.getElementById("unlockWeddingBtn");
const lockWeddingBtn = document.getElementById("lockWeddingBtn");
const paymentList = document.getElementById("paymentList");
const refreshPaymentListBtn = document.getElementById("refreshPaymentListBtn");

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

function getPaymentSettingAmount() {
    const rawAmount = paymentAmount?.value;
    if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
        return null;
    }

    const amount = Number(rawAmount);
    return Number.isNaN(amount) ? null : amount;
}

function getPaymentSettingCurrency() {
    return paymentCurrency?.value?.trim() || "VND";
}

function formatMoney(amount, currency = "VND") {
    const rawAmount = amount ?? getPaymentSettingAmount();
    if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
        return "Chưa đặt số tiền";
    }

    const value = Number(rawAmount);
    if (Number.isNaN(value)) return "Chưa đặt số tiền";
    return new Intl.NumberFormat("vi-VN").format(value) + ` ${currency || getPaymentSettingCurrency() || "VND"}`;
}

function updatePaymentWeddingInfo(config = currentConfig) {
    if (!paymentWeddingInfo) return;
    const id = config.weddingId || "chưa có weddingId";
    const payment = config.payment || {};
    const status = payment.unlocked || payment.status === "paid"
        ? "Đã mở khóa"
        : payment.status === "pending"
            ? "Đang chờ thanh toán"
            : payment.status === "locked"
                ? "Đã khóa"
                : "Chưa có trạng thái thanh toán";
    paymentWeddingInfo.textContent = `${id} · ${status} · ${formatMoney(payment.amount, payment.currency || getPaymentSettingCurrency())}`;
}

function fillPaymentSettings(data = {}) {
    paymentAmount.value = data.amount ?? "";
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

async function setWeddingPaymentStatus(status) {
    const weddingId = currentConfig.weddingId || form.elements["weddingId"].value.trim() || loadInput.value.trim();
    if (!weddingId) {
        showToast("Tải hoặc nhập weddingId trước khi cập nhật thanh toán.", "error");
        return;
    }

    const unlocked = status === "paid";
    const payload = {
        payment: {
            status,
            unlocked,
            amount: getPaymentSettingAmount() ?? Number(currentConfig.payment?.amount ?? 0),
            currency: getPaymentSettingCurrency() || currentConfig.payment?.currency || "VND",
            confirmedAt: unlocked ? firebase.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    };

    try {
        await db.collection("weddings").doc(weddingId).set(payload, { merge: true });
        currentConfig = mergeConfig(currentConfig, payload);
        updatePaymentWeddingInfo(currentConfig);
        await loadPaymentList();
        showToast(unlocked ? "Đã mở khóa thiệp cho khách." : "Đã cập nhật trạng thái chờ thanh toán.");
    } catch (error) {
        console.error(error);
        showToast("Không cập nhật được trạng thái thanh toán.", "error");
    }
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

    if (!items.length) {
        paymentList.innerHTML = '<p class="empty-state">Chưa có thiệp nào trong Firebase.</p>';
        return;
    }

    items.forEach(item => {
        const payment = item.payment || {};
        const row = document.createElement("article");
        row.className = `payment-item${payment.unlocked || payment.status === "paid" ? " is-paid" : ""}`;
        row.dataset.id = item.id;
        row.innerHTML = `
            <div class="payment-item__info">
                <strong>${item.weddingId || item.id}</strong>
                <span>${item.groom?.nickname || "Chú rể"} & ${item.bride?.nickname || "Cô dâu"}</span>
                <em>${getPaymentStatusLabel(payment)} · ${formatMoney(payment.amount, payment.currency || getPaymentSettingCurrency())}</em>
            </div>
            <div class="payment-item__actions">
                ${payment.unlocked || payment.status === "paid"
                    ? `<button type="button" class="ghost small danger" data-payment-action="locked" data-id="${item.id}"><i class="bi bi-lock-fill"></i> Khóa</button>`
                    : `<button type="button" class="small" data-payment-action="paid" data-id="${item.id}"><i class="bi bi-check2-circle"></i> Đã trả</button>`}
            </div>
        `;
        paymentList.appendChild(row);
    });
}

async function loadPaymentList() {
    if (!paymentList) return;
    paymentList.innerHTML = '<p class="empty-state">Đang tải danh sách thiệp...</p>';

    try {
        const snapshot = await db.collection("weddings").limit(80).get();
        const items = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data(), weddingId: doc.data().weddingId || doc.id }))
            .sort((a, b) => {
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
    const payload = {
        payment: {
            status,
            unlocked,
            amount: getPaymentSettingAmount(),
            currency: getPaymentSettingCurrency(),
            confirmedAt: unlocked ? firebase.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    };

    try {
        await db.collection("weddings").doc(weddingId).set(payload, { merge: true });
        if (currentConfig.weddingId === weddingId) {
            currentConfig = mergeConfig(currentConfig, payload);
            updatePaymentWeddingInfo(currentConfig);
        }
        await loadPaymentList();
        showToast(unlocked ? `Đã mở khóa ${weddingId}.` : `Đã khóa ${weddingId}.`);
    } catch (error) {
        console.error(error);
        showToast("Không cập nhật được payment trong danh sách.", "error");
    }
}

async function handlePaymentListClick(event) {
    const button = event.target.closest("button[data-payment-action]");
    if (!button) return;
    const { paymentAction, id } = button.dataset;

    await updateWeddingPaymentById(id, paymentAction);
}

async function handlePaymentListRowClick(event) {
    if (event.target.closest("button")) return;
    const row = event.target.closest(".payment-item");
    if (!row?.dataset.id) return;
    await loadConfigById(row.dataset.id);
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
    updatePaymentWeddingInfo(currentConfig);
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
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang tải';

    try {
        if (!weddingId) {
            fillForm(createDefaultConfig());
            showToast("Đang dùng form mẫu cho khách mới.");
            return;
        }

        const doc = await db.collection("weddings").doc(weddingId).get();
        if (!doc.exists) {
            showToast(`Không tìm thấy weddingId: ${weddingId}.`, "error");
            return;
        }

        const config = mergeConfig(createDefaultConfig(), { ...doc.data(), weddingId: doc.id });
        fillForm(config);
        showToast("Đã tải config từ Firebase.");
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

function setAdminView(viewId) {
    const next = ["wedding", "music", "payment"].includes(viewId) ? viewId : "wedding";

    document.querySelectorAll("[data-admin-view]").forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.adminView === next);
    });
    document.querySelectorAll("[data-admin-nav]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.adminNav === next);
    });

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
    setAdminView(hashView || "wedding");

    try {
        await Promise.all([loadMusicLibraryAdmin(), loadPaymentSettingsAdmin(), loadPaymentList()]);
    } catch (error) {
        console.error(error);
        showToast("Một phần dữ liệu admin chưa tải được.", "error");
    }

    if (!hasLoadedInitialConfig) {
        const params = new URLSearchParams(window.location.search);
        try {
            await loadConfigById(params.get("wedding") || "");
        } catch (error) {
            console.error(error);
        }
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

    document.querySelectorAll("[data-admin-nav]").forEach(button => {
        button.addEventListener("click", () => setAdminView(button.dataset.adminNav));
    });
    window.addEventListener("hashchange", () => {
        setAdminView(window.location.hash.replace("#", "") || "wedding");
    });

    form?.addEventListener("submit", saveConfig);
    musicForm?.addEventListener("submit", saveMusicItem);
    paymentSettingsForm?.addEventListener("submit", savePaymentSettings);
    paymentList?.addEventListener("click", handlePaymentListClick);
    paymentList?.addEventListener("click", handlePaymentListRowClick);
    refreshPaymentListBtn?.addEventListener("click", loadPaymentList);
    markPendingBtn?.addEventListener("click", () => setWeddingPaymentStatus("pending"));
    unlockWeddingBtn?.addEventListener("click", () => setWeddingPaymentStatus("paid"));
    lockWeddingBtn?.addEventListener("click", () => setWeddingPaymentStatus("locked"));
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
    fillForm(createDefaultConfig());
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
