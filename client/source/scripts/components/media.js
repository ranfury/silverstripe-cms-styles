/* ------------------------------------------------------------------
Media helpers
------------------------------------------------------------------ */

import DomObserver from './dom-observer';

/* ------------------------------------------------------------------
SVG icons (icon fields, block layout icons) are put inline,
so they take the CMS's text colour
------------------------------------------------------------------ */

const svgs = new Map();

function inlineSvg(image) {
  const src = image.currentSrc || image.src;

  if (!src || image.dataset.inlined) return;
  image.dataset.inlined = 'true';

  if (!svgs.has(src)) {
    svgs.set(src, fetch(src, { credentials: 'same-origin' }).then((response) => (response.ok ? response.text() : '')).catch(() => ''));
  }

  svgs.get(src).then((markup) => {
    if (!markup.includes('<svg')) return;

    const holder = document.createElement('span');
    holder.className = 'cms-inline-svg';
    holder.setAttribute('aria-hidden', 'true');
    holder.innerHTML = markup;

    // Scripts in an svg never run here, but are removed all the same
    holder.querySelectorAll('script').forEach((script) => script.remove());

    image.classList.add('cms-inline-svg__source');
    image.after(holder);
  });
}

/* ------------------------------------------------------------------
Image preview: the file editor's preview opens the full image
in a dialog, rather than in a new tab
------------------------------------------------------------------ */

let dialog = null;

function previewDialog() {
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.className = 'cms-image-preview';
  dialog.innerHTML = `
    <button type="button" class="btn btn-close cms-image-preview__close" aria-label="Close"></button>
    <img class="cms-image-preview__image" alt="">
  `;

  // Closes on a click anywhere outside the image too
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog.querySelector('img')) dialog.close();
  });

  document.body.append(dialog);

  return dialog;
}

function initImagePreview() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.editor__file-preview-link');

    // On phones the image just opens in a new tab
    if (!link || window.innerWidth < 768) return;

    const href = link.getAttribute('href') || '';
    if (!/\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(href)) return;

    e.preventDefault();

    const preview = previewDialog();
    preview.querySelector('img').src = href;
    preview.showModal();
  });
}

export default function initMedia() {
  DomObserver.observe('.IconField img[src*=".svg"], #Root_Templates img[src*=".svg"]', (images) => {
    images.forEach(inlineSvg);
  });

  initImagePreview();
}
