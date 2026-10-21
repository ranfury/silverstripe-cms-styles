/* ------------------------------------------------------------------
Tab memory

Coming back to a form (e.g. after saving the settings) opens the tabs
that were open before. Remembered per form and tab set, for this
browser tab only (sessionStorage)
------------------------------------------------------------------ */

import DomObserver from './dom-observer';

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
// Not the action menu ("More options"): it's a tab set too, and it would be re-opened every time the form loads
const TABS = '.cms-edit-form .ss-tabset:not(.ss-ui-action-tabset) > ul.ui-tabs-nav, .cms-content-header-tabs > ul.ui-tabs-nav';

export default function initTabMemory() {
  DomObserver.observe(TABS, (navs) => {
    navs.forEach((nav) => {
      const key = keyFor(nav);
      const memory = read();

      // Re-open the remembered tab
      const remembered = memory[key] && nav.querySelector(`[aria-controls="${CSS.escape(memory[key])}"] a`);
      if (remembered && !remembered.closest('.ui-tabs-active')) remembered.click();

      nav.addEventListener('click', (e) => {
        const tab = e.target.closest('[aria-controls]');
        if (!tab) return;

        write({ ...read(), [key]: tab.getAttribute('aria-controls') });
      });
    });
  });
}
