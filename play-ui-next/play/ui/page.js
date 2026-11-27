// Page scaffold shared by views: a glass top bar that gains its blur once content scrolls
// under it, a large title that collapses into the bar (iOS style) and a scroll container.
import { h } from '../core/dom.js';
import { t } from '../core/i18n.js';
import * as kit from './kit.js';

export function page(app, { title = '', subtitle = '', back, actions = [], toolbar, className = '' } = {}) {
  const smallTitle = h('div', { class: 'bar-title', text: title });
  const backButton = back ? kit.iconButton('back', t('back'), () => typeof back === 'function' ? back() : app.back(back), { className: 'bar-back', tone: 'soft' }) : null;
  const actionsBox = h('div', { class: 'bar-actions' }, ...actions);
  const bar = h('header', { class: 'bar' }, h('div', { class: 'bar-lead' }, backButton), smallTitle, actionsBox);
  const largeTitle = h('h1', { class: 'large-title', text: title });
  const sub = h('p', { class: 'large-sub', text: subtitle, hidden: !subtitle });
  const heading = h('div', { class: 'heading' }, largeTitle, sub);
  const toolbarBox = h('div', { class: 'toolbar' }, toolbar ?? null);
  const content = h('div', { class: 'content' });
  const scroller = h('div', { class: 'scroller' }, heading, toolbarBox, content);
  const node = h('section', { class: `page ${className}`.trim() }, bar, scroller);

  let ticking = false;
  scroller.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scroller.scrollTop;
      bar.toggleAttribute('data-scrolled', y > 4);
      const threshold = Math.max(24, largeTitle.offsetHeight);
      bar.toggleAttribute('data-title', y > threshold);
      // Rubber-band style scaling of the large title on overscroll (mobile).
      if (y < 0) largeTitle.style.transform = `scale(${1 + Math.min(0.12, -y / 600)})`;
      else if (largeTitle.style.transform) largeTitle.style.transform = '';
    });
  }, { passive: true });

  return {
    node, scroller, content, bar, heading, toolbar: toolbarBox, actions: actionsBox,
    setTitle(value, subValue) {
      smallTitle.textContent = largeTitle.textContent = value;
      if (subValue !== undefined) { sub.textContent = subValue; sub.hidden = !subValue; }
    },
  };
}
