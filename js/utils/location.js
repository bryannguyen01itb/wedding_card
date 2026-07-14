/**
 * Poster location helpers — tỉnh/TP nhà trai & nhà gái, format "HÀ NỘI, VIỆT NAM".
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

/** Chuẩn hoá thành "TỈNH/TP, VIỆT NAM" (uppercase vi-VN). */
export function formatPosterLocation(provinceOrAddress) {
    let raw = String(provinceOrAddress || "").trim();
    if (!raw) return "";

    // Đã là dạng "X, VIỆT NAM"
    const withoutVn = raw.replace(VN_SUFFIX, "").trim();
    let province = withoutVn.includes(",")
        ? extractProvinceFromAddress(withoutVn)
        : withoutVn.replace(PROVINCE_PREFIX, "").trim();

    if (!province) province = extractProvinceFromAddress(raw);
    if (!province) return "";

    const upper = province.toLocaleUpperCase("vi-VN");
    return `${upper}, VIỆT NAM`;
}

/**
 * side: "groom" | "bride" | "trai" | "gai" | ...
 * Ưu tiên ceremony[side].location → ceremony[side].address
 */
export function resolveInviteSide(sideRaw) {
    const s = String(sideRaw || "").trim().toLowerCase();
    if (["bride", "gai", "nha-gai", "nhagai", "nhà gái", "nhà-gái"].includes(s)) {
        return "bride";
    }
    if (["groom", "trai", "nha-trai", "nhatrai", "nhà trai", "nhà-trai"].includes(s)) {
        return "groom";
    }
    return "groom";
}

export function getInviteSideFromUrl(search = typeof window !== "undefined" ? window.location.search : "") {
    const params = new URLSearchParams(search);
    return resolveInviteSide(params.get("side") || params.get("nha") || "");
}

export function resolvePosterLocation(wedding, sideRaw = "groom") {
    const side = resolveInviteSide(sideRaw);
    const house = wedding?.ceremony?.[side] || {};

    const fromHouseLocation = formatPosterLocation(house.location);
    if (fromHouseLocation) return fromHouseLocation;

    const fromAddress = formatPosterLocation(house.address);
    if (fromAddress) return fromAddress;

    return "VIỆT NAM";
}
