/**
 * Ghi css/brand.css từ js/brand.js (một nguồn BRAND).
 * Usage: node scripts/sync-brand-css.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brandMod = await import(pathToFileURL(join(root, "js/brand.js")).href);
const css = brandMod.getBrandCssText();
const out = join(root, "css/brand.css");
writeFileSync(out, css, "utf8");
console.log("Wrote", out);
console.log("primary =", brandMod.BRAND_PRIMARY);
