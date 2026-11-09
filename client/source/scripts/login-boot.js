/* ------------------------------------------------------------------
Login boot

Inlined in the head of the page the "session timed out" dialog shows in its iframe (CMSSecurityExtension).
That page is the same origin as the CMS, so it reads the theme colour and light / dark mode saved in the
browser by the appearance menu, and applies them as the CMS does (appearance-boot.js, without the menu's state)
------------------------------------------------------------------ */

import { applyAppearance, readSettings } from './components/appearance-settings';

applyAppearance(readSettings());
