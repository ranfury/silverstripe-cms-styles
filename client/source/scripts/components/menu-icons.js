/* ------------------------------------------------------------------
Menu icons

Some sections use an image for their menu icon (e.g. redirects) rather than
the icon font. The image is used as a mask instead, so it takes the menu's
text colour like the other icons
------------------------------------------------------------------ */

import DomObserver from './dom-observer';

export default function initMenuIcons() {
  DomObserver.observe('.cms-menu .menu__icon:not([class*="font-icon-"])', (icons) => {
    icons.forEach((icon) => {
      const image = getComputedStyle(icon).backgroundImage;
      if (!image || image === 'none') return;

      icon.style.setProperty('--icon', image);
      icon.classList.add('menu__icon--masked');
    });
  });
}
