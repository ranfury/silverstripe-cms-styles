/* ------------------------------------------------------------------
Code editor

Textareas with a data-language (html, css, javascript, json) get syntax
highlighting: the textarea stays where it is (it is what is saved and typed in)
with transparent text, over a highlighted copy of its code.
The code is tidied (indented) when the form is saved
------------------------------------------------------------------ */

import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import beautify from 'js-beautify';
import DomObserver from './dom-observer';

hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);

// js-beautify's formatter for each language
const FORMATTERS = {
  html: beautify.html,
  xml: beautify.html,
  css: beautify.css,
  javascript: beautify.js,
  json: beautify.js,
};

const editors = new Map();

function highlight(code, language) {
  // A trailing newline keeps the copy as tall as the textarea
  return `${hljs.highlight(code, { language, ignoreIllegals: true }).value}\n`;
}

function setup(textarea) {
  const language = hljs.getLanguage(textarea.dataset.language) ? textarea.dataset.language : 'html';
  const wrapper = document.createElement('div');
  const pre = document.createElement('pre');
  const code = document.createElement('code');

  wrapper.className = 'cms-code-editor';
  pre.className = 'cms-code-editor__highlight hljs';
  pre.setAttribute('aria-hidden', 'true');
  code.className = `language-${language}`;

  textarea.classList.add('cms-code-editor__input');
  textarea.spellcheck = false;

  textarea.before(wrapper);
  pre.append(code);
  wrapper.append(pre, textarea);

  const update = () => {
    code.innerHTML = highlight(textarea.value, language);
  };

  // The copy scrolls with the textarea
  const sync = () => {
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
  };

  textarea.addEventListener('input', update);
  textarea.addEventListener('scroll', sync, { passive: true });

  editors.set(textarea, { language, update });
  update();
}

// Tidy the code just before the form is saved
function format() {
  editors.forEach(({ language, update }, textarea) => {
    if (!textarea.isConnected) {
      editors.delete(textarea);
      return;
    }

    const formatter = FORMATTERS[language];
    if (!formatter || !textarea.value.trim()) return;

    textarea.value = formatter(textarea.value, { indent_size: 2 });
    update();
  });
}

export default function initCodeEditor() {
  DomObserver.observe('textarea[data-language]', (textareas) => {
    textareas.forEach((textarea) => {
      if (!textarea.closest('.cms-code-editor')) setup(textarea);
    });
  });

  // The form's actions are submit buttons (the CMS submits with ajax), tidy on click before that happens
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-toolbar button[type="submit"], .btn-toolbar input[type="submit"]')) format();
  }, true);
}
