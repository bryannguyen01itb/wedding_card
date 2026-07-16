# Wedding Card Builder

Du an thiep cuoi online dang chay theo huong 1 codebase dung cho nhieu thiep. Moi thiep duoc tach bang `weddingId`, cau hinh nam tren Firebase Firestore hoac fallback trong `js/config.js`.

Trang chinh toi uu cho mobile voi khung toi da 480px. Khach co the chon bo cuc tung block trong `builder/`, con ban dung `admin/` de sua thong tin chi tiet nhu anh, nhac, timeline, QR, gallery.

## Cac trang trong du an

| Trang | Duong dan local | Muc dich |
| --- | --- | --- |
| Thiep cuoi | `index.html?wedding=wedding-cp-4` | Link gui cho khach moi xem thiep |
| Builder | `builder/index.html` | Khach chon mau, font va block giao dien |
| Admin | `admin/index.html` | Ban dang nhap va sua config chi tiet tren Firebase |

Sau khi deploy GitHub Pages/Cloudflare Pages, duong dan se tuong tu:

```txt
https://domain-cua-ban/?wedding=wedding-cp-4
https://domain-cua-ban/builder/
https://domain-cua-ban/admin/
```

## Cau truc thu muc

```txt
├── index.html                  # Trang thiep cuoi
├── builder/                    # Trang cho khach chon block giao dien
├── admin/                      # Trang admin sua config Firebase
├── functions/                  # Cloudflare Pages Function cho link preview/meta
├── css/
│   ├── style.css               # File import CSS tong
│   ├── parts/                  # CSS nen, section, animation, concept goc
│   └── blocks/                 # CSS block theo section module
├── js/
│   ├── app.js                  # Entry point cua thiep
│   ├── config.js               # Config fallback/local
│   ├── firebase.js             # Firebase client config
│   ├── modules/                # 1 folder / section (module.js + render.js)
│   ├── services/               # Load config tu URL/Firebase/localStorage preview
│   ├── render/                 # Do config vao HTML
│   ├── features/               # Tuong tac: cover, music, wish, gift, scroll...
│   └── utils/                  # Date, DOM, theme, meta
├── img/                        # Anh fallback trong code
├── music/                      # Nhac fallback trong code
├── scripts/                    # Script upload config len Firebase
└── README.md
```

Xem `js/modules/README.md` de biet cach them section/skin moi ma khong dam vao module khac.

## Luong hoat dong

```txt
Mo link thiep
  -> doc ?wedding=<id>
  -> tai config tu Firestore weddings/{weddingId}
  -> neu preview builder thi doc localStorage
  -> render noi dung
  -> apply theme.blocks de gan CSS tung block
  -> click cover de vao invitation
  -> loi chuc luu vao weddings/{weddingId}/wishes
```

Neu khong co `?wedding=...`, trang se dung fallback trong `js/config.js`.

## Firebase / Firestore

Du an dung 1 collection chung:

```txt
weddings/{weddingId}
weddings/{weddingId}/wishes/{wishId}
```

Moi khach la 1 document rieng trong `weddings`. Vi du:

```txt
weddings/hung-hang-2026
weddings/nam-linh-2026
weddings/wedding-cp-4
```

Link thiep:

```txt
https://domain-cua-ban/?wedding=hung-hang-2026
```

### weddingId

Builder tao `weddingId` tu ten thuong goi chu re, co dau va nam:

```txt
hung-hang-2026
```

Ten nay chi dung de tao id. Nickname hien thi tren thiep van nam trong config chi tiet do admin sua.

## Config quan trong

File fallback nam tai `js/config.js`. Khi Firebase co document, du lieu Firebase se duoc merge voi fallback nay.

Cac nhom config hay sua:

| Nhom | Y nghia |
| --- | --- |
| `weddingId` | Ma rieng cua thiep |
| `date` | Ngay cuoi dang `YYYY-MM-DD` |
| `ceremony.groom.location` / `ceremony.bride.location` | Tinh/TP poster (hien "CO DAU · CHU RE", 1 link thiep) |
| `music` | Link nhac local/GitHub Release/Cloudinary |
| `preview.image` | Anh preview khi gui link |
| `theme.primaryColor` | Mau chu dao |
| `theme.blocks` | Block giao dien tung section |
| `theme.fonts` | Font tong quat va font ten rieng |
| `theme.concepts[*].images` | Anh rieng cho cover/countdown theo concept |
| `groom`, `bride` | Thong tin co dau chu re |
| `aboutCard` | Anh/text phan about concept 1/4 |
| `sections` | Tieu de section |
| `sectionSubtitles` | Mo ta nho duoi tieu de |
| `ceremony` | Timeline, dia chi, link chi duong |
| `gallery.photos` | 7 anh album chinh |
| `gift` | QR va thong tin ngan hang |

## Builder cho khach

Trang `builder/` chi cho khach chon nhung thu co ban:

- ten thuong goi de tao `weddingId`
- ngay cuoi
- mau chu dao
- block giao dien cho cover, poster, save date, about, timeline, gallery, countdown, divider
- font tong quat
- font ten rieng

Builder luu len Firebase theo dang merge:

```js
{
  weddingId: "hung-hang-2026",
  date: "2026-09-12",
  theme: {
    concept: "concept-1",
    primaryColor: "#c9974f",
    blocks: {
      cover: "concept-4",
      poster: "concept-2",
      saveDate: "concept-1",
      about: "concept-3",
      timeline: "concept-4",
      gallery: "concept-2",
      countdown: "concept-1",
      divider: "concept-4"
    },
    fonts: {
      body: "quicksand",
      nickname: "great-vibes"
    }
  }
}
```

Nhung thong tin chi tiet con lai admin se sua sau.

## Thanh toan tu dong (SePay)

Webhook SePay mo khoa thiep khi CK dung ma GD + so tien (goi FREE 50 GD/thang).

Xem huong dan day du: **`SEPAY.md`**.

Tom tat:

1. Deploy Cloudflare Pages + env `FIREBASE_SERVICE_ACCOUNT_JSON`, `SEPAY_API_KEY`
2. Tao webhook SePay: `https://domain/api/sepay-webhook`
3. Publish `firestore.rules`
4. Admin van unlock tay duoc (fallback)

## Admin

Trang `admin/` dung Firebase Authentication. Tai khoan mat khau khong nam trong code.

Thiet lap lan dau:

1. Vao Firebase Console.
2. Mo `Authentication`.
3. Bat `Email/Password`.
4. Tao user admin trong tab `Users`.
5. Them domain deploy vao `Authentication > Settings > Authorized domains` neu can.
6. Deploy Firestore Rules (bat buoc) — file `firestore.rules` trong repo:

```bash
firebase deploy --only firestore:rules
```

Hoac Console > Firestore > Rules > dan noi dung `firestore.rules` > Publish.

Rules moi **giu luong**: builder luu nhap (khong login), admin mo khoa (Auth), khach xem + wish.  
Chi tiet bao mat: xem **`SECURITY.md`**.

`ADMIN_EMAILS` trong `admin/admin.js` chi la lop chan giao dien. Bao mat that nam o Firestore Rules + Auth.

## Upload config bang script

Dung khi muon day nhanh `js/config.js` len Firebase.

Cai dependency:

```bash
npm install
```

Tao service account key:

1. Firebase Console -> Project settings.
2. Service accounts.
3. Generate new private key.
4. Doi ten file thanh `serviceAccountKey.json`.
5. Dat vao `scripts/serviceAccountKey.json`.

File nay da nam trong `.gitignore`, khong commit len GitHub.

Upload:

```bash
npm run upload:config
```

Upload dang merge:

```bash
npm run upload:config -- --merge
```

Dung file config khac:

```bash
npm run upload:config -- --config=js/config.js
```

## Anh va nhac

Code hien tai chap nhan ca 3 kieu duong dan:

```txt
img/anh_1.jpg
music/1_doi.mp3
https://res.cloudinary.com/.../image/upload/...
https://res.cloudinary.com/.../video/upload/...mp3
https://github.com/.../releases/download/.../file.mp3
```

Khuyen nghi lau dai:

- Anh: Cloudinary de toi uu hien thi nhanh hon.
- Nhac: Cloudinary hoac GitHub Release deu duoc; neu GitHub Release tren mobile bi yeu cau tai ve thi chuyen sang Cloudinary.
- Link preview nen dung anh ngang ti le gan 1200x630.

## Link preview

Anh va title khi gui Zalo/Facebook/Telegram lay tu:

- `preview.image`
- nickname co dau/chu re trong config
- Cloudflare Pages Function trong `functions/[[path]].js`

Neu doi anh preview cho tung thiep, sua `preview.image` trong config/Firebase.

## CSS va block concept

Thu tu CSS: `index.html` link phẳng (brand → tokens → parts → skins → unifier). Fallback: `css/style.css` (1 tầng @import). Skin section: `css/blocks/*/skins.css`.

Quy uoc sua CSS:

| Muon sua | File nen sua |
| --- | --- |
| Cover | `css/blocks/cover/skins.css` |
| Poster | `css/blocks/poster/skins.css` |
| Save the date | `css/blocks/save-date/skins.css` |
| About | `css/blocks/about/skins.css` |
| Timeline | `css/blocks/timeline/skins.css` |
| Gallery | `css/blocks/gallery/skins.css` |
| Countdown | `css/blocks/countdown/skins.css` |
| Divider | `css/blocks/divider/skins.css` |
| Nen / title chung | `css/blocks/theme-unifier.css` |

Sua skin theo section tai `css/blocks/<section>/skins.css`. Font / fix chung: `css/parts/block-builder.css`. Xem `css/README.md`.

## Gallery

Hien tai gallery chot theo huong 7 anh cho cac concept. Sua anh trong:

```js
gallery: {
  photos: [
    { src: "img/anh_3.jpeg", alt: "Ảnh cưới 1" },
    { src: "img/anh_4.jpeg", alt: "Ảnh cưới 2" }
  ]
}
```

Admin cung chi tao 7 o anh theo `GALLERY_SIZE = 7` trong `admin/admin.js`.

## Chay local

Nen chay qua HTTP server, khong mo truc tiep `file://` neu can test Firebase/module on dinh.

```bash
python3 -m http.server 8080
```

Mo:

```txt
http://localhost:8080/
http://localhost:8080/builder/
http://localhost:8080/admin/
```

## Deploy

Co the deploy len Cloudflare Pages, GitHub Pages, Netlify, Vercel hoac Firebase Hosting.

Sau khi deploy nen test:

- Chrome desktop
- Safari iPhone that
- Android Chrome
- man hinh 360px, 390px, 430px
- gui link qua Zalo/Telegram/Facebook/Messenger

## Kiem tra nhanh truoc khi deploy

```bash
npm run check:js
```

Neu sua CSS block, nen mo builder va test tung block concept 1-4 it nhat 1 lan.

## Luu y thiet bi cu

Du an dung ES modules va Firebase compat SDK. May qua cu nhu iPhone 5/Safari cu co the khong ho tro day du. Neu can ho tro may rat cu, nen them buoc build bang Vite/Babel va polyfill. Neu khong bat buoc, nen giu hien tai de thiep dep va nhe hon tren may pho bien.
