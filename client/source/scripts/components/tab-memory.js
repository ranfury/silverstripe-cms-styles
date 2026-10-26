/* ------------------------------------------------------------------
Tab memory

Coming back to a form (e.g. after saving the settings) opens the tabs
that were open before. Remembered per form and tab set, for this
browser tab only (sessionStorage)

It's restored as soon as the tabs are in the page (not on DomObserver's
100ms-after-the-last-change delay), and before the CMS has set them up
where it can: the admin opens the tab marked .ui-tabs-active, so marking
the remembered one means it opens first time, with no flash of the
first tab and no click
------------------------------------------------------------------ */

const KEY = 'cms-tab-memory';

function read() {
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function write(memory) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Not remembered
  }
}

// The same form on the same page (record) shares its memory
const keyFor = (tabset) => `${window.location.pathname}#${tabset.closest('[id]')?.id || ''}`;

// The form's tabs, and the tabs along its header (a form's main tabs are there, e.g. the site settings').
// Not the action menu ("More options"): it's a tab set too, and it would be re-opened every time the form loads.
// (the list, before and after the CMS has made it a tab set)
const TABS = '.cms-edit-form .ss-tabset:not(.ss-ui-action-tabset) > ul, .cms-content-header-tabs > ul';

const seen = new WeakSet();

function restore(nav) {
  const key = keyFor(nav);
  const id = read()[key];
  // (a tab's link ends in its panel's id, before and after the CMS has set it up)
  const link = id && nav.querySelector(`a[href$="#${CSS.escape(id)}"]`);
  const tab = link?.closest('li');
  if (!tab || tab.classList.contains('ui-tabs-active')) return;

  if (nav.classList.contains('ui-tabs-nav')) {
    link.click();
    return;
  }

  // Not set up yet: it opens the tab marked active
  nav.querySelectorAll('.ui-tabs-active').forEach((active) => active.classList.remove('ui-tabs-active'));
  tab.classList.add('ui-tabs-active');
}

function remember(nav) {
  seen.add(nav);
  restore(nav);

  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('[aria-controls]');
    if (!tab) return;

    write({ ...read(), [keyFor(nav)]: tab.getAttribute('aria-controls') });
  });
}

export default function initTabMemory() {
  const scan = () => document.querySelectorAll(TABS).forEach((nav) => seen.has(nav) || remember(nav));

  // The CMS loads its panels with ajax and react: the tabs are looked for as they're added (no waiting for
  // the changes to settle). And again when the CMS sets one up (it gets .ui-tabs-nav), to check the right tab opened
  new MutationObserver((mutations) => {
    mutations.forEach(({ type, target }) => {
      if (type === 'attributes' && seen.has(target) && target.classList.contains('ui-tabs-nav')) restore(target);
    });

    if (mutations.some(({ addedNodes }) => addedNodes.length)) scan();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  scan();
}
