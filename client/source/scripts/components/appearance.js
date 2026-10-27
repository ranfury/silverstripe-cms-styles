/* ------------------------------------------------------------------
Appearance menu

A button in the menu's footer opening a popover to pick light / dark / system,
and the theme colour (its hue, on a slider).
The choice is saved in the browser and applied straight away
------------------------------------------------------------------ */

import DomObserver from './dom-observer';
import {
  MODES, applyAppearance, readSettings, saveSettings,
} from './appearance-settings';

const MODE_LABELS = {
  off: 'Light',
  on: 'Dark',
  auto: 'System',
};

const MODE_ICONS = {
  off: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"/></svg>',
  on: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5Z"/></svg>',
  auto: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 17h6M10 13.5V17"/></svg>',
};

let menuCount = 0;

function render(holder) {
  const id = `CMSAppearance${menuCount += 1}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'cms-appearance';
  wrapper.innerHTML = `
    <button type="button" class="cms-appearance__toggle" popovertarget="${id}" aria-label="Appearance" title="Appearance">
      <span class="cms-appearance__swatch" aria-hidden="true"></span>
    </button>

    <div id="${id}" class="cms-appearance__menu" popover>
      <p class="cms-appearance__heading">Appearance</p>

      <div class="cms-appearance__modes" role="group" aria-label="Light or dark">
        ${MODES.map((mode) => `
          <button type="button" class="cms-appearance__mode" data-mode="${mode}" aria-pressed="false">
            ${MODE_ICONS[mode]}
            <span>${MODE_LABELS[mode]}</span>
          </button>
        `).join('')}
      </div>

      <p class="cms-appearance__heading">Theme colour</p>

      <input type="range" class="cms-appearance__hue" min="0" max="360" step="1" value="250" aria-label="Theme colour">
    </div>
  `;

  const toggle = wrapper.querySelector('.cms-appearance__toggle');
  const menu = wrapper.querySelector('.cms-appearance__menu');
  const slider = wrapper.querySelector('.cms-appearance__hue');

  // Show which mode / hue is picked
  const update = () => {
    const { hue, mode } = readSettings();

    wrapper.querySelectorAll('[data-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });

    if (Number.isFinite(hue)) slider.value = hue;
  };

  const choose = (settings) => {
    saveSettings(settings);
    applyAppearance(settings);
    update();
  };

  wrapper.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => choose({ mode: button.dataset.mode }));
  });

  slider.addEventListener('input', () => choose({ hue: Number(slider.value) }));

  // The popover opens above its button (it is in the top layer, so it is placed from the button's position)
  menu.addEventListener('beforetoggle', (e) => {
    if (e.newState !== 'open') return;

    const rect = toggle.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.left)}px`;
    menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    update();
  });

  update();
  holder.prepend(wrapper);
}

export default function initAppearance() {
  DomObserver.observe('.cms-menu .cms-panel-toggle', (holders) => {
    holders.forEach((holder) => {
      if (!holder.querySelector('.cms-appearance')) render(holder);
    });
  });

  // Follow the system setting live while on "System"
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyAppearance(readSettings()));
}
