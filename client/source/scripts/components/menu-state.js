/* ------------------------------------------------------------------
Menu state

The menu collapses to its icons from the button in its footer, and
stays as it was left. Silverstripe remembers that choice (a cookie)
but only follows it when "sticky nav" is on: otherwise it collapses
the menu itself on every screen with the pages tree and opens it on
the rest, again after every load. The module hides that switch, so it
is set here, always on, and the menu starts open until it's collapsed.

Called from the inlined boot script (appearance-boot.js), so the
cookies are there before the admin's own script reads them
------------------------------------------------------------------ */

// The admin's names (LeftAndMain.Menu.js: cms-menu-sticky, and the panel's cms-panel-collapsed-<id>)
const STICKY = 'cms-menu-sticky';
const COLLAPSED = 'cms-panel-collapsed-cms-menu';

// As the admin sets them: the whole site, for 31 days
const write = (name, value) => {
  document.cookie = `${name}=${value}; path=/; max-age=${31 * 24 * 60 * 60}; SameSite=Lax`;
};

const read = (name) => document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.split('=')[1];

export default function keepMenuState() {
  if (read(STICKY) !== 'true') write(STICKY, 'true');
  if (read(COLLAPSED) === undefined) write(COLLAPSED, 'false');
}
