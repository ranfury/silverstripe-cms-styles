/* ------------------------------------------------------------------
Dev pages (dev/build, tasks...)
------------------------------------------------------------------ */

import '../styles/dev.scss';

// dev/build writes its progress as it goes: keep the newest line in view,
// until scrolling up to read something
if (window.location.pathname.replace(/\/$/, '').endsWith('/dev/build')) {
  const follow = new MutationObserver(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });

  follow.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('wheel', (e) => {
    if (e.deltaY < 0) follow.disconnect();
  }, { passive: true });
}
