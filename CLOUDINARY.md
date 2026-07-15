# Cloudinary — siết upload + xóa ảnh khi xóa thiệp

## 1. Dashboard (unsigned preset)

**Settings → Upload → Upload presets** → preset `wedding_unsigned` (hoặc tên trong `builder/builder.js`):

| Setting | Gợi ý |
|---------|--------|
| Signing mode | Unsigned (cần cho builder browser) |
| Max file size | **3–5 MB** |
| Allowed formats | **jpg, png, webp** only |
| Folder | Khóa / prefix `wedding-builder` nếu có |
| Access mode | Public (để thiệp load ảnh) |
| Overwrite | Off |

Bật **billing alerts** khi gần hết quota.

## 2. Trong code (đã có)

- Nén ảnh client  
- Giới hạn ~40 upload / tab  
- Chỉ image/*  
- Lưu `builder.cloudinaryPublicIds` khi upload  
- Admin xóa thiệp → gọi `/api/cloudinary-cleanup` (best-effort)

## 3. Xóa ảnh tự động khi xóa thiệp (Cloudflare Pages)

Deploy site lên Cloudflare Pages, thêm **Environment variables**:

```
CLOUDINARY_CLOUD_NAME=dndcuen0
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLEANUP_KEY=chuoi-bi-mat-dai
```

Function: `functions/api/cloudinary-cleanup.js`

Admin (tùy chọn) set key trên trang admin console:

```js
window.__CLOUDINARY_CLEANUP_KEY = "chuoi-bi-mat-dai";
```

(hoặc hardcode tạm trong admin chỉ trên máy admin — **không commit secret**).

Local `python -m http.server`: API không chạy → xóa Firestore vẫn OK, toast nhắc dọn Cloudinary tay.

## 4. Script local dọn ảnh

```bash
export CLOUDINARY_CLOUD_NAME=...
export CLOUDINARY_API_KEY=...
export CLOUDINARY_API_SECRET=...
node scripts/cleanup-cloudinary.mjs wedding-builder/xxx/cover_abc
```

## 5. Hướng tốt hơn (sau)

Signed upload qua backend — bỏ unsigned preset public.
