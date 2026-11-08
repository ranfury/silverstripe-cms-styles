/* ------------------------------------------------------------------
Scrolling tabs

When there are more tabs than fit they scroll sideways: an edge fades
while there are more tabs that way (.has-more-start / .has-more-end,
abstracts/mixins: scroll-fade), and the open tab is scrolled to the
middle of the row, so more of the tabs either side of it show. Choosing
a tab at the edge brings the next ones into view, both ways, for
anyone with no way of scrolling sideways (no trackpad or wheel)

Two kinds of row: the header tabs (Content / Settings / History), where
the row is the .cms-content-header-tabs that holds the list, and the
form's tabs, where the row is the list itself
------------------------------------------------------------------ */

import DomObserver from './dom-observer';

const HEADER_TABS = '.cms-content-header-tabs';
// The form's tabs: the list of any tab set (not the action menu, "More options"), before and after the CMS sets it up.
// Rows that don't overflow (the nested tabs, a column or pills) are left alone: there's nothing to scroll
const FORM_TABS = '.ss-tabset:not(.ss-ui-action-tabset) > :is(.nav-tabs, .ui-tabs-nav)';

const revealed = new WeakMap();
const seen = new WeakSet();

function updateFade(scroller) {
  const max = scroller.scrollWidth - scroller.clientWidth;

  scroller.classList.toggle('has-more-start', scroller.scrollLeft > 1);
  scroller.classList.toggle('has-more-end', scroller.scrollLeft < max - 1);
}

// Scrolls the open tab to the middle of the row (the browser stops at either end, so the first and last tabs stay
// at the edges). Only when the row overflows, and only the row: not the page, as scrollIntoView could
function reveal(scroller, smooth) {
  const active = scroller.querySelector('.ui-tabs-active');
  if (!active || scroller.scrollWidth <= scroller.clientWidth) return;

  const row = scroller.getBoundingClientRect();
  const tab = active.getBoundingClientRect();
  const left = scroller.scrollLeft + (tab.left - row.left) - (row.width - tab.width) / 2;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  revealed.set(scroller, active);
  scroller.scrollTo({ left, behavior: smooth && !reduced ? 'smooth' : 'auto' });
}

export default function initHeaderTabs() {
  const resize = new ResizeObserver((entries) => entries.forEach(({ target }) => updateFade(target)));

  const setup = (scrollers) => {
    scrollers.forEach((scroller) => {
      if (seen.has(scroller)) return;
      seen.add(scroller);

      updateFade(scroller);
      reveal(scroller, false);

      scroller.addEventListener('scroll', () => updateFade(scroller), { passive: true });
      resize.observe(scroller);

      // Whichever way a tab is opened (a click, the arrow keys, the remembered tab restored), the CMS marks it
      // .ui-tabs-active: scroll to it then, once per tab
      new MutationObserver(() => {
        if (scroller.querySelector('.ui-tabs-active') !== revealed.get(scroller)) reveal(scroller, true);
      }).observe(scroller, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  };

  DomObserver.observe(HEADER_TABS, setup);
  DomObserver.observe(FORM_TABS, setup);
}
