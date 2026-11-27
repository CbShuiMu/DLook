// Offline copies: storage summary, saved works grid and a per-work sheet with tracks,
// play and remove. Works without a network connection (served from IndexedDB).
import { h, clear, formatBytes } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import * as kit from '../kit.js';
import { page } from '../page.js';
import { mosaic } from '../cards.js';
import * as offline from '../../data/offline.js';
import { onMigrated } from '../../data/offline-store.js';

export async function create(app) {
  const scaffold = page(app, { title: t('offline'), className: 'offline' });
  const summary = h('div', { class: 'storage-card glass-card' });
  const notice = h('p', { class: 'notice', role: 'status', hidden: navigator.onLine });
  const grid = h('div', { class: 'grid works-grid offline-grid' });
  // On play.dlsite.com (extension): point to the extension's own offline page, which opens
  // without a network connection or access to DLsite.
  const ext = globalThis.browser ?? globalThis.chrome;
  const pageLink = app.extension && !app.standalone && ext?.runtime?.getURL
    ? h('div', { class: 'offline-page-card glass-card' },
      h('div', { class: 'storage-icon' }, icon('wifiOff')),
      h('p', { class: 'offline-page-text', text: t('offlinePageHint') }),
      kit.pill('external', t('offlinePage'), () => window.open(ext.runtime.getURL('play/offline.html'), '_blank'), { tone: 'soft' }))
    : null;
  scaffold.content.append(...[notice, summary, pageLink, grid].filter(Boolean));
  const objectUrls = new Set();

  function coverUrl(work) {
    if (!work.hasCover) return Promise.resolve(null);
    return offline.cover(work.workno).then(data => {
      if (!data?.bytes) return null;
      const url = URL.createObjectURL(new Blob([data.bytes], { type: data.type }));
      objectUrls.add(url);
      return url;
    }).catch(() => null);
  }

  async function render() {
    notice.hidden = navigator.onLine;
    notice.textContent = t('offlineNotice');
    let works;
    try { works = await offline.list(); } catch { clear(grid, kit.errorState(t('openFailed'), render)); return; }
    const bytes = works.reduce((sum, work) => sum + work.tracks.reduce((s, track) => s + (track.size || 0), 0), 0);
    const estimate = await navigator.storage?.estimate?.().catch(() => null);
    const quota = estimate?.quota;
    clear(summary,
      h('div', { class: 'storage-icon' }, icon('storage')),
      h('div', { class: 'storage-text' }, h('strong', { text: `${t('used')} ${formatBytes(bytes)}` }), h('small', { text: `${t('count', works.length)}${quota ? ` · ${formatBytes(quota)}` : ''}` })),
      h('div', { class: 'storage-bar', style: { '--p': `${quota ? Math.max(1, Math.min(100, (bytes / quota) * 100)) : 0}%` } }));
    summary.hidden = !works.length;
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    if (!works.length) { clear(grid, kit.emptyState('download', t('offline'), t('offlineEmpty'))); return; }
    const playing = app.player.current();
    clear(grid, ...works.map(work => {
      const size = work.tracks.reduce((sum, track) => sum + (track.size || 0), 0);
      const coverBox = h('div', { class: 'cover' }, h('div', { class: 'cover-ph' }, icon('headphones')),
        h('span', { class: 'badges glass-chip' }, icon('headphones'), icon('downloaded', 'badge-saved')));
      coverUrl(work).then(url => {
        if (!url) return;
        const img = h('img', { class: 'cover-img', alt: '', src: url });
        img.onload = () => img.setAttribute('data-loaded', '');
        coverBox.append(img);
      });
      const isPlaying = playing?.workno === work.workno && playing.playing;
      if (isPlaying) coverBox.append(h('span', { class: 'card-eq' }, h('i'), h('i'), h('i')));
      coverBox.append(h('button', { type: 'button', class: 'card-play', 'aria-label': t('play'), onclick: event => { event.stopPropagation(); playWork(work, 0); } }, icon(isPlaying ? 'pauseFill' : 'playFill')));
      return h('button', { type: 'button', class: 'card work-card', title: work.title, onclick: () => openWork(work) },
        coverBox,
        h('div', { class: 'card-text' },
          h('strong', { class: 'card-title', text: work.title }),
          h('small', { class: 'card-sub', text: `${t('savedCount', work.tracks.length, work.total)} · ${formatBytes(size)}` })));
    }));
    kit.stagger(grid.children);
  }

  function playWork(work, index) {
    const current = app.player.current();
    if (current?.workno === work.workno && index === 0) { app.player.toggle(); return; }
    const tracks = work.tracks.slice().sort((a, b) => a.order - b.order);
    app.player.playEntries(tracks.map(track => ({ workno: work.workno, path: offline.trackPath(track) })), { index, returnHref: offline.offlineHref, resume: true, expand: app.mode() === 'mobile' })
      .then(started => { if (!started) kit.toast(t('playFailed'), { icon: 'warning' }); });
  }

  async function openWork(work) {
    const tracks = work.tracks.slice().sort((a, b) => a.order - b.order);
    const { body, close } = kit.sheet({ title: work.title, className: 'offline-sheet', size: 'wide' });
    const url = await coverUrl(work);
    const playing = app.player.current();
    body.append(
      h('div', { class: 'sheet-hero' }, h('div', { class: 'cover' }, url ? h('img', { class: 'cover-img', src: url, alt: '', 'data-loaded': '' }) : mosaic([])),
        h('div', {}, h('strong', { text: work.title }), work.creator ? h('small', { text: work.creator }) : null,
          h('small', { text: `${t('savedCount', work.tracks.length, work.total)}` }),
          h('div', { class: 'row-actions' },
            kit.pill('playFill', t('playAll'), () => { close(); playWork(work, 0); }),
            work.workno && navigator.onLine ? kit.iconButton('library', t('details'), () => { close(); app.go(`/work/${work.workno}`); }, { tone: 'soft' }) : null))),
      h('ol', { class: 'track-list' }, tracks.map((track, index) => h('li', { class: 'track', 'data-playing': playing?.workno === work.workno && playing.path === offline.trackPath(track) ? '' : undefined },
        h('button', { type: 'button', class: 'track-main', onclick: () => { close(); playWork(work, index); } },
          h('span', { class: 'track-index', text: String(index + 1) }),
          h('span', { class: 'track-text' }, h('strong', { text: track.name.replace(/\.[a-z0-9]{2,5}$/i, '') }), h('small', { text: [track.folder, track.kind === 'video' ? t('video') : null, formatBytes(track.size)].filter(Boolean).join(' · ') })))))),
      h('div', { class: 'sheet-footer' }, kit.pill('trash', t('removeOffline'), async () => {
        if (!await kit.confirmDialog({ title: t('removeOffline'), message: t('removeOfflineConfirm', work.title), confirm: t('delete'), destructive: true })) return;
        try {
          if (app.player.current()?.workno === work.workno && !app.player.current().stream) app.player.stop();
          await offline.remove(work.workno);
          close();
          kit.toast(t('removed'));
        } catch { kit.toast(t('removeFailed'), { icon: 'warning' }); }
      }, { tone: 'danger' })));
  }

  const offs = [onMigrated(count => { kit.toast(t('offlineMigrated', count), { icon: 'downloaded' }); render(); }), offline.onChange(() => render()), app.on('network', () => render()), app.player.on('change', () => render())];
  window.addEventListener('focus', render);
  render();
  return {
    node: scaffold.node, scroller: scaffold.scroller, title: t('offline'),
    destroy() { offs.forEach(off => off()); window.removeEventListener('focus', render); for (const url of objectUrls) URL.revokeObjectURL(url); },
  };
}
