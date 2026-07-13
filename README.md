# Thiệp Cưới Online

Thiệp mời cưới dạng trang web tĩnh, tối ưu cho mobile hiện đại với khung hiển thị tối đa 480px. Nội dung chính được cấu hình trong `js/config.js` để dễ thay thông tin cho từng cặp đôi.

## Cấu trúc dự án

```txt
├── index.html              # Trang chính
├── css/
│   ├── style.css           # Import tất cả CSS
│   └── parts/              # CSS theo từng phần
│       ├── base.css        # Reset, biến màu, layout, nút nhạc
│       ├── cover.css       # Màn hình bìa thiệp
│       ├── sections.css    # Header, save date, about, timeline, gallery, wish, gift
│       ├── countdown-thanks.css
│       └── animations.css  # Hiệu ứng scroll/keyframes
├── js/
│   ├── app.js              # Entry point, khởi tạo toàn bộ app
│   ├── config.js           # Chỉnh sửa nội dung thiệp tại đây
│   ├── firebase.js         # Cấu hình Firebase
│   ├── utils/              # Hàm tiện ích dùng chung
│   ├── render/             # Render nội dung từ config vào DOM
│   └── features/           # Logic tương tác từng tính năng
├── img/                    # Ảnh cưới, ảnh bìa, QR code
└── music/                  # Nhạc nền
```

## Bản đồ file khi cần sửa nhanh

| Muốn sửa | File nên mở trước | Ghi chú |
|----------|-------------------|---------|
| Thông tin khách, ngày cưới, màu, ảnh, nhạc | `js/config.js` hoặc Firestore `weddings/{weddingId}` | Đây là nơi sửa nhiều nhất |
| Load config Firebase theo `?wedding=` | `js/services/weddingData.js` | Có merge config local + Firebase |
| Màu chủ đạo, concept, ảnh nền concept | `js/utils/theme.js` | Chỉ xử lý biến CSS và class `concept-*` |
| Header/menu/bìa/poster | `js/render/cover.js`, `js/features/cover.js` | Render nằm trong `render`, tương tác nằm trong `features` |
| Save date, title/subtitle section | `js/render/sections.js` | Text lấy từ `sections` và `sectionSubtitles` |
| About/cô dâu chú rể | `js/render/about.js`, `css/parts/concept-*.css` | Layout concept nằm trong CSS concept |
| Timeline/lịch trình/chỉ đường | `js/render/timeline.js` | Dữ liệu lấy từ `ceremony` |
| Gallery | `js/render/gallery.js`, `css/parts/sections.css`, `css/parts/concept-4-mehappy.css` | Concept 4 đang cố định 7 ảnh |
| Lời chúc/xác nhận tham dự | `js/features/wish.js`, `js/render/wish.js` | Dữ liệu lưu trong `weddings/{weddingId}/wishes` |
| Hộp quà/QR | `js/render/gift.js`, `js/features/gift.js` | QR lấy từ `gift.groom` và `gift.bride` |
| Animation khi cuộn | `js/features/scrollReveal.js`, `css/parts/animations.css` | Thêm selector reveal ở `SECTION_REVEAL_SELECTORS` |
| CSS dùng chung | `css/parts/base.css`, `css/parts/sections.css` | Tránh sửa concept nếu muốn áp dụng cho tất cả |
| CSS riêng từng concept | `css/parts/concept-1-classic.css` ... `concept-4-mehappy.css` | Sửa riêng giao diện từng concept |

Quy ước dễ nhớ: file trong `js/render/` chỉ dựng HTML từ config, file trong `js/features/` xử lý hành động của người dùng, file trong `css/parts/concept-*` chỉ nên chứa giao diện riêng của từng concept.

## Chỉnh sửa nội dung

Mở `js/config.js`. Đây là file cần sửa nhiều nhất khi làm thiệp cho khách.

| Trường | Mô tả |
|--------|-------|
| `weddingId` | Mã riêng của từng thiệp, dùng để tách dữ liệu Firebase |
| `date` | Ngày cưới, dạng `YYYY-MM-DD` |
| `location` | Địa điểm hiển thị ở poster đầu thiệp |
| `music` | Đường dẫn file nhạc nền |
| `theme.primaryColor` | Màu chủ đạo dùng chung toàn thiệp |
| `header.logo` | Chữ logo trên header, ví dụ `C & C` |
| `cover` / `poster` | Nội dung bìa thiệp và ảnh poster |
| `groom` / `bride` | Thông tin chú rể/cô dâu |
| `sections` | Tiêu đề và nội dung chữ từng section |
| `wish` | Nội dung form lời chúc, xác nhận tham dự |
| `ceremony` | Lịch trình, địa chỉ và link chỉ đường |
| `gallery` | Album ảnh cưới |
| `gift` | QR và thông tin tài khoản mừng cưới |

## Đổi màu chủ đạo

Sửa một chỗ trong `js/config.js`:

```js
theme: {
    primaryColor: "#8fb8a8"
}
```

Các nút, icon, divider, timeline, gallery, gift box... sẽ tự lấy màu này.

## Đổi ngày cưới

Sửa:

```js
date: "2026-09-12"
```

Ngày này được dùng cho poster, lịch, countdown và phần lễ chính trong timeline.

Lưu ý: thời gian bữa cơm thân mật hiện đang cấu hình riêng trong `ceremony.bride.meal.time` và `ceremony.groom.meal.time`, ví dụ:

```js
meal: {
    title: "BỮA CƠM THÂN MẬT",
    time: "17:00 • 11.09.2026"
}
```

## Đổi lịch trình và chỉ đường

Trong `ceremony`, mỗi bên có:

```js
address: "Nhà gái - Thôn ABC, Xã DEF, Hải Phòng",
mapUrl: "https://maps.app.goo.gl/..."
```

- `address`: địa chỉ hiển thị trên thiệp.
- `mapUrl`: link Google Maps, bấm nút "Chỉ đường" sẽ mở link này.

## Đổi gallery ảnh

Sửa trong `gallery.photos`:

```js
gallery: {
    intro: {
        eyebrow: "WELCOME TO OUR",
        script: "love",
        title: "STORY",
        sideText: "SAVE THE DATE"
    },
    photos: [
        { src: "img/anh_1.jpg", alt: "Ảnh cưới 1" },
        { src: "img/anh_2.jpg", alt: "Ảnh cưới 2" },
        { src: "img/anh_3.jpeg", alt: "Ảnh cưới 3" }
    ]
}
```

Gallery tự đổi bố cục theo số lượng ảnh:

| Số ảnh | Bố cục |
|--------|--------|
| 1-5 ảnh | Layout rút gọn, không để trống nhiều |
| 6-7 ảnh | Layout poster vừa |
| 8-9 ảnh | Layout poster đầy đủ |
| 10+ ảnh | Layout album/grid, hiển thị toàn bộ ảnh |

Chỉ cần thêm/bớt dòng trong `photos`, không cần sửa JS/CSS.

## Đổi QR mừng cưới

Sửa trong `gift`:

```js
gift: {
    groom: {
        qr: "img/qr_groom.jpeg",
        bank: "Vietcombank",
        accountName: "NGUYỄN VĂN A",
        accountNumber: "0123456789"
    },
    bride: {
        qr: "img/qr_bride.jpg",
        bank: "Techcombank",
        accountName: "TRẦN THỊ B",
        accountNumber: "9876543210"
    }
}
```

Đảm bảo file QR thật nằm trong thư mục `img/` và đường dẫn `qr` viết đúng tên file.

## Chạy local

Nên chạy qua HTTP server. Không nên mở trực tiếp bằng `file://`, vì ES modules và một số tính năng trình duyệt có thể lỗi.

```bash
# Python
python3 -m http.server 8080

# hoặc Node.js
npx serve .
```

Mở:

```txt
http://localhost:8080
```


## Trang admin online có đăng nhập

Trang admin online nằm ở thư mục `admin/`. Sau khi deploy lên GitHub Pages hoặc Cloudflare Pages, đường dẫn sẽ là:

```txt
https://ten-domain-cua-ban/admin/
```

Tài khoản và mật khẩu không lưu trong code. Chúng được Firebase Authentication quản lý.

Cách thiết lập lần đầu:

1. Vào Firebase Console.
2. Mở `Authentication`.
3. Chọn `Sign-in method`.
4. Bật `Email/Password`.
5. Vào tab `Users`, tạo tài khoản admin cho bạn.
6. Vào `Authentication > Settings > Authorized domains`, thêm domain deploy nếu cần, ví dụ `bryannguyen01itb.github.io` hoặc domain Cloudflare Pages.
7. Vào Firestore Rules và giới hạn quyền sửa config cho email admin.

Rules gợi ý:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == "email-cua-ban@gmail.com";
    }

    match /weddings/{weddingId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();

      match /wishes/{wishId} {
        allow read, create: if true;
        allow update, delete: if isAdmin();
      }
    }
  }
}
```

Nếu muốn thêm lớp kiểm tra ngay trên giao diện admin, mở `admin/admin.js` và thêm email vào `ADMIN_EMAILS`. Lưu ý: đây chỉ là lớp kiểm tra giao diện, bảo mật thật vẫn là Firestore Rules.

## Deploy

Có thể upload toàn bộ thư mục lên hosting tĩnh như Cloudflare Pages, GitHub Pages, Netlify, Vercel hoặc Firebase Hosting.

Sau khi deploy, nên kiểm tra trên:

- iPhone/Safari
- Android/Chrome
- màn nhỏ khoảng 360px
- màn phổ biến 390-430px

## Firebase config và lời chúc

Cấu hình Firebase nằm trong `js/firebase.js`.

Mỗi thiệp cần có một `weddingId` riêng. Quy ước đặt `weddingId`:

- viết chữ thường
- không dấu
- không khoảng trắng
- dùng dấu `-`
- không trùng với thiệp khác

Ví dụ:

```txt
nam-linh-2026
cuong-chi-2026
minh-anh-hp-2026
```

### Cấu trúc Firestore

Dùng một collection chung:

```txt
weddings
```

Mỗi khách là một document:

```txt
weddings/{weddingId}
```

Ví dụ:

```txt
weddings/nam-linh-2026
weddings/cuong-chi-2026
```

Document `weddings/{weddingId}` chứa toàn bộ config thiệp, ví dụ các field:

```js
{
  weddingId: "nam-linh-2026",
  date: "2026-09-12",
  location: "HẢI PHÒNG, VIỆT NAM",
  music: "music/1_doi.mp3",
  theme: { primaryColor: "#8fb8a8" },
  header: { logo: "N & L" },
  cover: { headline: "TRÂN TRỌNG KÍNH MỜI" },
  poster: { image: "img/anh_1.jpg" },
  groom: { ... },
  bride: { ... },
  sections: { ... },
  wish: { ... },
  ceremony: { ... },
  gallery: { ... },
  gift: { ... }
}
```

Lời chúc được lưu trong subcollection riêng của từng thiệp:

```txt
weddings/{weddingId}/wishes/{wishId}
```

Nhờ vậy nhiều thiệp dùng chung một Firebase project vẫn không bị lẫn lời chúc.

### Link Cloudflare

Một Cloudflare Pages project có thể dùng cho nhiều thiệp bằng query `?wedding=`:

```txt
https://your-project.pages.dev/?wedding=nam-linh-2026
https://your-project.pages.dev/?wedding=cuong-chi-2026
```

Khi không có `?wedding=...`, hoặc Firebase không tìm thấy document, app sẽ dùng config fallback trong `js/config.js`.

### Firestore rules mẫu

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /weddings/{weddingId} {
      allow read: if true;

      match /wishes/{wishId} {
        allow read: if true;
        allow create: if true;
      }
    }
  }
}
```

Rules trên cho phép mọi người đọc config/lời chúc và gửi lời chúc. Việc tạo/sửa config nên làm trong Firebase Console hoặc admin nội bộ của bạn, không public form sửa config cho khách khi chưa có đăng nhập/phân quyền.

### Upload config lên Firebase bằng script

Không nên nhập tay toàn bộ config trong Firebase Console vì rất lâu và dễ sai. Dự án có script để upload trực tiếp `js/config.js` lên Firestore.

Cài dependency một lần:

```bash
npm install
```

Tạo service account key:

1. Vào Firebase Console.
2. Project settings.
3. Service accounts.
4. Generate new private key.
5. Tải file JSON về.
6. Đổi tên thành `serviceAccountKey.json`.
7. Đặt vào thư mục `scripts/`.

Đường dẫn sẽ là:

```txt
scripts/serviceAccountKey.json
```

File này đã được ignore trong `.gitignore`, không được commit lên GitHub.

Sau đó sửa `js/config.js`, đảm bảo có `weddingId` đúng:

```js
weddingId: "nam-linh-2026"
```

Chạy lệnh upload:

```bash
npm run upload:config
```

Script sẽ ghi config vào:

```txt
weddings/{weddingId}
```

Ví dụ:

```txt
weddings/nam-linh-2026
```

Mặc định script sẽ ghi đè document config để Firebase khớp với `js/config.js`. Nếu muốn merge với dữ liệu cũ, chạy:

```bash
npm run upload:config -- --merge
```

Nếu muốn dùng file config khác:

```bash
npm run upload:config -- --config=js/config.js
```

Sau khi upload, mở link Cloudflare:

```txt
https://your-project.pages.dev/?wedding=nam-linh-2026
```

## Lưu ý tương thích

Dự án dùng ES modules:

```html
<script type="module" src="js/app.js"></script>
```

Vì vậy thiệp phù hợp với trình duyệt điện thoại hiện đại. Các máy quá cũ như iPhone 5/Safari cũ có thể không chạy đầy đủ JS, dẫn tới thiếu ảnh/text hoặc không mở được thiệp.

Nếu cần hỗ trợ thiết bị rất cũ, nên cân nhắc thêm bước build bằng Vite/Babel và polyfill. Nếu không bắt buộc, nên giữ trải nghiệm hiện tại để thiệp đẹp và mượt trên thiết bị phổ biến.

## Luồng hoạt động

```txt
Bìa thiệp → Click mở → Poster + nhạc nền
         → Scroll → Các section hiện dần
         → Lời chúc → Firebase Firestore
         → Hộp mừng cưới → Modal QR
```
