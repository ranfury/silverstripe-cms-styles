/* ------------------------------------------------------------------
Appearance boot

Inlined in the CMS's <head> (LeftAndMainExtension), so the saved theme colour
and light / dark mode are applied before anything is drawn (no flash of the default theme).
The appearance menu (components/appearance.js) changes them after that.

It also keeps the menu as it was left (components/menu-state.js): that has to be
in place before the admin's script reads it, which is why it's here
------------------------------------------------------------------ */

import { applyAppearance, readSettings } from './components/appearance-settings';
import keepMenuState from './components/menu-state';

applyAppearance(readSettings());
keepMenuState();
