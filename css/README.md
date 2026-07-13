# CSS structure

CSS is intentionally split into two layers:

1. `parts/` contains the original site styles and full concept styles.
2. `blocks/` contains the safer long-term overrides used by the block builder.

Import order matters and is controlled by `style.css`:

```txt
base/common parts
concept-1..4 full styles
block-concepts.css     legacy concept extraction
block-builder.css      font classes + shared block fixes
blocks/index.css       final maintained block CSS
```

When fixing a block, prefer these files first:

| Block | File |
| --- | --- |
| Cover | `blocks/cover-blocks.css` |
| About | `blocks/about-blocks.css` |
| Timeline | `blocks/timeline-blocks.css` |
| Countdown | `blocks/countdown-blocks.css` |
| Shared title/background/subtitle | `blocks/theme-unifier.css` |

Avoid editing `block-concepts.css` unless you are intentionally migrating old concept CSS.
