# Module system

Mỗi section thiệp là **một folder module** độc lập: definition + render + CSS.

## Cấu trúc

```txt
js/modules/
  core/                 # registry, skins catalog, apply classes
    registry.js
    skins.js
    apply.js
  shell/
    header.js           # menu / logo (không phải block skin)
  render-all.js         # gọi applyTheme + từng module.render
  index.js              # bootstrap + public API
  cover/
    module.js           # id, selector, builderField, skinOptions…
    render.js           # đổ nội dung DOM của cover
  poster/
  save-date/
  about/
  timeline/
  gallery/
  countdown/
  divider/
  gift/                 # buildable: false (cố định concept-1)
  wish/
  thanks/

css/blocks/
  cover/skins.css       # CSS skin của cover
  poster/skins.css
  about/skins.css
  …
  index.css             # import tất cả module CSS
```

`js/render/*` chỉ còn re-export để tương thích — **sửa logic trong `js/modules/<name>/`**.

## Thêm skin / concept mới (ví dụ concept-5)

1. `js/modules/core/skins.js` — thêm object:

```js
{
  id: "concept-5",
  label: "Concept 5",
  aliases: ["5", "floral"],
  openLabel: "Open",
  palette: "none"
}
```

2. Trong **từng** `css/blocks/<section>/skins.css` cần support, thêm:

```css
body.block-cover-concept-5 .cover,
.cover.block-skin-concept-5 { /* ... */ }
```

3. (Tuỳ chọn) `skinOptions` trong `js/modules/<section>/module.js`.

4. Builder tự hiện option — không sửa HTML.

## Thêm section module mới (ví dụ `story`)

1. Tạo folder:

```txt
js/modules/story/module.js
js/modules/story/render.js
css/blocks/story/skins.css
```

2. `module.js`:

```js
import { renderStory } from "./render.js";

export const storyModule = {
  id: "story",
  label: "Câu chuyện",
  selector: ".story",
  builderField: "blockStory",
  defaultSkin: "concept-1",
  order: 65,
  buildable: true,
  cssFile: "css/blocks/story/skins.css",
  render: renderStory
};
```

3. Thêm vào `SECTION_MODULES` trong `js/modules/index.js`.

4. Import CSS trong `css/blocks/index.css`.

5. Markup trong `index.html` + `<select name="blockStory">` ở builder.

6. (Tuỳ chọn) key `story` trong `config.js` → `theme.blocks`.

**Không cần sửa** cover/about/gallery/… nếu không phụ thuộc story.

## Class CSS tự gắn

| Nơi | Class | Ví dụ |
| --- | --- | --- |
| `body` | `block-<section>-<skin>` | `block-cover-concept-2` |
| Section root | `block-skin-<skin>` | `block-skin-concept-2` |

Config:

```js
theme.blocks = {
  cover: "concept-1",
  gallery: "concept-4"
}
```

## Module cố định (không chọn skin)

`gift`, `wish`, `thanks`: `buildable: false`, `applySkin: false` — luôn concept-1. Vẫn có folder riêng để sửa không đụng module khác.

## Legacy CSS

`css/parts/block-concepts.css` vẫn chứa skin cũ của poster / gallery / save-date / divider.  
**Rule mới** viết vào `css/blocks/<section>/skins.css`. Khi rảnh có thể migrate rule cũ sang đây từng section.

## Checklist nhanh

| Việc | Chạm file |
| --- | --- |
| Đổi layout cover concept-2 | `css/blocks/cover/skins.css` |
| Đổi text/DOM about | `js/modules/about/render.js` |
| Thêm concept-5 | `core/skins.js` + CSS từng section cần |
| Thêm section mới | folder module + `index.js` + CSS + HTML |
| Đổi hành vi gallery limit | `gallery/module.js` → `skinOptions` |
