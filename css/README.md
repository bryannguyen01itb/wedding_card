# CSS structure

## Entry

**Thiệp (production):** `index.html` load phẳng từng file + `?v=` (không dùng `@import` lồng).

**Builder / Admin:**

```txt
css/brand.css       # token màu
css/ui-shell.css    # button, form, title, radio, sidebar-nav (dùng chung)
builder/builder.css | admin/admin.css   # layout + feature riêng
```

**Thiệp:** chỉ load phẳng từ `index.html` (không còn `style.css` @import).

```txt
brand.css + tokens.css
parts/base, cover, sections, countdown-thanks, animations
parts/concept-1-classic.css   # wish / gift / thanks cố định
parts/gift-polish.css
parts/block-builder.css       # font body/nickname + glue mixed-block
blocks/<section>/skins.css    # cover…divider (buildable)
blocks/theme-unifier.css      # luôn cuối
```

Gift / wish / thanks **không** có `blocks/*/skins.css` — style nằm `concept-1-classic` (+ gift-polish / countdown-thanks).

## UI shell (`css/ui-shell.css`)

Sửa **1 chỗ** cho Builder + Admin:

| Token / class | Ý nghĩa |
| --- | --- |
| `--ui-primary`, `--ui-radius-*`, `--ui-btn-h`… | Spacing / màu shell |
| `.ui-btn` / `.ghost` / `.danger` / `.small` | Nút |
| `label` + `input/select/textarea` trong form | Form |
| `.ui-eyebrow` / `.eyebrow`, `.ui-title`, `.ui-hint` / `.hint` | Typography |
| `.ui-card` / `.card` / `.panel` | Card |
| `.invite-plan__*`, `.ceremony-mode__*` | Radio card |
| `.builder-step-nav__item`, `.admin-nav__item` | Sidebar tab active |

## Module skins (sửa theo section thiệp)

| Module | File |
| --- | --- |
| cover…divider | `blocks/<name>/skins.css` |
| gift / wish / thanks | `parts/concept-1-classic.css` (+ gift-polish / sections) |
| nền / title chung | `blocks/theme-unifier.css` |

## Class JS gắn (thiệp)

- `body.block-<section>-concept-N`
- `.section.block-skin-concept-N`

## Dọn dẹp đã làm

- Xóa stub rỗng `blocks/gift|wish|thanks/skins.css` và `blocks/index.css` (deprecated).
- Gỡ lớp migration `block-concepts` hỏng selector (`.cover.block-skin-concept-2.card` thiếu khoảng cách) ở cover/about/countdown/timeline.
- Bỏ block cover trùng trong `block-builder.css` (bản sau cùng thắng).
- Xóa `style.css` fallback @import (production chỉ link phẳng trong `index.html`).
