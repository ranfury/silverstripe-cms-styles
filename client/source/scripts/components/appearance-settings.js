/* ------------------------------------------------------------------
Appearance settings: the theme colour's hue and light / dark mode,
saved in the browser and applied to <html>
------------------------------------------------------------------ */

// The mode's key is the one the previous CMS theme module used, so people keep the mode they had picked
const HUE_KEY = 'cms-theme-hue';
const MODE_KEY = 'silverstripe-cms-darkmode';

export const MODES = ['off', 'on', 'auto'];

// Settings from the server (the default hue), a JSON block in the head
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
  const { hue: defaultHue } = readConfig();
  const hue = parseFloat(storage(HUE_KEY));
  const mode = storage(MODE_KEY);

  return {
    // null when there is none, the hue in base/tokens.scss is used
    hue: Number.isFinite(hue) ? hue : (defaultHue ?? null),
    mode: MODES.includes(mode) ? mode : 'auto',
  };
}

export function saveSettings({ hue, mode }) {
  if (Number.isFinite(hue)) storage(HUE_KEY, String(hue));
  if (mode) storage(MODE_KEY, mode);
}

// Puts the settings on <html>: the hue as --cms-hue (the theme colour is made from it and every other colour from that,
// base/tokens.scss) and the mode (html[data-darkmode] sets the color-scheme)
export function applyAppearance({ hue, mode }) {
  const root = document.documentElement;

  if (Number.isFinite(hue)) root.style.setProperty('--cms-hue', hue);

  if (mode) root.setAttribute('data-darkmode', mode);
}
