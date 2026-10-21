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

// Perceived brightness (0-255) of a hex or rgb() colour
function brightness(colour) {
  let r = 0;
  let g = 0;
  let b = 0;

  if (colour.startsWith('#')) {
    const hex = colour.length === 4 ? colour.slice(1).split('').map((c) => c + c).join('') : colour.slice(1, 7);
    [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  } else {
    [r, g, b] = (colour.match(/\d+/g) || []).map(Number);
  }

  return ((r * 299) + (g * 587) + (b * 114)) / 1000;
}

// Puts the settings on <html>: the colour as --cms-theme (every other colour is made from it, base/tokens.scss),
// text that is readable on it, and the mode (html[data-darkmode] sets the color-scheme)
export function applyAppearance({ colour, mode }) {
  const root = document.documentElement;

  if (colour) {
    const light = brightness(colour) > 140;

    root.style.setProperty('--cms-theme', colour);
    root.style.setProperty('--cms-accent-text-colour', light ? '#000' : '#fff');
    root.setAttribute('data-accent-contrast', light ? 'dark' : 'light');
  }

  if (mode) root.setAttribute('data-darkmode', mode);
}
