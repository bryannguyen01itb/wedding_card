# Module system

Mỗi section = 1 folder: `module.js` (định nghĩa) + `render.js` (đổ DOM).

```txt
js/modules/
  core/          registry, skins, apply classes
  shell/         header menu
  render-all.js  applyTheme + gọi mọi module.render
  index.js       đăng ký SECTION_MODULES
  cover|poster|save-date|about|timeline|gallery|countdown|divider|gift|wish|thanks/
```

## Thêm skin (concept-5)

1. `core/skins.js`
2. CSS trong `css/blocks/<section>/skins.css`
3. (Tuỳ chọn) `skinOptions` trong `module.js`

## Thêm section

1. Folder `js/modules/<name>/{module.js,render.js}`
2. Thêm vào `SECTION_MODULES` trong `index.js`
3. `css/blocks/<name>/skins.css` + link trong `index.html` (cùng `?v=`)
4. Markup `index.html` + field builder nếu `buildable: true`

## Local image fallback

Xem `js/utils/mediaFallback.js`: `img/{weddingId}/{key}.jpg|jpeg|png|webp`
