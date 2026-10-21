/* ------------------------------------------------------------------
Header tabs

When there are more header tabs than fit they scroll sideways: an edge
fades while there are more tabs that way (.has-more-start / .has-more-end,
abstracts/mixins: scroll-fade), and the open tab is scrolled into view
------------------------------------------------------------------ */

import DomObserver from './dom-observer';

function updateFade(scroller) {
  const max = scroller.scrollWidth - scroller.clientWidth;

  scroller.classList.toggle('has-more-start', scroller.scrollLeft > 1);
  scroller.classList.toggle('has-more-end', scroller.scrollLeft < max - 1);
}

function reveal(scroller) {
  const active = scroller.querySelector('.ui-tabs-active');
  if (!active || scroller.scrollWidth <= scroller.clientWidth) return;

  active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

export default function initHeaderTabs() {
  const resize = new ResizeObserver((entries) => entries.forEach(({ target }) => updateFade(target)));

  DomObserver.observe('.cms-content-header-tabs', (scrollers) => {
    scrollers.forEach((scroller) => {
      updateFade(scroller);
      reveal(scroller);

      scroller.addEventListener('scroll', () => updateFade(scroller), { passive: true });
      scroller.addEventListener('click', () => requestAnimationFrame(() => reveal(scroller)));
      resize.observe(scroller);
    });
  });
}
