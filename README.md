# Silverstripe CMS Styles

A fresh, modern style for the Silverstripe CMS (it replaces styles loaded by cms modules).

The CMS's own stylesheets, and those of the modules that add to it, are **blocked** (`Requirements::block`) and the CMS
is styled from scratch, so nothing is overridden. The CMS's javascript is untouched: only the styles are replaced.

## Requirements

- PHP 8.3+, Silverstripe framework 6 and `silverstripe/admin` 3
- A recent browser: the styles use `light-dark()`, `color-mix()`, `:has()` and container queries. Customisable selects
  (`appearance: base-select`) are used where the browser supports them, and fall back to a styled native select

The CMS is meant to be used in a current Chrome, Edge, Firefox or Safari. An older browser still gets a working CMS,
but colours, light / dark mode and some layout fall back to the browser's defaults where it doesn't know these
features.

## Installation

```sh
composer require ranfury/silverstripe-cms-styles
```

Then flush (`?flush=1`). The built files are in the package (`client/dist`), the project doesn't build anything.

## How it works

- `LeftAndMainExtension` blocks the stylesheets listed under `blocked_stylesheets` (and the `bundle.css` of every module that
  has styles here), then loads this module's in their place: `cms.css`, then one stylesheet for each module that is installed
- The stylesheets load without holding the page up. The critical styles (`critical.css`, inlined in the `<head>`) draw the
  first thing, the themed loading screen, and the CMS isn't drawn until the rest have loaded
- The theme colour and light / dark mode are applied by a small script (`appearance-boot.js`), also inlined, before
  anything is drawn, so there's no flash of the default theme
- The menu collapses to a column of icons from the button in its footer (each section's name shows beside its icon on
  hover or focus), and stays as it was left. That's the CMS's own collapse and its own memory of it: Silverstripe only
  follows that memory with its "sticky nav" switch on (otherwise it collapses the menu itself on every screen with the
  pages tree), so the boot script turns sticky on and leaves the menu open until it's collapsed
- The dev pages (`dev/build`, `dev/tasks`, errors in dev mode) are styled to match (`dev.css`). To do it, the module
  replaces Silverstripe's `SilverStripe\Dev\DebugView` with its own through the Injector (`Ranfury\CMSStyles\Dev\DebugView`)
  and empties the task runner's own stylesheet list (`_config.php`). A project that customises the dev pages itself,
  with its own `DebugView` or task runner styles, should know that this module has already taken those over

## Colours and appearance

Colours all come from one theme colour (`--cms-theme`) with `light-dark()`. It, and light / dark / system, are set from the
appearance menu in the menu footer and remembered in the browser (the dev pages use them too). The menu picks a hue with a
slider: the theme colour's lightness and chroma are fixed (`base/tokens.scss`, matched to the pastel colours this started
with), so every hue is as bright as the others. The hue before one is picked is `theme_hue` in `_config/config.yml`.

The text on the theme colour (buttons, selections, ticks) is black or white, whichever has the more contrast on it by
WCAG's measure, so any colour picked stays readable.

The variable names the previous CMS theme module used (`--cms-accent-colour`, `--cms-border-colour`...) are kept as
aliases, other modules' styles may still read them.

## Scales

Sizes come from a few scales in `abstracts/variables.scss` and `base/tokens.scss`, rather than values written in place:

- Type: `$text-xs` (.8rem, the smallest text there is) to `$text-2xl`. Icon glyphs keep their own sizes
- Spacing: `$space-3xs` (.15rem) to `$space-6xl` (2.5rem), for padding, margins and gaps. Nudges in px and the room kept
  for an icon are measurements of their own
- Radii: `--cms-radius-xs` to `--cms-radius-lg`, and `--cms-radius-pill`
- Edges: `--cms-border` for lines between things, `--cms-control-border` (3:1) for the edge of a field or check box
- Capitals: labels in capitals take `$caps-tracking`

## Icons

The menu's icons, the page types' (tree, pages list, add page) and a few others are [Lucide](https://lucide.dev)'s
outline icons in place of the icon font's glyphs, which mix filled and outlined drawings. A section or page type whose
glyph isn't mapped (`$-menu-icons` in `layout/menu.scss`, `$-record-icons` in `base/icons.scss`) keeps its glyph.

Lucide is a dependency of the build (`lucide-static` in `package.json`): `@include lucide('mail')` reads the icon from it
when the styles are built and writes it into the css, once, as `--lucide-mail`. Nothing extra is installed with the
module. Lucide's licence (ISC) is in `licenses/lucide.txt`.

## Configuration

All on `Ranfury\CMSStyles\Extensions\LeftAndMainExtension` (`_config/config.yml`):

| Setting | What it is |
| --- | --- |
| `blocked_stylesheets` | Stylesheets of other modules to block, `'vendor/package: path'`. The CMS itself, and those that aren't a module's `client/dist/styles/bundle.css` |
| `theme_hue` | The theme colour's hue (0 to 360) until one is picked in the appearance menu. 250 by default |
| `ignored_modules` | Modules to keep the styles of: nothing is blocked or loaded for them. Empty by default |
| `module_overrides` | Styles that another package brings itself (below). Empty by default |

## Styling another module

`cms.css` is the CMS itself (the `silverstripe/admin` and `silverstripe/cms` styles). Every other module that has its styles
replaced is its own stylesheet, named after the module's composer name, so there's nothing to register:

- `client/source/styles/modules/<vendor>/<package>` (a folder with an `index.scss`, or `<package>.scss`) is that module's styles.
  It's built to `client/dist/styles/modules/<vendor>/<package>.css`, and loaded only when the module is installed.
  `silverstripe/asset-admin` (the files area and the upload field) is the biggest
- With it, the module's own `client/dist/styles/bundle.css` is blocked (if it has one: a module with no bundle, like
  `toastnz/blocks-layouts`, only gets its styles added). Its javascript is kept
- A stylesheet that isn't a `bundle.css` is added to `blocked_stylesheets`
- Styles shared by several modules (the paginator is used by both the files area and the history) belong in `cms.css`
  (`components`), not in one module's
- A package can bring its own replacement, with only config and its css, under `module_overrides`:

```yaml
Ranfury\CMSStyles\Extensions\LeftAndMainExtension:
  module_overrides:
    elemental:
      module: dnadesign/silverstripe-elemental
      blocks:
        - client/dist/styles/bundle.css
      styles: 'vendor/package: client/dist/styles/elemental.css'
```

## What's in it

- `client/source/styles/`: `cms.scss` imports each folder in order, and each folder's `_index.scss` lists its partials by hand, in
  cascade order (add new partials there):
  - `abstracts`: variables, mixins, the icon font map
  - `base`: document, colour tokens, reset, type, icons, helper classes
  - `layout`: menu, panels, headers, toolbars, preview
  - `components`: buttons, tabs, menus, modals, toasts, tree, search box, pagination, loading...
  - `forms`: field layout and every field type
  - `sections`: grid fields, pages, security...
  - `modules`: one stylesheet for each module styled (above)
  - `critical.scss` and `dev.scss` are their own stylesheets (the critical styles, and the dev pages)
- `client/source/scripts/`: the appearance menu, menu icons, character counts, range sliders, code fields, tab memory (the
  main and sub tabs are reopened after a refresh), SVG icons, image preview, the header tabs' scrolling, the preview's SEO
  heading check, and the dev pages. The code editor (and its syntax highlighting) loads only on pages with a code field
- Chosen dropdowns are hidden (their javascript still runs) and the native selects are styled instead

## A second row of tabs in a section

A section's header tabs are one row (a model admin's models, say). For a section that groups them, with a second row of
tabs for what's in the chosen group, the module draws that row as it draws nested tabs (Settings > Theme): a menu
column down the side of the panel when there's room, pills above the list when there isn't. Silverstripe has no such
row, so the section's own `_Content` template draws it, first in its `.cms-content-fields`:

```html
<div class="cms-content-fields …">
  <nav class="cms-content-subtabs" aria-label="Projects">
    <ul class="nav">
      <li class="nav-item"><a href="…" class="nav-link cms-panel-link" aria-current="page">Surveys</a></li>
      <li class="nav-item"><a href="…" class="nav-link cms-panel-link">Designs</a></li>
    </ul>
  </nav>
  $Tools
  <div class="cms-content-view">$EditForm</div>
</div>
```

They're links to other pages, not tabs over panels on this one: a `nav` of links, the current one marked with
`aria-current="page"` (or `.active`), and `cms-panel-link` so they load as the header tabs do. Leave the row out when
the group has only one thing in it.

## Using it in a page template

`{$CMSStylesPreviewScripts}` in the page's `<head>` runs the SEO heading check when the page is in the CMS preview. It only
loads inside the CMS's preview frame.

## Building

The package builds itself: it has its own `package.json`, webpack config and `node_modules`, and uses nothing from the project
it's installed in. From the package's folder (Node 20+):

```sh
npm install
npm run build    # client/dist, minified
npm run watch    # rebuilds as you edit client/source
```

- `client/dist` is committed, it's what composer installs (and what `composer vendor-expose` exposes). Run the build and commit
  it with any change to `client/source`
- Every stylesheet in `client/source/styles/modules/<vendor>/<package>` is found by the build, nothing to register
- Babel is for syntax only, there are no polyfills. `sass` is held to `~1.105`: 1.106 rejects `[value=""]` selectors
- Scripts load their lazy chunks (the code editor) from beside `cms.js`, wherever the package is installed
