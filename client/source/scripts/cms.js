/* ------------------------------------------------------------------
Silverstripe CMS Styles
------------------------------------------------------------------ */

import '../styles/cms.scss';

import DomObserver from './components/dom-observer';
import initAppearance from './components/appearance';
import initMenuIcons from './components/menu-icons';
import initFields from './components/fields';
import initTabMemory from './components/tab-memory';
import initHeaderTabs from './components/header-tabs';
import initMedia from './components/media';
import initSeoCheck from './components/seo-check';

/* ------------------------------------------------------------------
Document Setup
------------------------------------------------------------------ */

// The CMS isn't drawn until its stylesheet is applied (the critical styles, in the head, wait for this class).
// The stylesheet's own link adds it when it loads, this is only for if that doesn't happen: the page's load waits for it
window.addEventListener('load', () => document.documentElement.classList.add('cms-css'));

initAppearance();
initMenuIcons();
initFields();
initTabMemory();
initHeaderTabs();
initMedia();
initSeoCheck();

// The code editor (and its syntax highlighting) only loads on pages with a code field
let codeEditor = null;

DomObserver.observe('textarea[data-language]', () => {
  codeEditor ||= import(/* webpackChunkName: "code-editor" */ './components/code-editor').then(({ default: initCodeEditor }) => initCodeEditor());
});
