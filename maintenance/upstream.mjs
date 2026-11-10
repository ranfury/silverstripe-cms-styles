#!/usr/bin/env node
/**
 * Checks the modules this one restyles for upstream changes to their markup and classes.
 *
 * Every module whose styles are blocked is in upstream.json with the version (and commit) its styles here were last
 * checked against. `check` fetches each one's repository, finds its newest release, and reports what changed since:
 * the commits, the templates / source styles / scripts that changed (the full diff is saved beside the report), and
 * the CSS classes upstream added or removed, against the classes this module styles. `accept` moves a module's
 * baseline on, once it has been restyled (or needed nothing).
 *
 *   node maintenance/upstream.mjs check [vendor/package ...] [--site=../dricon] [--pre]
 *   node maintenance/upstream.mjs accept <vendor/package ... | --clean | --all> [--to=<tag or commit>]
 *
 * Nothing here is installed with the module (maintenance/ is export-ignored). Repositories and reports go in
 * .upstream/ (git ignored).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'maintenance/upstream.json');
const CACHE = join(ROOT, '.upstream');
const REPOS = join(CACHE, 'repos');
const LAST_CHECK = join(CACHE, 'last-check.json');
const SELF = 'ranfury/silverstripe-cms-styles';
const TODAY = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local

// What changes the markup or the styles: diffed in full (tests, translations and built files left out)
const DIFF_PATHS = ['templates', 'client/src', 'client/source', 'client/css', 'client/javascript', 'client/styles', 'css', 'javascript', 'scss'];
const DIFF_EXCLUDES = ['**/tests/**', '**/__tests__/**', '**/*.test.js', '**/*.spec.js', '**/*.stories.js', '**/stories/**', '**/lang/**', '**/dist/**'];
// Where class names are read from: the above, the built files (exact, BEM resolved), and the PHP (addExtraClass...)
const INVENTORY_PATHS = [...DIFF_PATHS, 'client/dist', 'src', 'code'];

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const NOT_CLASSES = new Set(['js', 'jsx', 'ts', 'css', 'scss', 'svg', 'png', 'gif', 'jpg', 'jpeg', 'webp', 'min', 'php', 'ss', 'html', 'json', 'map', 'woff', 'woff2', 'ttf', 'eot', 'md', 'txt', 'xml', 'yml', 'com', 'org', 'io', 'nz']);

// ---------------------------------------------------------------------------------------------------------------------

const [command = 'check', ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : true];
}));
const names = rest.filter((a) => !a.startsWith('--'));

// ---------------------------------------------------------------------------------------------------------------------

function check() {
    const manifest = readManifest();
    validateManifest(manifest);
    const selected = select(manifest);
    const ours = ourClasses();
    const site = flags.site ? readSite(String(flags.site)) : null;
    const reportDir = join(CACHE, 'reports', TODAY);
    mkdirSync(reportDir, { recursive: true });

    const results = [];

    for (const name of selected) {
        const entry = manifest.modules[name];
        process.stdout.write(`${name} … `);

        try {
            const result = checkModule(name, entry, ours, reportDir, site);
            results.push(result);
            console.log(result.status);
        } catch (e) {
            results.push({ name, status: 'error', error: e.message });
            console.log(`error: ${e.message.split('\n')[0]}`);
        }
    }

    const unstyled = site ? unstyledModules(site, manifest) : [];
    const report = renderReport(results, site, unstyled);
    const reportFile = join(reportDir, 'report.md');
    writeFileSync(reportFile, report);

    // What `accept` moves the baselines to: the releases this check looked at
    const last = existsSync(LAST_CHECK) ? JSON.parse(readFileSync(LAST_CHECK, 'utf8')) : {};
    for (const r of results.filter((r) => r.target)) {
        last[r.name] = { version: r.target.version, commit: r.target.commit, clean: r.status === 'up to date' || r.status === 'nothing to restyle', checked: TODAY };
    }
    writeFileSync(LAST_CHECK, JSON.stringify(last, null, 2) + '\n');

    console.log('');
    console.table(results.map((r) => ({
        module: r.name,
        styled: r.base?.version ?? '',
        latest: r.target?.version ?? '',
        status: r.status,
        files: r.files?.length ?? '',
        'gone (styled)': r.removedStyled?.length ?? '',
        new: r.added?.length ?? '',
        major: r.newerMajor ?? '',
    })));
    console.log(`Report: ${relative(process.cwd(), reportFile)}`);
}

function checkModule(name, entry, ours, reportDir, site) {
    const repo = ensureRepo(name, entry.repo);
    const base = { version: entry.styled.version, commit: entry.styled.commit };

    if (!hasCommit(repo, base.commit)) {
        throw new Error(`the styled commit ${base.commit.slice(0, 10)} isn't in ${entry.repo} (rewritten history?). Set it again with accept --to`);
    }

    const { target, newerMajor } = resolveTarget(repo, entry);
    const result = { name, entry, base, target, newerMajor, ours: entry.ours ?? [`modules/${name}.css`] };

    if (site?.packages[name]) {
        result.installed = installedState(repo, site.packages[name], base.commit);
    }

    if (target.commit === base.commit) {
        result.status = 'up to date';
        result.files = [];
        result.removedStyled = [];
        result.added = [];
        return result;
    }

    const diffSpec = pathspec([...DIFF_PATHS, ...(entry.watch ?? [])], DIFF_EXCLUDES);
    const range = [base.commit, target.commit];

    result.commits = lines(git(repo, ['log', '--no-merges', '--format=%h %ad %s', '--date=short', `${base.commit}..${target.commit}`, '--', ...diffSpec]));
    result.files = lines(git(repo, ['diff', '--stat=200', '--stat-name-width=150', ...range, '--', ...diffSpec])).slice(0, -1);

    const fileBase = name.replace('/', '__');
    if (result.files.length) {
        writeFileSync(join(reportDir, `${fileBase}.diff`), git(repo, ['diff', ...range, '--', ...diffSpec]));
        result.diffFile = `${fileBase}.diff`;
    }

    // Classes, before and after
    const before = inventory(repo, base.commit, entry);
    const after = inventory(repo, target.commit, entry);
    const removed = [...before.keys()].filter((c) => !after.has(c)).sort();
    const added = [...after.keys()].filter((c) => !before.has(c)).sort();

    result.removedStyled = removed.filter((c) => ours.has(c)).map((c) => ({ cls: c, upstream: [...before.get(c)], here: [...ours.get(c)], source: sourceUsages(c) }));
    result.removedOther = removed.filter((c) => !ours.has(c));
    result.added = added.map((c) => ({ cls: c, upstream: [...after.get(c)], styled: ours.has(c) }));

    result.status = result.removedStyled.length ? 'restyle'
        : result.files.length || added.length ? 'review'
            : 'nothing to restyle';

    return result;
}

// ---------------------------------------------------------------------------------------------------------------------

function accept() {
    const manifest = readManifest();
    const last = existsSync(LAST_CHECK) ? JSON.parse(readFileSync(LAST_CHECK, 'utf8')) : {};
    let selected;

    if (flags.all || flags.clean) {
        selected = Object.keys(last).filter((n) => manifest.modules[n] && (flags.all || last[n].clean) && last[n].commit !== manifest.modules[n].styled.commit);
    } else if (names.length) {
        selected = names;
    } else {
        throw new Error('Name the modules to accept, or --clean (those the last check found nothing to restyle in) or --all');
    }

    if (flags.to && selected.length !== 1) {
        throw new Error('--to is for one module at a time');
    }

    for (const name of selected) {
        const entry = manifest.modules[name];
        if (!entry) throw new Error(`${name} isn't in upstream.json`);

        let to;
        if (flags.to) {
            const repo = ensureRepo(name, entry.repo);
            const ref = String(flags.to);
            to = { version: ref, commit: git(repo, ['rev-parse', `${ref}^{commit}`]).trim() };
        } else if (last[name]) {
            to = last[name];
        } else {
            throw new Error(`${name} hasn't been checked yet: run check first, or give --to`);
        }

        const from = entry.styled.version;
        entry.styled = { version: to.version, commit: to.commit, checked: TODAY };
        console.log(`${name}: ${from} → ${to.version} (${to.commit.slice(0, 10)})`);
    }

    writeManifest(manifest);
    console.log('\nupstream.json updated: commit it with the restyle.');
}

// ---------------------------------------------------------------------------------------------------------------------
// Manifest

function readManifest() {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

function writeManifest(manifest) {
    manifest.modules = Object.fromEntries(Object.entries(manifest.modules).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 4) + '\n');
}

/** Every module styled here (a stylesheet in styles/modules, or one listed in blocked_stylesheets) must be watched */
function validateManifest(manifest) {
    const styled = new Set();
    const modulesDir = join(ROOT, 'client/source/styles/modules');

    for (const vendor of readdirSync(modulesDir)) {
        for (const item of readdirSync(join(modulesDir, vendor))) {
            styled.add(`${vendor}/${item.replace(/\.scss$/, '')}`);
        }
    }

    const config = readFileSync(join(ROOT, '_config/config.yml'), 'utf8');
    for (const m of config.matchAll(/^\s*-\s*'([^/:' ]+\/[^/:' ]+)\s*:/gm)) {
        styled.add(m[1]);
    }

    const missing = [...styled].filter((n) => !manifest.modules[n]);
    if (missing.length) {
        throw new Error(`Styled here but not in maintenance/upstream.json: ${missing.join(', ')}\n`
            + 'Add each with its repository and the version its styles were written against (see MAINTENANCE.md)');
    }
}

function select(manifest) {
    const all = Object.keys(manifest.modules);
    const unknown = names.filter((n) => !manifest.modules[n]);
    if (unknown.length) throw new Error(`Not in upstream.json: ${unknown.join(', ')}`);
    return names.length ? names : all;
}

// ---------------------------------------------------------------------------------------------------------------------
// Git

function git(dir, args, { allowFail = false } = {}) {
    try {
        return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        if (allowFail) return e.stdout?.toString() ?? '';
        throw new Error(`git ${args.join(' ')}\n${e.stderr?.toString() ?? e.message}`);
    }
}

const fetched = new Set();

/** A bare clone without file contents (they're fetched as needed), kept in .upstream/repos and fetched once a run */
function ensureRepo(name, url) {
    const dir = join(REPOS, `${name.replace('/', '__')}.git`);

    if (!existsSync(dir)) {
        mkdirSync(REPOS, { recursive: true });
        execFileSync('git', ['clone', '--quiet', '--bare', '--filter=blob:none', url, dir], { stdio: ['ignore', 'ignore', 'pipe'] });
        fetched.add(dir);
    } else if (!fetched.has(dir)) {
        git(dir, ['fetch', '--quiet', '--prune', '--tags', '--force', 'origin', '+refs/heads/*:refs/heads/*']);
        fetched.add(dir);
    }

    return dir;
}

function hasCommit(repo, commit) {
    try {
        execFileSync('git', ['-C', repo, 'cat-file', '-e', `${commit}^{commit}`], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function lines(text) {
    return text.split('\n').map((l) => l.trimEnd()).filter(Boolean);
}

function pathspec(paths, excludes) {
    return [...paths, ...excludes.map((e) => `:(exclude,glob)${e}`)];
}

// ---------------------------------------------------------------------------------------------------------------------
// Versions

function parseVersion(tag) {
    const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:[-.]?((?:alpha|beta|rc|a|b)[.\d]*))?$/i.exec(tag);
    return m ? { tag, parts: [+m[1], +m[2], +(m[3] ?? 0)], pre: m[4] ?? null } : null;
}

function compareVersions(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a.parts[i] !== b.parts[i]) return a.parts[i] - b.parts[i];
    }
    if (a.pre === b.pre) return 0;
    if (!a.pre) return 1;
    if (!b.pre) return -1;
    return a.pre.localeCompare(b.pre, undefined, { numeric: true });
}

/**
 * What to compare with: the newest release in the same major as the styled version (a new major is reported, not
 * compared: it's a new constraint, see MAINTENANCE.md). A module styled from a branch (dev-…) follows that branch,
 * or the default branch once it's gone
 */
function resolveTarget(repo, entry) {
    const tags = lines(git(repo, ['tag', '-l'])).map(parseVersion).filter((v) => v && (flags.pre || !v.pre)).sort(compareVersions);
    const newest = tags.at(-1);
    const styled = parseVersion(entry.styled.version);

    if (entry.track || !styled) {
        const branch = entry.track ?? entry.styled.version.replace(/^dev-/, '');
        let ref = `refs/heads/${branch}`;
        let label = `dev-${branch}`;

        if (!git(repo, ['rev-parse', '--verify', '--quiet', ref], { allowFail: true }).trim()) {
            const head = git(repo, ['symbolic-ref', 'HEAD']).trim();
            ref = head;
            label = `dev-${head.replace('refs/heads/', '')} (${branch} is gone)`;
        }

        return {
            target: { version: label, commit: git(repo, ['rev-parse', `${ref}^{commit}`]).trim() },
            newerMajor: newest ? `newest tag ${newest.tag}` : null,
        };
    }

    const sameMajor = tags.filter((v) => v.parts[0] === styled.parts[0]);
    const latest = sameMajor.at(-1) ?? styled;
    const tag = latest.tag ?? entry.styled.version;

    return {
        target: { version: tag, commit: git(repo, ['rev-parse', `${tag}^{commit}`]).trim() },
        newerMajor: newest && newest.parts[0] > styled.parts[0] ? newest.tag : null,
    };
}

// ---------------------------------------------------------------------------------------------------------------------
// Classes

/** The classes a module uses at a commit: class => files they're in */
function inventory(repo, commit, entry) {
    const spec = pathspec([...INVENTORY_PATHS, ...(entry.watch ?? [])], ['**/tests/**', '**/__tests__/**', '**/*.test.js', '**/*.stories.js', '**/lang/**', '**/node_modules/**', '**/thirdparty/**']);
    const classes = new Map();
    const add = (cls, file) => {
        if (!/^-?[_a-zA-Z][\w-]*$/.test(cls) || cls.length < 2 || NOT_CLASSES.has(cls.toLowerCase())) return;
        if (!classes.has(cls)) classes.set(cls, new Set());
        classes.get(cls).add(file);
    };

    // One diff from nothing fetches every file it needs in one go (grep would fetch them one by one)
    git(repo, ['diff', '--numstat', EMPTY_TREE, commit, '--', ...spec], { allowFail: true });

    const grep = (pattern, globs) => lines(git(repo, ['grep', '-I', '-o', '-E', pattern, commit, '--', ...globs.map((g) => `:(glob)${g}`), ...spec.filter((s) => s.startsWith(':(exclude'))], { allowFail: true }))
        .map((l) => {
            const rest = l.slice(commit.length + 1);
            const i = rest.indexOf(':');
            return { file: rest.slice(0, i), match: rest.slice(i + 1) };
        })
        .filter(({ file }) => inPaths(file, spec));

    const tokens = (value) => value
        .replace(/<%.*?%>/g, ' ')
        .replace(/\{?\$[\w.()]+\}?/g, ' ')
        .replace(/\$\{[^}]*\}/g, ' ')
        .split(/[\s'"`,]+/);

    // Templates
    for (const { file, match } of grep('class="[^"]*"', ['**/*.ss', '**/*.html'])) {
        tokens(match.slice(7, -1)).forEach((c) => add(c, file));
    }

    // Scripts: JSX / compiled className, classList, jQuery's addClass... and selectors in strings ('.cms-content')
    const scripts = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'];
    for (const { file, match } of grep('className[=:][[:space:]]*["\'`][^"\'`]*["\'`]', scripts)) {
        tokens(match.replace(/^className[=:]\s*/, '').slice(1, -1)).forEach((c) => add(c, file));
    }
    for (const { file, match } of grep('(add|remove|toggle|has)Class\\([[:space:]]*["\'][^"\']+["\']|classList\\.(add|remove|toggle|contains)\\([[:space:]]*["\'][^"\']+["\']', scripts)) {
        tokens(match.replace(/^[^(]*\(\s*/, '').slice(1, -1)).forEach((c) => add(c, file));
    }
    for (const { file, match } of grep('["\']([^"\']*[ >+~,(:])?\\.[a-zA-Z][a-zA-Z0-9_-]*[^"\']*["\']', scripts)) {
        if (/\/dist\//.test(file) && !/^["']\./.test(match)) continue; // built scripts: only strings that start as a selector
        for (const m of match.matchAll(/(?:^["']|[ >+~,(:])\.([a-zA-Z][\w-]*)/g)) add(m[1], file);
    }

    // PHP: addExtraClass, 'class' =>, setAttribute('class', ...)
    for (const { file, match } of grep('(add|remove)ExtraClass\\([[:space:]]*["\'][^"\']+["\']|["\']class["\'][[:space:]]*(=>|,)[[:space:]]*["\'][^"\']+["\']', ['**/*.php'])) {
        const value = match.match(/["']([^"']+)["']\s*$/)?.[1] ?? '';
        tokens(value).forEach((c) => add(c, file));
    }

    // Stylesheets: built css (exact) and plain css. Source scss is in the diff, its nesting can't be read here
    const cssFiles = lines(git(repo, ['ls-tree', '-r', '--name-only', commit, '--', ...spec.filter((s) => !s.startsWith(':'))]))
        .filter((f) => f.endsWith('.css') && inPaths(f, spec));
    for (const file of cssFiles) {
        for (const cls of cssClasses(git(repo, ['show', `${commit}:${file}`]))) add(cls, file);
    }

    return classes;
}

function inPaths(file, spec) {
    const excludes = spec.filter((s) => s.startsWith(':(exclude')).map((s) => globRegex(s.replace(/^:\([^)]*\)/, '')));
    const includes = spec.filter((s) => !s.startsWith(':'));
    return includes.some((p) => file === p || file.startsWith(`${p}/`)) && !excludes.some((re) => re.test(file));
}

function globRegex(glob) {
    return new RegExp('^' + glob.split('**/').map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('(?:.*/)?') + '$');
}

/** The class selectors in a stylesheet (not in its strings, urls or declarations) */
function cssClasses(css) {
    let text = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/url\([^)]*\)/g, '')
        .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

    // Declarations out, until only selectors (and at-rules' preludes) are left
    for (let prev = ''; prev !== text;) {
        prev = text;
        text = text.replace(/\{[^{}]*\}/g, ';');
    }

    const found = new Set();
    for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) found.add(m[1]);
    return found;
}

/** The classes this module's built stylesheets use: class => our css files */
function ourClasses() {
    const dir = join(ROOT, 'client/dist/styles');
    const classes = new Map();

    const walk = (d) => readdirSync(d).forEach((f) => {
        const p = join(d, f);
        if (statSync(p).isDirectory()) return walk(p);
        if (!f.endsWith('.css')) return;
        const name = relative(dir, p);
        for (const cls of cssClasses(readFileSync(p, 'utf8'))) {
            if (!classes.has(cls)) classes.set(cls, new Set());
            classes.get(cls).add(name);
        }
    });

    if (!existsSync(dir)) throw new Error('client/dist/styles is missing: npm run build first');
    walk(dir);
    return classes;
}

/** Where a class is written in client/source/styles (a BEM class built with & isn't found: the css file is shown) */
function sourceUsages(cls) {
    const out = execFileSync('git', ['-C', ROOT, 'grep', '-n', '-E', `\\.${cls.replace(/[-]/g, '\\-')}([^\\w-]|$)`, '--', 'client/source/styles'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return lines(out).map((l) => l.split(':').slice(0, 2).join(':')).slice(0, 8);
}

// ---------------------------------------------------------------------------------------------------------------------
// A site's composer.lock

function readSite(path) {
    const dir = resolve(path);
    const lockFile = join(dir, 'composer.lock');
    if (!existsSync(lockFile)) throw new Error(`No composer.lock in ${dir}`);

    const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
    const packages = Object.fromEntries([...lock.packages, ...(lock['packages-dev'] ?? [])].map((p) => [p.name, p]));
    return { dir, name: relative(dirname(ROOT), dir) || dir, packages };
}

/** The version a site has installed, against the one the styles were checked with */
function installedState(repo, pkg, styledCommit) {
    const commit = pkg.source?.reference;
    const state = { version: pkg.version, commit };

    if (!commit || !hasCommit(repo, commit)) state.relation = 'unknown';
    else if (commit === styledCommit) state.relation = 'same';
    else if (isAncestor(repo, styledCommit, commit)) state.relation = 'newer';
    else if (isAncestor(repo, commit, styledCommit)) state.relation = 'older';
    else state.relation = 'diverged';

    return state;
}

function isAncestor(repo, a, b) {
    try {
        execFileSync('git', ['-C', repo, 'merge-base', '--is-ancestor', a, b], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/** Installed modules that ship stylesheets but aren't styled or ignored here: they may be drawing their own in the CMS */
function unstyledModules(site, manifest) {
    const ignored = new Set(manifest.ignore ?? []);
    const found = [];

    for (const [name, pkg] of Object.entries(site.packages)) {
        if (pkg.type !== 'silverstripe-vendormodule' || name === SELF || manifest.modules[name] || ignored.has(name)) continue;

        const dir = join(site.dir, 'vendor', name);
        if (!existsSync(dir)) continue;

        const css = execFileSync('find', [dir, '-name', '*.css', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/tests/*', '-not', '-path', '*/docs/*'], { encoding: 'utf8' });
        const files = lines(css).map((f) => relative(dir, f));
        if (files.length) found.push({ name, version: pkg.version, files });
    }

    return found;
}

// ---------------------------------------------------------------------------------------------------------------------
// Report

function renderReport(results, site, unstyled) {
    const out = [`# Upstream check, ${TODAY}`, ''];
    const order = { restyle: 0, review: 1, error: 2, 'nothing to restyle': 3, 'up to date': 4 };
    const sorted = [...results].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

    out.push('| Module | Styled against | Latest | Status | Changed files | Styled classes gone | New classes | Newer major |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of sorted) {
        out.push(`| ${r.name} | ${r.base?.version ?? ''} | ${r.target?.version ?? ''} | **${r.status}** | ${r.files?.length ?? ''} | ${r.removedStyled?.length ?? ''} | ${r.added?.length ?? ''} | ${r.newerMajor ?? ''} |`);
    }
    out.push('');
    out.push('- **restyle**: classes styled here are gone upstream, the styles for them need moving to what replaced them');
    out.push('- **review**: templates, styles or scripts changed, or new classes appeared: read the diff and check the screens');
    out.push('- **nothing to restyle**: a newer release, but nothing that draws anything changed: `accept --clean` moves these on');
    out.push('');

    if (site) {
        out.push(`## ${site.name}`, '');
        out.push('| Module | Installed | Styled against | |');
        out.push('| --- | --- | --- | --- |');
        for (const r of sorted.filter((r) => r.installed)) {
            const note = { same: 'same', newer: 'newer than the styles were checked with', older: 'older: the styles may expect markup it hasn\'t got', diverged: 'a different branch', unknown: 'commit not found' }[r.installed.relation];
            out.push(`| ${r.name} | ${r.installed.version} | ${r.base.version} | ${note} |`);
        }
        out.push('');

        if (unstyled.length) {
            out.push('### Installed, with stylesheets, not styled here', '');
            out.push('Each either draws its own styles in the CMS (style it, or add it to `ignored_modules`), or only has front-end / unused css (add it to `ignore` in upstream.json).', '');
            for (const u of unstyled) out.push(`- **${u.name}** ${u.version}: ${u.files.slice(0, 6).map((f) => `\`${f}\``).join(', ')}${u.files.length > 6 ? ` +${u.files.length - 6}` : ''}`);
            out.push('');
        }
    }

    for (const r of sorted.filter((r) => ['restyle', 'review', 'error'].includes(r.status))) {
        out.push(`## ${r.name}: ${r.base?.version ?? ''} → ${r.target?.version ?? ''}`, '');

        if (r.error) {
            out.push('```', r.error, '```', '');
            continue;
        }

        out.push(`Styled in: ${r.ours.map((f) => `\`${f}\``).join(', ')}${r.diffFile ? ` · Full diff: \`${r.diffFile}\`` : ''}`, '');

        if (r.removedStyled.length) {
            out.push('### Styled here, gone upstream', '');
            for (const c of r.removedStyled) {
                out.push(`- \`.${c.cls}\` was in ${c.upstream.slice(0, 3).map((f) => `\`${f}\``).join(', ')}; styled in ${(c.source.length ? c.source : c.here).map((f) => `\`${f}\``).join(', ')}`);
            }
            out.push('');
        }

        const unstyledNew = r.added.filter((c) => !c.styled);
        if (r.added.length) {
            out.push(`### New upstream (${unstyledNew.length} not styled here)`, '');
            for (const c of r.added) out.push(`- \`.${c.cls}\`${c.styled ? ' (styled)' : ''}: ${c.upstream.slice(0, 3).map((f) => `\`${f}\``).join(', ')}`);
            out.push('');
        }

        if (r.removedOther.length) {
            out.push(`<details><summary>Gone upstream, not styled here (${r.removedOther.length})</summary>`, '', r.removedOther.map((c) => `\`.${c}\``).join(' '), '', '</details>', '');
        }

        if (r.commits.length) {
            out.push('### Commits that touched them', '');
            r.commits.slice(0, 40).forEach((c) => out.push(`- ${c}`));
            if (r.commits.length > 40) out.push(`- … ${r.commits.length - 40} more`);
            out.push('');
        }

        if (r.files.length) {
            out.push('### Changed files', '', '```', ...r.files, '```', '');
        }
    }

    return out.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------------

try {
    if (command === 'check') {
        check();
    } else if (command === 'accept') {
        accept();
    } else {
        throw new Error(`Unknown command "${command}" (check or accept)`);
    }
} catch (e) {
    console.error(`\n${e.message}`);
    process.exit(1);
}
