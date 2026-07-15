/**
 * Danh sách email admin (Firebase Auth).
 * - Để trống []: mọi user đã login Auth đều vào được admin UI (chỉ tạo tài khoản admin).
 * - Có email: chỉ những email này vào admin UI.
 *
 * Firestore Rules: isAdmin = request.auth != null
 * (chỉ tạo user Auth cho admin; tắt public signup).
 */
export const ADMIN_EMAILS = [
    // "email-admin-cua-ban@gmail.com",
];

export function isAllowedAdminEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return false;
    if (!ADMIN_EMAILS.length) return true;
    return ADMIN_EMAILS.some(item => String(item || "").trim().toLowerCase() === normalized);
}
