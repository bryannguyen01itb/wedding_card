# CSS structure

## Entry (`style.css`)

```txt
parts/base.css
parts/cover.css
parts/sections.css
parts/countdown-thanks.css
parts/animations.css
parts/concept-1-classic.css   # wish / gift / thanks cố định
parts/gift-polish.css
parts/block-builder.css       # font classes + shared fixes
blocks/index.css              # mọi section skin
```

## Module skins (sửa theo section)

Mỗi section một file — concept 1–4 nằm chung trong file đó:

| Module | File |
| --- | --- |
| cover | `blocks/cover/skins.css` |
| poster | `blocks/poster/skins.css` |
| save-date | `blocks/save-date/skins.css` |
| about | `blocks/about/skins.css` |
| timeline | `blocks/timeline/skins.css` |
| gallery | `blocks/gallery/skins.css` |
| countdown | `blocks/countdown/skins.css` |
| divider | `blocks/divider/skins.css` |
| gift / wish / thanks | `blocks/<name>/skins.css` (override; base = concept-1-classic) |
| nền / title chung | `blocks/theme-unifier.css` |

Import order: `blocks/index.css`.

## Class JS gắn

- `body.block-<section>-concept-N`
- `.section.block-skin-concept-N`

## Đã migrate

- `parts/block-concepts.css` → tách vào `blocks/*/skins.css` (xong).
- `parts/concept-2/3/4-*.css` → đã gỡ (không import).
