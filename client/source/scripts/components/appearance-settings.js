/* ------------------------------------------------------------------
Appearance settings: the theme colour and light / dark mode,
saved in the browser and applied to <html>
------------------------------------------------------------------ */

// The same keys the previous CMS theme module used, so people keep the colour / mode they had picked
const COLOUR_KEY = 'cms-theme-colour';
const MODE_KEY = 'silverstripe-cms-darkmode';

export const MODES = ['off', 'on', 'auto'];

// Settings from the server (the theme colours), a JSON block in the head
export function readConfig() {
  try {
    return JSON.parse(document.getElementById('CMSStylesConfig')?.textContent || '{}');
  } catch {
    return {};
  }
}

function storage(key, value) {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing etc. the setting just isn't remembered
  }

  return null;
}

export function readSettings() {
  const { colours = [] } = readConfig();
  const mode = storage(MODE_KEY);

  return {
    colour: storage(COLOUR_KEY) || colours[0] || null,
    mode: MODES.includes(mode) ? mode : 'auto',
  };
}

export function saveSettings({ colour, mode }) {
  if (colour) storage(COLOUR_KEY, colour);
  if (mode) storage(MODE_KEY, mode);
}

// WCAG relative luminance (0-1) of a hex or rgb() colour
function luminance(colour) {
  let channels = [0, 0, 0];

  if (colour.startsWith('#')) {
    const hex = colour.length === 4 ? colour.slice(1).split('').map((c) => c + c).join('') : colour.slice(1, 7);
    channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  } else {
    channels = (colour.match(/\d+/g) || []).slice(0, 3).map(Number);
  }

  const [r, g, b] = channels.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

// Black or white text, whichever has more contrast on the colour. A brightness cut-off used to pick white on the
// default #2D9CDB, 3.05:1 on the primary buttons; black there is 6.9:1
function readableOn(colour) {
  const l = luminance(colour);

  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000' : '#fff';
}

// Puts the settings on <html>: the colour as --cms-theme (every other colour is made from it, base/tokens.scss),
// text that is readable on it, and the mode (html[data-darkmode] sets the color-scheme)
export function applyAppearance({ colour, mode }) {
  const root = document.documentElement;

  if (colour) {
    const text = readableOn(colour);

    root.style.setProperty('--cms-theme', colour);
    root.style.setProperty('--cms-accent-text-colour', text);
    root.setAttribute('data-accent-contrast', text === '#000' ? 'dark' : 'light');
  }

  if (mode) root.setAttribute('data-darkmode', mode);
}
