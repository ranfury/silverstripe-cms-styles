/* ------------------------------------------------------------------
Appearance boot

Inlined in the CMS's <head> (LeftAndMainExtension), so the saved theme colour
and light / dark mode are applied before anything is drawn (no flash of the default theme).
The appearance menu (components/appearance.js) changes them after that
------------------------------------------------------------------ */

import { applyAppearance, readSettings } from './components/appearance-settings';

applyAppearance(readSettings());
