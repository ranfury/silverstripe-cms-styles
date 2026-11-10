# Style guide: rewriting a module's styles

How to style a module this one blocks (or restyle one that changed upstream, MAINTENANCE.md), so it comes out looking
like the rest of the CMS here, and keeps working as the module changes.

The short version: **the module's own css is the map, not the paint.** Read it to learn what it draws, which states
it has, and what its layout needs to work. Then draw it again from this module's tokens, scales and pieces.

## 1. Read the module first

Before writing anything, from the module's repository (`.upstream/repos/…`, or its GitHub):

- **Its source styles** (`client/src/styles`, `css/`, `scss/`): every element and state it styles. This is the
  checklist: each selector in it is something that's drawn with nothing once its css is blocked
- **Its templates and components**: the markup, and the classes added in code (`addExtraClass`, `className`,
  `classnames()`), states included (`--is-open`, `.active`, `.disabled`)
- **Its scripts**: what they measure, hide or position. A script that reads an element's height, toggles
  `display`, or positions a popover by the element's box depends on css that has to stay

Sort what its css does into two piles:

| Keep (it makes the module work) | Replace (it's how the module looks) |
| --- | --- |
| `display`, `position`, `overflow` a script relies on | Colours, backgrounds, borders, shadows |
| Sizes a script reads or sets (a panel width, a crop area) | Font sizes, weights, letter spacing |
| Hiding (`display: none`, `visibility`) a script toggles | Padding, margins, gaps |
| Stacking a popover / drag preview needs (`z-index`) | Radii, transitions, icons |
| `cursor`, `pointer-events`, `user-select` while dragging | Its own buttons, badges, dropdowns |

Write the first pile again (with this module's values where it has one: `$z-dropdown`, not `1000`). Redraw the second
from scratch by the rules below. Don't copy the module's css in and edit it: its colours and sizes come with it.

## 2. Where it goes

- `client/source/styles/modules/<vendor>/<package>.scss` (or a folder with an `index.scss` when it's big:
  `silverstripe/asset-admin`). The build finds it, the module's `bundle.css` is then blocked, and the file loads only
  when the module is installed
- A stylesheet that isn't `client/dist/styles/bundle.css` goes in `blocked_stylesheets` (`_config/config.yml`)
- Then add the module to `maintenance/upstream.json` (MAINTENANCE.md)
- Something two modules share (the paginator, react-select) belongs in `cms.css` (`components`, `forms`), or a mixin
  in `abstracts/mixins.scss`, not in one module's file

Every file starts with `@use 'cms/abstracts' as *;` and a header saying what the module is and where it's drawn:

```scss
// ===============================
// Blocks (dnadesign/silverstripe-elemental)
// ===============================

// Its bundle.css is blocked, and everything it drew is here: the block list, each block's row, ... Its buttons,
// badges and dropdowns are the CMS's own (cms.css). Its bundle painted the list white whatever the theme
```

Say what the module did that was dropped on purpose (as above), so it isn't added back at the next restyle.

## 3. The rules

### Colour: tokens only

Every colour is a `var(--cms-…)` from `base/tokens.scss`, so the module follows the theme hue and light / dark mode.
There are no hex, `rgb()` or named colours in a module's file (the only literals are in `tokens.scss`).

| For | Use |
| --- | --- |
| Page / panel / card / raised surface | `--cms-bg`, `--cms-surface`, `--cms-surface-raised`; recessed areas `--cms-sunken` |
| Text | `--cms-text`; secondary `--cms-text-muted`; placeholders, meta `--cms-text-faint` |
| Lines between things | `--cms-border` (`--cms-border-strong` for a hover) |
| The edge of a field / check box | `--cms-control-border` (3:1, WCAG 1.4.11) |
| Hover / pressed rows and tiles | `--cms-hover`, `--cms-active` |
| Chosen / current | `--cms-accent-soft` background, `--cms-link` text, a ring in `--cms-accent` |
| Text on the accent | `--cms-on-accent` (black or white, by contrast) |
| Links | `--cms-link` |
| Focus | `@include focus-ring` (or `control-focus` on a field) |
| Status | `--cms-success` / `-warning` / `-danger` / `-info`, each with a `-soft` background |

A shade that isn't a token is mixed from tokens: `color-mix(in srgb, var(--cms-surface), var(--cms-text) 4%)`. If
the same mix is needed in a second place, it becomes a token.

Don't use `opacity` to make text quieter (it fails contrast): use `--cms-text-muted`.

### Size: scales only

- Spacing (padding, margins, gaps): `$space-3xs` to `$space-6xl`. One-off nudges in px (`top: 1px`) and the room kept
  for an icon are measurements, not spacing, and stay as they are
- Text: `$text-xs` (the smallest) to `$text-2xl`. An icon glyph's size is its own
- Weights: `$regular`, `$medium`, `$semibold`, `$bold`
- Capitals: `text-transform: uppercase`, `$text-xs`, `$semibold`, `letter-spacing: $caps-tracking`
- Radii: `--cms-radius-xs` to `--cms-radius-lg`, `--cms-radius-pill`. Fields, cards, buttons, tiles take
  `--cms-radius`; things inside them `--cms-radius-sm`
- Shadows: `--cms-shadow-sm` (cards, fields), `--cms-shadow` (floating), `--cms-shadow-lg` (dialogs)
- Layers: `$z-…` from `abstracts/variables.scss`
- Motion: `$fast` / `$normal` with `ease` or `$ease`. Reduced motion is handled once, at the root
- Breakpoints: `@include media($md)` (min-width), `@include media($md, max)`. The CMS's mobile menu is below `$md`

### Pieces: reuse, don't redraw

Before drawing anything, check whether it's one of these:

| It's a… | Use |
| --- | --- |
| Button | `.btn` (the CMS's), set its variables: `--btn-bg`, `--btn-border`, `--btn-color`, `--btn-hover-bg`, `--btn-shadow`, `--btn-height`... `@include button-accent` for the main action. `@include button-reset` for a bare clickable thing |
| Field, select, picker | `@include control` (+ `control-hover`, `control-focus`) |
| Check box drawn from a span | `@include check-box`, `check-box-checked(tick or dash)` |
| React select (any class prefix) | `@include react-select('prefix')` (the whole of `tagfield.scss`) |
| Dropdown, popover, menu | `@include floating`, rows `@include menu-item` |
| A list | `@include list-reset` |
| An icon | `@include lucide('name')` (Lucide, by name), or the icon font `@include icon('name')` if the CMS uses that glyph elsewhere |
| A chevron | `@include chevron` |
| Scrolling area | `@include scrollbars`; a row that scrolls sideways `scroll-fade` |
| Hidden but read out | `@include visually-hidden` |

The module's own Bootstrap buttons, badges and dropdowns are already drawn by `cms.css`: leave them to it and style
only what's the module's own. If a piece is needed that isn't here, and a second module would want it, add a mixin.

### The look, in short

What the CMS looks like here, so a module matches without looking anything up:

- Flat surfaces with a thin border (`--cms-border`), `--cms-radius`, at most `--cms-shadow-sm`. No gradients, no gloss
- A list of things is a card (`--cms-surface`, border, radius) with rows split by `--cms-border` lines; rows tighter
  than the module's own
- The current / chosen thing: `--cms-accent-soft` with `--cms-link` text, or a 1px `--cms-accent` ring. Not a solid
  accent fill, that's for the main button
- Empty states centred, in `--cms-text-muted`
- Labels and column headings in capitals (above), everything else sentence case
- Icons outlined (Lucide), in `currentColor`

### Selectors and specificity

The module's css is blocked, so there's nothing to override: **write the plainest selector that matches**, the
module's own class, at one class where possible.

- Style the module's **own classes**, the ones its templates and components write, not their position in the DOM
  (`.link-picker__link`, not `.link-field > div > div`). Those are what the upstream check follows; structure isn't
- Nest only what's really inside (`&--is-first`, `&:hover`, `input:checked + label`), BEM modifiers with `&`
- Where a module's markup has classes that aren't its own (Bootstrap's `mb-3`), and they're in the way, scope to the
  module: `.elemental-editor__element .mb-3`
- When the global form styles are more specific than a module's element (a bare input inside a react-select), match
  them on the element (`input.prefix__input`) or double the class (`.prefix__control.prefix__control`), and say why
  in a comment
- `!important` only when what's being beaten can't be reached otherwise: an inline style written by a script, or a
  stylesheet that isn't blocked (`toastnz/blocks-layouts` has no bundle to block, so its styles are added on top of
  the module's own). Comment each one with what it beats

### States

Every state the module has gets a look, from the module's css and its components: hover, focus-visible (always a
visible ring), active / pressed, chosen, disabled (`--cms-sunken`, `--cms-text-muted`, `cursor: not-allowed`), loading,
empty, error (`--cms-danger`, `-soft`), dragging. A state the module's css styled that's missing here is a regression.

### Comments

Say **why**, not what: what a value is matched to, what a script needs, what the module did that was dropped, what
was measured (`// Tighter than a card: rows were 83px, so a page of 23 blocks ran to two screens`). Date a
measurement. A section of the file starts with the `// ====` heading.

## 4. Check it

- Every selector of the module's source css is drawn here, or dropped on purpose (and said so in the header)
- Light and dark, a few theme hues (a pale one: the text on the accent must stay readable), wide and narrow (< 768px)
- Keyboard: tab through it, the focus ring shows on everything
- Every state (above), and long content: a long title, many items, no items
- Nothing in it other than tokens, scales and mixins (no hex, no px font sizes, no raw `z-index`)
- `npm run build`, and add / update the module in `maintenance/upstream.json`

## Where the existing styles still break these rules

Kept as they are (each has its reason); don't copy them into a new module:

- `!important` in `toastnz/colourpalettes` and `toastnz/blocks-layouts` (styles added on top of the module's own, not
  replacing them) and a few in `asset-admin`, `elemental`, `sortablefile`, `colorpicker` (inline styles / Bootstrap)
- Font sizes off the scale (`1.05rem`, `1.1rem`, `.7rem`...): nearly all icon glyphs (`::before` on `font-icon-…`,
  sort arrows, the menu's icons), whose sizes are their own, not text
- Raw `z-index` values in `layout/` and `forms/inputs.scss`, matched to the CMS's own stacking
