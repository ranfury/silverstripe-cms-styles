# Maintenance

This module blocks the styles of the CMS and of every module it styles, and draws them itself. When one of those
modules changes its templates, its React components or its class names, nothing breaks loudly: a screen quietly
loses its styles, or a new part of it shows up unstyled. This is the routine that catches that.

**When:** every 6 to 8 weeks, and whenever a site is about to take a Silverstripe minor (6.3 → 6.4) or a module's
new major.

## What it's built on

- `maintenance/upstream.json` (committed): every module whose styles are blocked, its repository, and the version and
  commit its styles here were **last checked against**. It's the record of what the styles were written for
- `maintenance/upstream.mjs`: `check` compares each module's baseline with its newest release, `accept` moves the
  baseline on
- `.upstream/` (git ignored): the clones of the modules' repositories, and the reports

`check` refuses to run while a module is styled here (a stylesheet in `styles/modules`, or a line in
`blocked_stylesheets`) but missing from `upstream.json`, so nothing styled goes unwatched.

## The routine

### 1. Check

```sh
npm run upstream -- --site=../dricon
```

The first run clones the repositories (a few minutes), later ones take under a minute. It prints a summary and writes
`.upstream/reports/<date>/report.md`, with a full diff for each module that changed (`<vendor>__<package>.diff`).

For each module it compares the baseline with the newest release **in the same major**: the commits and files that
changed in its templates, source styles and scripts (built files, tests and translations left out), and the CSS
classes it uses (from its templates, its scripts, its PHP `addExtraClass`, and its built css), against the classes
this module's built css styles.

| Status | Meaning | What to do |
| --- | --- | --- |
| **up to date** | No newer release | Nothing |
| **nothing to restyle** | A newer release, but nothing that draws anything changed | `npm run upstream:accept -- --clean` |
| **review** | Templates / styles / scripts changed, or new classes appeared | Step 2 |
| **restyle** | Classes styled here are **gone** upstream: those styles do nothing now | Step 2, and fix first |

A **newer major** is only reported, not compared: it's a new constraint (in this module's `composer.json`, and
the sites'), a planned piece of work of its own.

`--site=<path>` adds what that site has installed:

- each module's installed version against the baseline. **older** means the styles may expect markup the site
  hasn't got: check that site's screens too, or update the site
- **modules installed with stylesheets that aren't styled here**: each one is either drawing its own (default
  Silverstripe-looking) styles in the CMS, or only has front-end / unused css. Style it (STYLE-GUIDE.md), or add it to
  `ignore` in `upstream.json` so it isn't listed again

Run it against each site that's about to be updated, they don't all run the same versions.

`npm run upstream -- silverstripe/admin` checks only the modules named. `--pre` includes betas and release
candidates (a look ahead before a Silverstripe release).

### 2. Triage each module that needs it

From the report, worst first:

1. **Styled here, gone upstream**: each class is listed with where it's styled. Find what replaced it in the diff
   (usually a rename, or a component rewritten) and move the styles to it
2. **New upstream, not styled here**: a new element, state or component. The report says where it comes from (a
   template, a component, the built css). If it came with the module's own css (`client/dist/styles/bundle.css`), that
   css is blocked here, so it's drawn with nothing: style it
3. **Changed files**: read the diff (`.upstream/reports/<date>/<module>.diff`) for changed markup (new wrappers,
   moved elements, changed structure). A change that only moved code around, or changed what a script requests,
   needs nothing. Many "review"s end here
4. **The commits** say why, and are the fastest way to see whether a change is visual at all

Not everything visual is in the report: a class built in a script from parts (`` `${base}__item` ``) or a change in
nesting can only be seen on the screen. For any module that's "review" or "restyle", look at its screens (step 3).

### 3. Restyle, on the dev site

dricon has this module symlinked (`vendor/ranfury/silverstripe-cms-styles`), so:

1. Update the module on the site (`composer update vendor/package`)
2. `npm run watch` here
3. Restyle by STYLE-GUIDE.md, with the upstream diff open beside it
4. Check the module's screens, in **light and dark**, at a **wide and a narrow width** (below 768px the CMS has its
   mobile menu), and with the theme hue moved, and the states the diff touched (empty, error, disabled, dragging,
   loading, a long title...)

### 4. Accept and release

```sh
npm run upstream:accept -- silverstripe/asset-admin   # to the release the last check looked at
npm run upstream:accept -- --clean                    # every module the last check found nothing to restyle in
npm run upstream:accept -- toastnz/blocks-layouts --to=6.1.15   # to a given tag or commit
npm run build
```

Commit `upstream.json` with the restyle and the built `client/dist`, so the commit says what the styles were checked
against. Then tag a release (patch for a restyle, minor for a newly styled module).

**Don't accept a module that wasn't looked at.** The baseline is a promise that the styles match that version.

## Adding a module

When a new module is styled (STYLE-GUIDE.md), add it to `upstream.json` with the version the styles were written
against, from the dev site's `composer.lock` (`version`, and `source.reference` as the `commit`):

```json
"vendor/package": {
    "repo": "https://github.com/vendor/package.git",
    "styled": { "version": "2.1.0", "commit": "<full sha>", "checked": "2026-11-11" }
}
```

Optional settings:

- `ours`: the built stylesheets that style it, for the report (by default `modules/<vendor>/<package>.css`). The
  CMS's own modules are styled in `cms.css`
- `watch`: more of the module's paths to diff in full. `silverstripe/framework` watches `DebugView.php`,
  `TaskRunner.php` and `CMSSecurity.php`, which this module replaces or extends
- `track`: a branch to follow instead of the tags (a module styled from `dev-…` follows that branch until it's gone,
  then the default branch)

## The baseline, as it was set

`upstream.json` was first filled on 2026-11-11 from dricon's `composer.lock`, the site the module is developed on,
with elemental and grouped CMS menu (not on dricon) from marmalade's. It assumes the styles fit those versions. Two
modules are styled from branches, not releases: `toastnz/blocks-layouts` (`dev-feature/2026/m7`) and
`tractorcow/silverstripe-colorpicker` (`dev-master`); move them to a tag (`accept --to=`) once the sites use one.
