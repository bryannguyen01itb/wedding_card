# CSS structure

## Entry

**Production:** `index.html` load phẳng từng file + `?v=` (không dùng `@import` lồng).

**Fallback:** `style.css` — 1 tầng `@import` (brand → tokens → parts → skins → unifier).

```txt
brand.css + tokens.css
parts/base, cover, sections, countdown-thanks, animations
parts/concept-1-classic.css   # wish / gift / thanks cố định
parts/gift-polish.css
parts/block-builder.css
blocks/<section>/skins.css    # cover…divider (buildable)
blocks/theme-unifier.css      # luôn cuối
```

`blocks/gift|wish|thanks/skins.css` = stub (style trong concept-1-classic) — **không** link trên HTML.

`blocks/index.css` = deprecated, không import.

## Module skins (sửa theo section)

| Module | File |
| --- | --- |
| cover…divider | `blocks/<name>/skins.css` |
| gift / wish / thanks | `parts/concept-1-classic.css` (+ gift-polish / sections) |
| nền / title chung | `blocks/theme-unifier.css` |

## Class JS gắn

- `body.block-<section>-concept-N`
- `.section.block-skin-concept-N`

## Tối ưu an toàn (không đổi giao diện)

- Không load 3 stub skins rỗng (bớt HTTP).
- `tokens.css` không `@import brand` (tránh brand 2 lần).
- Gộp selector kề nhau trùng lặp trong divider / gallery / timeline.
