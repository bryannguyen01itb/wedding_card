/**
 * Poster location helpers — tỉnh/TP nhà trai & nhà gái trên poster.
 * Hiển thị: "HÀ NỘI · HẢI PHÒNG" (cô dâu · chú rể), không kèm ", VIỆT NAM".
 * Một link thiệp chung — không còn ?side=groom|bride.
 */

const VN_SUFFIX = /,?\s*vi[eệ]t\s*nam\s*$/i;
const HOUSE_PREFIX = /^(nhà\s*)?(trai|gái)\s*[-–—:]?\s*/i;
const PROVINCE_PREFIX = /^(tp\.?|t\.?p\.?|tỉnh|thành\s*phố|tinh|thanh\s*pho)\s+/i;

/** Lấy cụm tỉnh/thành từ địa chỉ đầy đủ (thường là phần sau dấu phẩy cuối). */
export function extractProvinceFromAddress(address) {
    let text = String(address || "").trim();
    if (!text) return "";

    text = text.replace(HOUSE_PREFIX, "").trim();
    text = text.replace(VN_SUFFIX, "").trim();

    const parts = text.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) return "";

    let province = parts[parts.length - 1];
    province = province.replace(VN_SUFFIX, "").trim();
    province = province.replace(PROVINCE_PREFIX, "").trim();
    return province;
}

/**
 * Chuẩn hoá thành tên tỉnh/TP uppercase (không kèm VIỆT NAM).
 * Chấp nhận "Hà Nội", "HÀ NỘI, VIỆT NAM", hoặc địa chỉ đầy đủ.
 */
export function formatProvinceName(provinceOrAddress) {
    let raw = String(provinceOrAddress || "").trim();
    if (!raw) return "";

    const withoutVn = raw.replace(VN_SUFFIX, "").trim();
    let province = withoutVn.includes(",")
        ? extractProvinceFromAddress(withoutVn)
        : withoutVn.replace(PROVINCE_PREFIX, "").trim();

    if (!province) province = extractProvinceFromAddress(raw);
    if (!province) return "";

    return province.toLocaleUpperCase("vi-VN");
}

/** @deprecated Dùng formatProvinceName — giữ alias để builder cũ không vỡ */
export function formatPosterLocation(provinceOrAddress) {
    return formatProvinceName(provinceOrAddress);
}

export function resolveHouseProvince(wedding, houseKey) {
    const house = wedding?.ceremony?.[houseKey] || {};
    return (
        formatProvinceName(house.location)
        || formatProvinceName(house.address)
        || ""
    );
}

/**
 * Poster: tỉnh cô dâu · tỉnh chú rể (1 link thiệp).
 * Trùng tỉnh → chỉ hiện 1 lần. Thiếu 1 bên → hiện bên còn lại.
 * Tổ chức chung (ceremony.mode === "joint") → 1 tỉnh từ joint.
 */
export function resolvePosterLocation(wedding) {
    if (wedding?.ceremony?.mode === "joint") {
        const joint = wedding.ceremony?.joint || {};
        return (
            formatProvinceName(joint.location)
            || formatProvinceName(joint.address)
            || ""
        );
    }

    const bride = resolveHouseProvince(wedding, "bride");
    const groom = resolveHouseProvince(wedding, "groom");

    if (bride && groom) {
        if (bride === groom) return bride;
        // Cô dâu · chú rể
        return `${bride} · ${groom}`;
    }

    return bride || groom || "";
}
