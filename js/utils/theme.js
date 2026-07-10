function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const normalized = clean.length === 3
        ? clean.split("").map(c => c + c).join("")
        : clean;
    const value = parseInt(normalized, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

function darkenHex(hex, percent) {
    const rgb = hexToRgb(hex);
    const ratio = 1 - percent / 100;
    const toHex = v => Math.round(v * ratio).toString(16).padStart(2, "0");
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function applyTheme(primaryColor = "#8fb8a8") {
    const rgb = hexToRgb(primaryColor);
    const root = document.documentElement.style;
    root.setProperty("--primary-color", primaryColor);
    root.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    root.setProperty("--primary-hover", darkenHex(primaryColor, 10));
}
