// Shared UI primitives: icon buttons, menus, sheets, dialogs, toasts, segmented controls.
// Overlays render into the app's overlay layer inside the shadow root.
import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import * as prefs from '../core/prefs.js';

// Motion plays by default. With the "follow system" setting on, the OS reduce-motion
// preference (e.g. Windows "Animation effects" off) turns animations down.
const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = {
  get matches() { return prefs.get('motion') === 'system' && systemReduced.matches; },
  onChange(listener) {
    systemReduced.addEventListener('change', listener);
    prefs.onChange(name => { if (name === 'motion') listener(); });
  },
};
export const spring = 'cubic-bezier(.32,.72,0,1)';
export const ease = 'cubic-bezier(.2,.8,.2,1)';
let layer, modeOf = () => 'desktop';

export function init(overlayLayer, mode) {
  layer = overlayLayer;
  modeOf = mode;
}

export const isMobile = () => modeOf() === 'mobile';

export function animate(node, frames, options = {}) {
  if (reducedMotion.matches || !node?.animate) return { finished: Promise.resolve(), cancel() {} };
  return node.animate(frames, { duration: 320, easing: spring, fill: 'both', ...options });
}

/* ------------------------------------------------------------------ buttons */

/** Round, icon-only button. `label` becomes the accessible name and tooltip. */
export function iconButton(name, label, onClick, { className = '', size = '', pressed, tone = '' } = {}) {
  const button = h('button', {
    type: 'button', class: `ib ${size} ${tone} ${className}`.trim(), 'aria-label': label, title: label,
    onclick: event => onClick?.(event, button),
  }, icon(name));
  if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed));
  return button;
}

/** Capsule button with icon and text (primary actions). */
export function pill(name, label, onClick, { className = '', tone = 'accent' } = {}) {
  return h('button', { type: 'button', class: `pill ${tone} ${className}`.trim(), onclick: event => onClick?.(event) },
    name ? icon(name) : null, h('span', { class: 'pill-label', text: label }));
}

export function spinner(className = '') {
  return h('span', { class: `spinner ${className}`.trim(), role: 'progressbar', 'aria-label': t('loading') });
}

/* ------------------------------------------------------------------ segmented control */

export function segmented(options, value, onChange, { label, className = '', iconsOnly = false } = {}) {
  const root = h('div', { class: `seg ${className}`.trim(), role: 'radiogroup', 'aria-label': label ?? '' });
  const thumb = h('span', { class: 'seg-thumb', 'aria-hidden': 'true' });
  root.append(thumb);
  const buttons = options.map(option => {
    const button = h('button', {
      type: 'button', role: 'radio', class: 'seg-item', 'aria-label': option.label, title: iconsOnly ? option.label : undefined,
      onclick: () => select(option.value, true),
    }, option.icon ? icon(option.icon) : null, iconsOnly ? null : h('span', { text: option.label }));
    button.dataset.value = option.value;
    root.append(button);
    return button;
  });
  function place(animated) {
    const active = buttons.find(button => button.getAttribute('aria-checked') === 'true');
    if (!active || !active.offsetWidth) return;
    thumb.style.transition = animated && !reducedMotion.matches ? '' : 'none';
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
  }
  function select(next, user = false) {
    for (const button of buttons) button.setAttribute('aria-checked', String(button.dataset.value === String(next)));
    requestAnimationFrame(() => place(user));
    if (user) onChange?.(next);
  }
  new ResizeObserver(() => place(false)).observe(root);
  select(value);
  root.select = select;
  return root;
}

/* ------------------------------------------------------------------ toast */

let toastTimer;
export function toast(message, { icon: name = 'check', duration = 2400 } = {}) {
  if (!layer || !message) return;
  layer.querySelector('.toast')?.remove();
  const node = h('div', { class: 'toast glass', role: 'status' }, name ? icon(name) : null, h('span', { text: message }));
  layer.append(node);
  animate(node, [{ opacity: 0, transform: 'translate(-50%, 12px) scale(.96)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }], { duration: 360 });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    animate(node, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, 8px) scale(.98)' }], { duration: 220, easing: 'ease-in' })
      .finished.then(() => node.remove(), () => node.remove());
  }, duration);
}

/* ------------------------------------------------------------------ overlay base */

function overlay({ className, onClose, modal = true }) {
  const scrim = h('div', { class: `scrim ${modal ? '' : 'clear'}`.trim() });
  const root = h('div', { class: `overlay ${className}` }, scrim);
  let closing;
  const close = async value => {
    if (closing) return closing;
    closing = (async () => {
      root.dispatchEvent(new CustomEvent('closing'));
      await root.leave?.();
      root.remove();
      document.removeEventListener('keydown', keys, true);
      previousFocus?.focus?.({ preventScroll: true });
      onClose?.(value);
    })();
    return closing;
  };
  const keys = event => {
    if (event.key === 'Escape' && root.isConnected && layer.lastElementChild === root) {
      event.stopPropagation();
      event.preventDefault();
      close(null);
    }
  };
  const previousFocus = layer?.getRootNode()?.activeElement;
  scrim.addEventListener('click', () => close(null));
  document.addEventListener('keydown', keys, true);
  layer.append(root);
  return { root, scrim, close };
}

/* ------------------------------------------------------------------ menu */

/**
 * Glass popover menu anchored to `anchor` (desktop) or an action sheet (mobile).
 * items: { icon, label, onSelect, checked, destructive, disabled, hint } | 'separator' | { section }
 */
export function menu(anchor, items, { title, align = 'end' } = {}) {
  const mobile = isMobile();
  const { root, scrim, close } = overlay({ className: mobile ? 'menu-sheet' : 'menu-pop', modal: mobile });
  const panel = h('div', { class: 'menu glass', role: 'menu', 'aria-label': title ?? '' });
  if (title && mobile) panel.append(h('div', { class: 'menu-title', text: title }));
  const controls = [];
  for (const item of items) {
    if (!item) continue;
    if (item === 'separator') { panel.append(h('div', { class: 'menu-sep', role: 'separator' })); continue; }
    if (item.section) { panel.append(h('div', { class: 'menu-section', text: item.section })); continue; }
    const control = h('button', {
      type: 'button', role: item.checked === undefined ? 'menuitem' : 'menuitemradio', class: `menu-item ${item.destructive ? 'destructive' : ''}`,
      disabled: item.disabled,
      onclick: async () => {
        await close(true);
        item.onSelect?.();
      },
    },
    h('span', { class: 'menu-icon' }, item.icon ? icon(item.icon) : null),
    h('span', { class: 'menu-label' }, item.label, item.hint ? h('small', { text: item.hint }) : null),
    item.checked !== undefined ? h('span', { class: 'menu-check' }, item.checked ? icon('check') : null) : null);
    if (item.checked !== undefined) control.setAttribute('aria-checked', String(Boolean(item.checked)));
    controls.push(control);
    panel.append(control);
  }
  if (mobile) panel.append(h('button', { type: 'button', class: 'menu-cancel', text: t('cancel'), onclick: () => close(null) }));
  root.append(panel);

  if (!mobile && anchor) {
    const box = anchor.getBoundingClientRect();
    const host = layer.getBoundingClientRect();
    panel.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const width = panel.offsetWidth, height = panel.offsetHeight;
      let left = align === 'start' ? box.left : box.right - width;
      left = Math.max(8, Math.min(left, host.width - width - 8));
      let top = box.bottom + 8;
      const above = top + height > host.height - 8;
      if (above) top = Math.max(8, box.top - height - 8);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.transformOrigin = `${align === 'start' ? 'left' : 'right'} ${above ? 'bottom' : 'top'}`;
      panel.style.visibility = '';
      animate(panel, [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260 });
    });
    root.leave = () => animate(panel, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 140, easing: 'ease-in' }).finished.catch(() => {});
  } else {
    animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    animate(panel, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], { duration: 420 });
    root.leave = () => Promise.all([
      animate(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in' }).finished,
      animate(panel, [{ transform: 'translateY(0)' }, { transform: 'translateY(105%)' }], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)' }).finished,
    ]).catch(() => {});
  }
  panel.addEventListener('keydown', event => {
    const index = controls.indexOf(event.target);
    if (event.key === 'ArrowDown') { event.preventDefault(); controls[(index + 1) % controls.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); controls[(index - 1 + controls.length) % controls.length]?.focus(); }
  });
  requestAnimationFrame(() => (controls.find(c => c.getAttribute('aria-checked') === 'true') ?? controls[0])?.focus({ preventScroll: true }));
  return close;
}

/* ------------------------------------------------------------------ sheet / dialog */

/**
 * A panel that is a bottom sheet on phones (drag down to dismiss) and a centered glass
 * dialog on desktop. Returns { body, close, root }.
 */
export function sheet({ title, className = '', actions = [], onClose, size = '' } = {}) {
  const mobile = isMobile();
  const { root, scrim, close } = overlay({ className: `sheet-layer ${mobile ? 'as-sheet' : 'as-dialog'}`, onClose });
  const body = h('div', { class: 'sheet-body' });
  const header = h('header', { class: 'sheet-head' },
    mobile ? h('span', { class: 'grabber', 'aria-hidden': 'true' }) : null,
    h('h2', { class: 'sheet-title', text: title ?? '' }),
    h('div', { class: 'sheet-actions' }, ...actions, iconButton('close', t('close'), () => close(null), { size: 'sm', tone: 'soft' })));
  const panel = h('section', { class: `sheet glass ${className} ${size}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-label': title ?? '' }, header, body);
  root.append(panel);
  animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  if (mobile) {
    animate(panel, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 460 });
    root.leave = () => Promise.all([
      animate(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).finished,
      animate(panel, [{ transform: getComputedStyle(panel).transform === 'none' ? 'translateY(0)' : getComputedStyle(panel).transform }, { transform: 'translateY(100%)' }], { duration: 280, easing: 'cubic-bezier(.4,0,1,1)' }).finished,
    ]).catch(() => {});
    dragToDismiss(panel, header, () => close(null));
  } else {
    animate(panel, [{ opacity: 0, transform: 'scale(.94) translateY(8px)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }], { duration: 380 });
    root.leave = () => Promise.all([
      animate(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).finished,
      animate(panel, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 180, easing: 'ease-in' }).finished,
    ]).catch(() => {});
  }
  return { body, close, root, panel };
}

/** Lets a sheet follow the finger downwards and dismiss past a threshold. */
export function dragToDismiss(panel, handle, dismiss, { threshold = 120 } = {}) {
  let start, dy = 0, startTime = 0;
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    start = event.clientY;
    dy = 0;
    startTime = performance.now();
    handle.setPointerCapture(event.pointerId);
    panel.style.transition = 'none';
  });
  handle.addEventListener('pointermove', event => {
    if (start === undefined) return;
    dy = Math.max(0, event.clientY - start);
    panel.style.transform = `translateY(${dy - Math.min(0, event.clientY - start) * 0}px)`;
  });
  const end = () => {
    if (start === undefined) return;
    start = undefined;
    const velocity = dy / Math.max(1, performance.now() - startTime);
    panel.style.transition = '';
    if (dy > threshold || velocity > .6) dismiss();
    else {
      animate(panel, [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 320 });
      panel.style.transform = '';
    }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function alertLayer(panelOf) {
  return new Promise(resolve => {
    const scrim = h('div', { class: 'scrim' });
    const root = h('div', { class: 'overlay alert-layer' }, scrim);
    const previous = layer.getRootNode()?.activeElement;
    let done = false, panel;
    const finish = value => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', keys, true);
      animate(panel, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 160, easing: 'ease-in' })
        .finished.catch(() => {}).then(() => { root.remove(); previous?.focus?.({ preventScroll: true }); });
      resolve(value);
    };
    const keys = event => {
      if (event.key !== 'Escape' || layer.lastElementChild !== root) return;
      event.stopPropagation();
      event.preventDefault();
      finish(null);
    };
    document.addEventListener('keydown', keys, true);
    scrim.addEventListener('click', () => finish(null));
    panel = panelOf(finish);
    root.append(panel);
    layer.append(root);
    animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    animate(panel, [{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320 });
  });
}

export async function confirmDialog({ title, message, confirm = t('confirm'), destructive = false }) {
  const result = await alertLayer(finish => {
    const panel = h('div', { class: 'alert glass', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
      h('h2', { text: title }), message ? h('p', { text: message }) : null,
      h('div', { class: 'alert-actions' },
        h('button', { type: 'button', class: 'alert-btn', text: t('cancel'), onclick: () => finish(false) }),
        h('button', { type: 'button', class: `alert-btn strong ${destructive ? 'destructive' : ''}`, text: confirm, onclick: () => finish(true) })));
    requestAnimationFrame(() => panel.querySelector('.strong').focus());
    return panel;
  });
  return result === true;
}

export function promptDialog({ title, label, value = '', confirm = t('save'), maxLength = 255 }) {
  return alertLayer(finish => {
    const input = h('input', { type: 'text', class: 'field', maxLength, placeholder: label, 'aria-label': label, value });
    const submit = h('button', { type: 'submit', class: 'alert-btn strong', text: confirm, disabled: !value.trim() });
    input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
    const form = h('form', { class: 'alert glass', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
      onsubmit: event => { event.preventDefault(); if (input.value.trim()) finish(input.value.trim()); } },
      h('h2', { text: title }), input,
      h('div', { class: 'alert-actions' }, h('button', { type: 'button', class: 'alert-btn', text: t('cancel'), onclick: () => finish(null) }), submit));
    requestAnimationFrame(() => { input.focus(); input.select(); });
    return form;
  });
}

/* ------------------------------------------------------------------ states */

export function emptyState(name, title, hint, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-icon' }, icon(name)),
    h('h3', { text: title }), hint ? h('p', { text: hint }) : null, action ?? null);
}

export function errorState(message, retry) {
  return emptyState('warning', t('loadFailed'), message, retry ? pill('sync', t('retry'), retry, { tone: 'soft' }) : null);
}

/** Staggered entrance for freshly rendered children (cards, rows). */
export function stagger(nodes, { step = 18, max = 14, distance = 10 } = {}) {
  if (reducedMotion.matches) return;
  [...nodes].slice(0, max).forEach((node, index) => {
    node.animate?.([{ opacity: 0, transform: `translateY(${distance}px) scale(.985)` }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: index * step, easing: spring, fill: 'backwards' });
  });
}

/** Crossfades `container` content to `next`. */
export function swap(container, next) {
  if (reducedMotion.matches || !container.firstChild) { clear(container, next); return; }
  clear(container, next);
  animate(next, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, fill: 'backwards' });
}
