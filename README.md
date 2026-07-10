# Thiệp Cưới Online

Thiệp mời cưới dạng trang web tĩnh, tối ưu cho mobile (max 480px).

## Cấu trúc dự án

```
├── index.html              # Trang chính
├── css/
│   ├── style.css           # Import tất cả CSS
│   └── parts/              # CSS theo từng phần
│       ├── base.css        # Reset, biến, layout, nhạc
│       ├── cover.css       # Màn hình bìa thiệp
│       ├── sections.css    # Nội dung thiệp (poster, lịch, album...)
│       ├── countdown-thanks.css
│       └── animations.css  # Hiệu ứng scroll & keyframes
├── js/
│   ├── app.js              # Entry point — khởi tạo toàn bộ app
│   ├── config.js           # ★ Chỉnh sửa nội dung thiệp tại đây
│   ├── firebase.js         # Cấu hình Firebase
│   ├── utils/              # Hàm tiện ích dùng chung
│   ├── render/             # Render nội dung từ config vào DOM
│   └── features/           # Logic từng tính năng
├── img/                    # Ảnh, QR code
└── music/                  # Nhạc nền
```

## Chỉnh sửa nội dung

Mở **`js/config.js`** — tất cả thông tin thiệp nằm ở đây:

| Trường | Mô tả |
|--------|-------|
| `date` | Ngày cưới (YYYY-MM-DD) |
| `theme.primaryColor` | Màu chủ đạo |
| `groom` / `bride` | Tên, phụ huynh, avatar |
| `ceremony` | Lịch trình lễ cưới |
| `gallery` | Album ảnh |
| `gift` | Thông tin chuyển khoản |

## Chạy local

```bash
# Python
python3 -m http.server 8080

# hoặc Node.js
npx serve .
```

Mở `http://localhost:8080` — **cần chạy qua HTTP server** (ES modules không hoạt động với `file://`).

## Deploy

Upload toàn bộ thư mục lên hosting tĩnh: GitHub Pages, Netlify, Vercel, Firebase Hosting...

## Firebase (lời chúc khách mời)

Collection `wishes` trên Firestore. Cấu hình tại `js/firebase.js`.

Firestore rules mẫu:

```
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

## Luồng hoạt động

```
Bìa thiệp → Click mở → Poster + nhạc nền
         → Scroll → Các section hiện dần (scroll reveal)
         → Form lời chúc → Firebase Firestore
```
