/* ------------------------------------------------------------------
Small field helpers
------------------------------------------------------------------ */

import DomObserver from './dom-observer';

/* ------------------------------------------------------------------
data-icon is meant to be a single icon font character, some modules
put a name in it ("relationfind"), which would show as several icons
------------------------------------------------------------------ */

function initDataIcons() {
  DomObserver.observe('[data-icon]', (elements) => {
    elements.forEach((element) => {
      if (element.getAttribute('data-icon').length > 1) element.removeAttribute('data-icon');
    });
  });
}

/* ------------------------------------------------------------------
Character count: fields with the cms-character-count class show how long
their value is (and the limit, when they have a maxlength)
------------------------------------------------------------------ */

function initCharacterCounts() {
  DomObserver.observe('input.cms-character-count, textarea.cms-character-count', (inputs) => {
    inputs.forEach((input) => {
      if (input.nextElementSibling?.classList.contains('cms-character-count__counter')) return;

      const counter = document.createElement('span');
      const max = input.maxLength > 0 ? input.maxLength : null;

      counter.className = 'cms-character-count__counter';
      counter.setAttribute('aria-live', 'polite');

      const update = () => {
        const count = input.value.length;
        counter.textContent = max ? `${count} / ${max}` : `${count}`;
        counter.classList.toggle('is-over', !!max && count >= max);
      };

      input.addEventListener('input', update);
      input.after(counter);
      update();
    });
  });
}

/* ------------------------------------------------------------------
Range sliders: number fields with min, max and step become sliders,
showing their value (and units, from a units attribute)
------------------------------------------------------------------ */

function initRangeSliders() {
  DomObserver.observe('input[type="text"][min][max][step], input[type="number"][min][max][step]:not(.no-slider)', (inputs) => {
    inputs.forEach((input) => {
      const holder = input.parentElement;
      const units = input.getAttribute('units') || '';
      const value = (input.getAttribute('value') || '').replace(/,/g, '');

      const output = document.createElement('output');
      output.className = 'cms-range__value';
      output.htmlFor = input.id;

      input.type = 'range';
      input.classList.add('cms-range__input');
      if (value !== '') input.value = value;

      const update = () => {
        output.textContent = `${input.value}${units}`;
        // How far along the track, for its filled part
        const percent = ((input.value - input.min) / ((input.max - input.min) || 1)) * 100;
        input.style.setProperty('--_value', `${percent}%`);
      };

      input.addEventListener('input', update);
      holder.classList.add('cms-range');
      input.after(output);
      update();
    });
  });
}

/* ------------------------------------------------------------------
Field names: hovering a label shows the field's name ($Title), handy for templates
------------------------------------------------------------------ */

function initFieldNames() {
  DomObserver.observe('label', (labels) => {
    labels.forEach((label) => {
      const input = label.control;
      if (!input || !input.name || label.title) return;

      label.title = `$${input.name.replace(/\[.*$/, '')}`;
    });
  });
}

/* ------------------------------------------------------------------
Editor background: a button on html editors to see the content
on a dark background (for light text)
------------------------------------------------------------------ */

function initEditorBackground() {
  // The editing area's iframe is added after the toolbars
  DomObserver.observe('.tox-tinymce .tox-edit-area__iframe', (iframes) => {
    iframes.forEach((iframe) => {
      const toolbars = iframe.closest('.tox-tinymce').querySelectorAll('.tox-toolbar');
      const toolbar = toolbars[toolbars.length - 1];

      if (!toolbar || toolbar.querySelector('.cms-editor-background')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cms-editor-background';
      button.setAttribute('aria-pressed', 'false');
      button.textContent = 'Dark background';

      button.addEventListener('click', (e) => {
        e.preventDefault();
        const dark = button.getAttribute('aria-pressed') !== 'true';

        button.setAttribute('aria-pressed', String(dark));
        // The editor's page is transparent, the iframe's own background shows through it
        iframe.classList.toggle('cms-editor-background--dark', dark);
      });

      toolbar.append(button);
    });
  });
}

export default function initFields() {
  initDataIcons();
  initCharacterCounts();
  initRangeSliders();
  initFieldNames();
  initEditorBackground();
}
