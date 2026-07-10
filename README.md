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

## Chỉnh sửa nội dung

Mở `js/config.js`. Đây là file cần sửa nhiều nhất khi làm thiệp cho khách.

| Trường | Mô tả |
|--------|-------|
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

## Deploy

Có thể upload toàn bộ thư mục lên hosting tĩnh như Cloudflare Pages, GitHub Pages, Netlify, Vercel hoặc Firebase Hosting.

Sau khi deploy, nên kiểm tra trên:

- iPhone/Safari
- Android/Chrome
- màn nhỏ khoảng 360px
- màn phổ biến 390-430px

## Firebase lời chúc

Lời chúc lưu vào collection `wishes` trên Firestore. Cấu hình Firebase nằm trong `js/firebase.js`.

Firestore rules mẫu:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wishes/{id} {
      allow read: if true;
      allow create: if true;
    }
  }
}
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
