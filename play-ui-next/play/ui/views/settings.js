// Settings in grouped, inset glass lists (Apple style). Account actions call the native
// DLsite Play menu entries (sync, notifications, help, DLsite, logout) just like before.
import { h, clear, formatBytes } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import * as prefs from '../../core/prefs.js';
import * as kit from '../kit.js';
import { page } from '../page.js';
import * as covers from '../../data/covers.js';
import * as offline from '../../data/offline.js';

export async function create(app) {
  const scaffold = page(app, { title: t('settings'), className: 'settings' });
  const { content } = scaffold;

  const group = (title, ...rows) => h('section', { class: 'group' }, title ? h('h2', { class: 'group-title', text: title }) : null, h('div', { class: 'group-body glass-card' }, ...rows));
  const row = ({ icon: name, tint, label, value, onClick, href, trailing, destructive, badge }) => {
    const tag = href ? 'a' : onClick ? 'button' : 'div';
    return h(tag, { class: `set-row ${destructive ? 'destructive' : ''}`, href, type: tag === 'button' ? 'button' : undefined, onclick: onClick },
      h('span', { class: `set-icon ${tint ?? ''}` }, icon(name)),
      h('span', { class: 'set-label', text: label }),
      badge ? h('i', { class: 'badge-dot static', 'aria-label': t('unread') }) : null,
      value !== undefined ? h('span', { class: 'set-value' }, value) : null,
      trailing ?? (href || onClick ? icon('forward', 'chevron') : null));
  };

  const status = h('p', { class: 'set-status', role: 'status' });
  async function nativeAction(name, success) {
    status.textContent = '';
    const done = name === 'logout' ? await app.native.withNativeDialog(() => app.native.activate('logout')) : await app.native.activate(name);
    if (!done) kit.toast(t('failed'), { icon: 'warning' });
    else if (success) kit.toast(success);
  }

  const accent = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': t('accent') }, ['blue', 'pink'].map(color =>
    h('button', { type: 'button', role: 'radio', class: `swatch ${color}`, 'aria-label': t(color), title: t(color), 'aria-checked': String(prefs.get('accent') === color),
      onclick: () => {
        prefs.set('accent', color);
        for (const swatch of accent.children) swatch.setAttribute('aria-checked', String(swatch.classList.contains(color)));
        kit.toast(t(color === 'pink' ? 'themePink' : 'themeBlue'), { icon: 'palette' });
      } }, icon('check'))));
  const appearance = kit.segmented([
    { value: 'auto', label: t('auto'), icon: 'auto' }, { value: 'light', label: t('light'), icon: 'sun' }, { value: 'dark', label: t('dark'), icon: 'moon' },
  ], prefs.get('appearance'), value => prefs.set('appearance', value), { label: t('mode'), className: 'compact' });

  const choice = (name, options) => kit.segmented(options.map(([value, label]) => ({ value, label })), String(prefs.get(name)), value => prefs.set(name, Number.isNaN(Number(value)) ? value : Number(value)), { className: 'compact' });
  const toggle = name => {
    const input = h('input', { type: 'checkbox', class: 'switch', checked: Boolean(prefs.get(name)), onchange: () => prefs.set(name, input.checked) });
    return input;
  };

  // On = follow the system's reduce-motion setting; off (default) = always animate.
  const motionToggle = () => {
    const input = h('input', { type: 'checkbox', class: 'switch', checked: prefs.get('motion') === 'system', onchange: () => prefs.set('motion', input.checked ? 'system' : 'full') });
    return input;
  };

  const coverValue = h('span', { text: '…' });
  const offlineValue = h('span', { text: '…' });
  covers.usage().then(({ count, bytes }) => { coverValue.textContent = `${count} · ${formatBytes(bytes)}`; });
  offline.usage().then(({ count, bytes }) => { offlineValue.textContent = `${t('count', count)} · ${formatBytes(bytes)}`; });

  const notificationsRow = row({ icon: 'bell', tint: 'red', label: t('notifications'), badge: app.unread, onClick: () => app.go('/notifications') });
  content.append(
    group(t('account'),
      row({ icon: 'sync', tint: 'green', label: t('sync'), onClick: async () => {
        nativeAction('sync', t('syncRequested'));
        app.state.syncLibrary().catch(() => {});
      } }),
      notificationsRow,
      row({ icon: 'help', tint: 'blue', label: t('help'), onClick: () => app.go('/help') }),
      row({ icon: 'globe', tint: 'indigo', label: t('dlsite'), href: 'https://dlaf.jp/home/dlaf/=/aid/DL00k/url/https%3A%2F%2Fwww.dlsite.com%2Fhome-touch%2Fmypage%3Futm_medium%3Daffiliate%26utm_campaign%3Dbnlink%26utm_content%3Dtext' }),
      row({ icon: 'logout', tint: 'gray', label: t('logout'), destructive: true, onClick: () => nativeAction('logout') })),
    group(t('appearance'),
      row({ icon: 'palette', tint: 'accent', label: t('accent'), trailing: accent }),
      row({ icon: 'moon', tint: 'indigo', label: t('mode'), trailing: appearance }),
      row({ icon: 'sparkle', tint: 'teal', label: t('reduceMotion'), trailing: motionToggle() })),
    group(t('playback'),
      row({ icon: 'back15', tint: 'orange', label: t('skipBack'), trailing: choice('skipBack', [[5, '5s'], [10, '10s'], [15, '15s'], [30, '30s']]) }),
      row({ icon: 'fwd30', tint: 'orange', label: t('skipForward'), trailing: choice('skipForward', [[10, '10s'], [15, '15s'], [30, '30s'], [60, '60s']]) }),
      row({ icon: 'next', tint: 'pink', label: t('autoplayNext'), trailing: toggle('autoplayNext') }),
      row({ icon: 'captions', tint: 'teal', label: t('captions'), trailing: choice('captionMode', [['off', t('captionsOff')], ['lyrics', t('captionsLyrics')], ['single', t('captionsSingle')]]) }),
      row({ icon: 'doc', tint: 'gray', label: t('hideCaptionFiles'), trailing: toggle('hideCaptionFiles') })),
    group(t('readerDefaults'),
      row({ icon: 'rtl', tint: 'purple', label: t('readDirection'), trailing: choice('readerDirection', [['rtl', '←'], ['ltr', '→']]) }),
      row({ icon: 'spread', tint: 'purple', label: t('pageMode'), trailing: choice('readerMode', [['auto', t('autoMode')], ['single', t('single')], ['spread', t('spread')], ['vertical', t('vertical')]]) })),
    group(t('cache'),
      row({ icon: 'photo', tint: 'gray', label: t('coverCache'), value: coverValue, onClick: async () => {
        if (!await kit.confirmDialog({ title: t('clearCovers'), confirm: t('delete'), destructive: true })) return;
        await covers.clearAll();
        coverValue.textContent = '0';
        kit.toast(t('cleared'));
      }, trailing: icon('trash', 'chevron') }),
      row({ icon: 'download', tint: 'blue', label: t('storageInfo'), value: offlineValue, href: offline.offlineHref })),
    status,
    h('p', { class: 'about', text: `DLook Next · ${t('version')} ${app.version}` }));

  const off = app.on('unread', () => {
    notificationsRow.querySelector('.badge-dot')?.remove();
    if (app.unread) notificationsRow.querySelector('.set-label').after(h('i', { class: 'badge-dot static', 'aria-label': t('unread') }));
  });
  kit.stagger(content.querySelectorAll('.group'), { step: 40 });
  return { node: scaffold.node, scroller: scaffold.scroller, title: t('settings'), destroy: off };
}
