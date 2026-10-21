/* ------------------------------------------------------------------
SEO check (the CMS side)

When the page preview has loaded, it asks it to check the page's headings.
The preview side (preview.js) looks and shows any problems as CMS toasts
------------------------------------------------------------------ */

function previewWindow() {
  const iframe = document.querySelector('.cms-preview iframe');
  return iframe?.contentWindow || null;
}

export default function initSeoCheck() {
  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin || e.data?.action !== 'seo-check-ready') return;

    previewWindow()?.postMessage({ action: 'checkSEO' }, window.location.origin);
  });
}
