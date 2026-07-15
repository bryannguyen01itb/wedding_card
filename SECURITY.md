# Bảo mật — Wedding Card

## Bắt buộc: Publish Firestore Rules

File: `firestore.rules` (bản mới nhất — **không** dùng `if/return` kiểu JS).

Firebase Console → Firestore → **Rules** → dán toàn bộ file → **Publish**.

## Đã xử lý (lớp Rules + code)

| Rủi ro | Cách xử lý |
|--------|------------|
| Public write/delete DB | Create/update có điều kiện; delete chỉ admin |
| Tự unlock / paid | Rules + `sanitizePaymentForBuilderSave` |
| Đổi accessToken / editToken | Rules khóa sau khi đã có |
| Đổi plan khi đã paid | Rules (non-admin) |
| Tra cứu `?t=` list collection | Collection `accessTokens/{token}` → weddingId |
| Link sửa `?e=` | `builder.editToken` + `editAccess/{token}` |
| Wish spam / thiệp chưa mở | Length + cooldown; Rules chỉ create khi wedding paid |
| Upload spam | Session limit + type/size; xem `CLOUDINARY.md` |
| Admin UI | Allowlist email (`js/adminAllowlist.js`); không nhuộm màu theo thiệp |
| Xóa thiệp | Xóa luôn map accessTokens / editAccess |
| Unit test | `npm run test:security` |

## Đã siết thêm (vòng 2)

1. **Đọc wedding theo ID**  
   - Nháp **có editToken**: `get weddings/{id}` **bị chặn** (trừ admin / đã paid).  
   - Builder load nháp qua **`editSessions/{editToken}`** (bí mật trên URL `?e=`).  
   - Legacy không editToken: vẫn get được (tương thích).  
   - Khách paid: get bình thường.  

2. **Cloudinary** — `CLOUDINARY.md` (Dashboard + cleanup API).  

3. **Xóa thiệp** — dọn accessTokens / editAccess / editSessions / paymentStatus + gọi `/api/cloudinary-cleanup` (cần env CF).  

4. **Thanh toán manual** — giữ nguyên (không đổi theo yêu cầu).  

## Thanh toán SePay (webhook)

- Endpoint: `functions/api/sepay-webhook.js` → `POST /api/sepay-webhook`
- Map: `orderCodes/{orderCode}` (builder tạo pending; webhook/admin set paid)
- Dedup: `sepayEvents/{sepayTxnId}` (chỉ service account)
- Env CF: `FIREBASE_SERVICE_ACCOUNT_JSON`, `SEPAY_API_KEY` (hoặc `SEPAY_WEBHOOK_SECRET`)
- Hướng dẫn free: **`SEPAY.md`**
- Admin unlock tay vẫn dùng được (fallback)

## Residual còn lại

- **SePay free** giới hạn 50 GD/tháng (nâng gói khi scale).  
- **Cloudinary unsigned** vẫn cần siết preset trên Dashboard + env cleanup.  
- **isAdmin = login Auth** — chỉ tạo user admin.  
- **Optional:** `js/adminAllowlist.js`.

## Kiểm tra sau Publish rules

```bash
npm run test:security
```

1. Builder Lưu nháp → OK, URL có `?e=`  
2. Khách `?t=` → OK (map accessTokens hoặc legacy query)  
3. Wish trên thiệp **chưa** mở khóa → fail (đúng)  
4. Wish trên thiệp **đã** mở → OK  
5. Admin xóa thiệp → map token được dọn  

## File chính

- `firestore.rules`
- `js/utils/security.js`
- `js/adminAllowlist.js`
- `js/services/weddingData.js`
- `builder/builder.js`
- `admin/admin.js`
- `functions/api/sepay-webhook.js`
- `SEPAY.md`
- `CLOUDINARY.md`
