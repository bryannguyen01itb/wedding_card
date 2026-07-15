/**
 * Xóa ảnh Cloudinary theo public_id (chạy local với secret).
 *
 * Env:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Usage:
 *   CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... \
 *     node scripts/cleanup-cloudinary.mjs public_id_1 public_id_2
 */
import { createHash } from "crypto";

const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const ids = process.argv.slice(2).filter(Boolean);

if (!cloud || !apiKey || !apiSecret) {
    console.error("Thiếu CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET");
    process.exit(1);
}
if (!ids.length) {
    console.error("Usage: node scripts/cleanup-cloudinary.mjs <public_id>...");
    process.exit(1);
}

async function destroy(publicId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash("sha1").update(toSign).digest("hex");
    const body = new URLSearchParams({
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature
    });
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });
    const data = await res.json();
    console.log(publicId, data.result || data);
}

for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    await destroy(id);
}
