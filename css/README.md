# CSS structure

CSS hiện được chia thành 2 lớp chính:

1. `parts/` chứa style nền, style concept 1 cố định và một số file legacy cần giữ để tương thích.
2. `blocks/` chứa CSS chính cho block builder. Khi sửa layout từng block, ưu tiên sửa trong thư mục này.

JS module ownership nằm ở `js/modules/<section>/`. CSS ownership:

```txt
css/blocks/<section>/skins.css   ← rule skin mới của section đó
css/blocks/index.css             ← import tất cả module
css/parts/block-concepts.css     ← legacy (poster/gallery/… cũ)
```

Thêm skin mới: chỉ sửa `css/blocks/<section>/skins.css` của section cần, không đụng module khác.

Thứ tự import nằm trong `style.css`:

```txt
parts/base.css
parts/cover.css
parts/sections.css
parts/countdown-thanks.css
parts/animations.css
parts/concept-1-classic.css      base cố định cho wish/gift/thanks
parts/gift-polish.css
parts/block-concepts.css         lớp chuyển tiếp từ concept cũ sang block
parts/block-builder.css          font classes + shared block fixes
blocks/index.css                 CSS block đang được bảo trì chính
```

Khi cần sửa block, ưu tiên các file này:

| Block | File |
| --- | --- |
| Cover | `blocks/cover-blocks.css` |
| About | `blocks/about-blocks.css` |
| Timeline | `blocks/timeline-blocks.css` |
| Countdown | `blocks/countdown-blocks.css` |
| Tiêu đề, subtitle, nền chung | `blocks/theme-unifier.css` |

Ghi chú quan trọng:

- `theme.concept` không còn dùng nữa.
- Các section khách chọn sẽ lấy giao diện từ `theme.blocks`.
- `wish`, `gift`, `thanks` dùng style cố định theo concept 1 để tổng thể không bị lẫn màu/lẫn bố cục.
- `theme.concepts` vẫn còn cần để lưu media riêng cho từng block concept, ví dụ ảnh cover và ảnh countdown của concept 1-4.
- Tránh sửa `parts/block-concepts.css` nếu không có nhu cầu migrate CSS cũ, vì file này đang là lớp tương thích cho các block đã tách.
