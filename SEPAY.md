# SePay webhook — thanh toán tự động (free)

Luồng: khách CK đúng **số tiền** + **mã GD (`orderCode`)** → SePay bắn webhook → Cloudflare Function mở khóa thiệp (`payment.unlocked = true`) → builder đang mở modal **tự** hiện link thiệp.

Admin vẫn bấm “Đã thanh toán” được (fallback).

## Chi phí (hướng free)

| Thành phần | Gói free |
|------------|----------|
| SePay | [FREE](https://sepay.vn/bang-gia.html) — **50 giao dịch/tháng** (webhook/API có) |
| Cloudflare Pages Functions | Free tier |
| Firebase Firestore | Spark / free usage nhỏ |
| Code trong repo | Free |

Khi > 50 GD/tháng: nâng gói SePay (trả phí) hoặc giữ admin unlock tay.

## Đã có trong code

| File | Việc |
|------|------|
| `functions/api/sepay-webhook.js` | Nhận POST SePay, verify key/HMAC, unlock |
| `orderCodes/{orderCode}` | Map mã CK → weddingId (builder ghi lúc Lưu) |
| `paymentStatus/{weddingId}` | Builder `onSnapshot` → tự đóng modal khi paid |
| `sepayEvents/{txnId}` | Dedup webhook (service account only) |
| `firestore.rules` | Client không tự set `paid` trên orderCodes |
| Admin unlock / xóa thiệp | Đồng bộ / dọn `orderCodes` |

## Bước cấu hình (1 lần)

### 1. Firebase service account

1. Firebase Console → Project settings → **Service accounts**
2. **Generate new private key** → file JSON
3. **Không commit** file này (đã `.gitignore` `serviceAccountKey.json`)

### 2. Cloudflare Pages env

Pages → project → **Settings → Environment variables** (Production + Preview nếu cần):

| Name | Value |
|------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Toàn bộ nội dung JSON service account (1 dòng / paste nguyên file) |
| `SEPAY_API_KEY` | API Key bạn tự đặt khi tạo webhook SePay |
| `SEPAY_WEBHOOK_SECRET` | *(tuỳ chọn)* nếu chọn auth HMAC-SHA256 |
| `SEPAY_ACCOUNT_NUMBER` | *(tuỳ chọn)* STK nhận tiền — lọc GD nhầm |

Redeploy sau khi thêm env.

### 3. SePay (gói FREE)

1. Đăng ký [my.sepay.vn](https://my.sepay.vn), liên kết **STK nhận tiền**
2. **Company → Cấu hình** → cấu trúc mã thanh toán: prefix **`WC`** (để field `code` khớp `WCxxxxxxxx`)
3. Tạo Webhook:
   - URL: `https://DOMAIN-CUA-BAN/api/sepay-webhook`
   - Sự kiện: giao dịch **tiền vào**
   - Auth: **API Key** → dán cùng giá trị với `SEPAY_API_KEY` trên CF  
     (hoặc HMAC + `SEPAY_WEBHOOK_SECRET`)
4. Lưu webhook (URL phải **HTTPS** public — không dùng localhost)

### 4. Publish Firestore Rules

```bash
firebase deploy --only firestore:rules
```

Hoặc Console → Firestore → Rules → dán `firestore.rules` → Publish.

### 5. Admin settings thiệp

Trong `/admin/`: QR CK, số tiền single/multi, tên người nhận, link hỗ trợ (khi auto fail).

## Kiểm tra

### Endpoint đã deploy?

```txt
GET https://DOMAIN/api/sepay-webhook
```

JSON có `configured.firebase` / `apiKey` = true.

### Giả lập webhook (Postman / curl)

```bash
curl -X POST "https://DOMAIN/api/sepay-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey YOUR_SEPAY_API_KEY" \
  -d '{
    "id": 999001,
    "gateway": "Vietcombank",
    "transactionDate": "2026-07-15 12:00:00",
    "accountNumber": "0123456789",
    "code": "WCABCDEF12",
    "content": "WCABCDEF12",
    "transferType": "in",
    "transferAmount": 99000,
    "referenceCode": "TEST001"
  }'
```

- Đổi `code` / `transferAmount` đúng thiệp đã **Lưu Firebase** (pending).
- Expect: `{"success":true,"unlocked":true,...}`
- Builder (modal chờ) tự hiện link; admin list → Đã thanh toán.

### SePay Test mode

Dùng [test mode SePay](https://developer.sepay.vn/en/sepay-webhooks/test-mode/bat-dau-nhanh) nếu có — không đụng live balance.

## Local dev

`python3 -m http.server` **không** chạy CF Functions → webhook không có local.

- Unlock tay bằng admin, hoặc
- Deploy preview CF + webhook URL preview, hoặc
- `cloudflared tunnel` / deploy staging.

## Khách CK như thế nào?

1. Builder **Lưu Firebase** → popup: số tiền + **mã GD** (vd `WC7K3M9P2X`)
2. CK đúng số tiền, **nội dung chuyển khoản = đúng mã** (copy từ popup)
3. Vài giây–vài phút: SePay → webhook → thiệp mở; modal builder tự đổi sang link chính thức

Sai số tiền / sai nội dung → **không** auto unlock (admin mở tay).

## Bảo mật

- Client **không** set `unlocked/paid` (rules + `sanitizePaymentForBuilderSave`)
- Webhook **bắt buộc** API Key hoặc HMAC
- Service account chỉ nằm env CF, không đưa vào `js/`
- Dedup `sepayEvents/{id}` tránh double process

Chi tiết rules: `SECURITY.md`.

## Troubleshooting

| Hiện tượng | Kiểm tra |
|------------|----------|
| GET webhook `firebase: false` | Chưa set / sai JSON service account |
| `401 invalid_api_key` | Key SePay ≠ `SEPAY_API_KEY` |
| `success` + `order_not_found` | Chưa Lưu builder (chưa có `orderCodes`) hoặc sai mã |
| `amount_mismatch` | CK khác `payment.amount` snapshot |
| CK đúng nhưng không unlock | Rules cũ? Deploy function? SePay log retry? Admin fallback |
| Local không thấy API | Đúng — cần CF Pages |

## Admin fallback

`/admin/` → danh sách thiệp → **Xác nhận đã thanh toán**  
→ `provider: manual` (hoặc giữ sepay nếu đã có).
