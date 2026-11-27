// My lists and playlists: index (mosaic cards + create) and detail (play all, shuffle,
// edit mode with reorder/remove, rename and delete). Everything plays through DLook.
import { h, clear } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import * as kit from '../kit.js';
import { page } from '../page.js';
import { collectionCard, workCard, coverImage, mosaic, skeletonGrid } from '../cards.js';
import * as api from '../../data/api.js';
import * as offline from '../../data/offline.js';
import { workTitle, categoryOf } from '../state.js';

export async function create(app, route) {
  const { state } = app;
  const { kind, id } = route.params;
  return id ? detail(app, state, kind, id, route) : index(app, state, kind);
}

async function resolveWorks(state, worknos) {
  return api.works(worknos, { library: state.get('library') });
}

/* ================================================================ index */

function index(app, state, kind) {
  const add = kit.iconButton('plus', t(kind === 'mylist' ? 'newMylist' : 'newPlaylist'), () => createList(), { tone: 'soft' });
  const scaffold = page(app, { title: t(kind), actions: [add], className: 'collections' });
  const grid = h('div', { class: 'grid lists-grid' });
  scaffold.content.append(grid);

  async function createList() {
    const name = await kit.promptDialog({ title: t(kind === 'mylist' ? 'newMylist' : 'newPlaylist'), label: t('listName'), confirm: t('create') });
    if (!name) return;
    try {
      await api.createCollection(kind, name);
      await state.refreshCollections(kind);
      kit.toast(name, { icon: 'plus' });
    } catch {
      kit.toast(t('createFailed'), { icon: 'warning' });
    }
  }

  async function render() {
    const lists = state.get(kind);
    if (!lists) { clear(grid, ...skeletonGrid(6).children); return; }
    if (!lists.length) {
      clear(grid);
      scaffold.content.replaceChildren(kit.emptyState(kind === 'mylist' ? 'folderStar' : 'queue', t('emptyCollections'), null,
        kit.pill('plus', t(kind === 'mylist' ? 'newMylist' : 'newPlaylist'), createList)), grid);
      return;
    }
    if (!grid.isConnected || grid.parentElement !== scaffold.content || scaffold.content.children.length > 1) scaffold.content.replaceChildren(grid);
    const worknos = lists.flatMap(list => (list.data ?? []).slice(0, 4).map(entry => typeof entry === 'string' ? entry : entry?.workno)).filter(Boolean);
    const works = await resolveWorks(state, worknos);
    const firstPaint = !grid.children.length || grid.querySelector('.shimmer');
    clear(grid, ...lists.map(list => {
      const entries = (list.data ?? []).map(entry => typeof entry === 'string' ? entry : entry?.workno).filter(Boolean);
      const unique = [...new Set(entries)];
      const urls = unique.slice(0, 4).map(workno => works.get(workno)?.image ?? works.get(workno)?.thumb);
      const sub = kind === 'mylist' ? t('count', unique.length) : `${t('trackCount', entries.length)} · ${t('count', unique.length)}`;
      return collectionCard({ title: list.title, href: `/${kind}/${list.id}`, urls, sub, kindIcon: kind === 'mylist' ? 'folderStar' : 'queue' });
    }));
    if (firstPaint) kit.stagger(grid.children);
  }

  const off = state.on(kind, () => render());
  render();
  state.loadCollections(kind).catch(() => {});
  return { node: scaffold.node, scroller: scaffold.scroller, title: t(kind), destroy: off, show: () => state.loadCollections(kind).catch(() => {}) };
}

/* ================================================================ detail */

function detail(app, state, kind, id, route) {
  let editing = false;
  const renameButton = kit.iconButton('edit', t('edit'), () => setEditing(!editing), { tone: 'soft', className: 'edit-toggle' });
  const moreButton = kit.iconButton('more', t('more'), (e, b) => openMore(b), { tone: 'soft' });
  const scaffold = page(app, { title: '', back: `/${kind}`, actions: [renameButton, moreButton], className: `collection-detail ${kind}` });
  scaffold.heading.hidden = true;
  const art = h('div', { class: 'list-art' });
  const title = h('h1', { class: 'list-title' });
  const sub = h('p', { class: 'list-sub' });
  const actions = h('div', { class: 'list-actions' },
    kit.pill('playFill', t('playAll'), () => playAll(false), { className: 'primary' }),
    kit.pill('shuffle', t('shuffle'), () => playAll(true), { tone: 'soft' }));
  const header = h('section', { class: 'list-hero' }, h('div', { class: 'list-backdrop', 'aria-hidden': 'true' }), art, h('div', { class: 'list-text' }, title, sub, actions));
  const body = h('div', { class: 'list-body' });
  scaffold.content.append(header, body);

  let list, works = new Map(), entries = [], painted = false;

  function current() {
    return (state.get(kind) ?? []).find(entry => String(entry.id) === String(id));
  }

  async function render() {
    list = current();
    if (!state.get(kind)) { clear(body, skeletonGrid(6)); return; }
    if (!list) { clear(body, kit.emptyState('warning', t('loadFailed'))); return; }
    title.textContent = list.title;
    scaffold.setTitle(list.title);
    entries = (list.data ?? []).map((entry, index) => typeof entry === 'string' ? { workno: entry, index } : { workno: entry?.workno, path: entry?.src, index: entry?.index ?? index })
      .filter(entry => entry.workno);
    const worknos = [...new Set(entries.map(entry => entry.workno))];
    works = await resolveWorks(state, worknos);
    sub.textContent = kind === 'mylist' ? t('count', worknos.length) : `${t('trackCount', entries.length)} · ${t('count', worknos.length)}`;
    const urls = worknos.slice(0, 4).map(workno => works.get(workno)?.image ?? works.get(workno)?.thumb);
    clear(art, mosaic(urls));
    const first = urls.find(Boolean);
    header.querySelector('.list-backdrop').style.backgroundImage = first ? `url(${JSON.stringify(first)})` : '';
    actions.hidden = !entries.length;
    if (!entries.length) { clear(body, kit.emptyState(kind === 'mylist' ? 'folderStar' : 'queue', t(kind === 'mylist' ? 'emptyMylist' : 'emptyPlaylist'))); return; }
    if (kind === 'mylist' && !editing) {
      const playing = app.player.current();
      const grid = h('div', { class: 'grid works-grid' }, entries.map(entry => {
        const work = works.get(entry.workno) ?? { workno: entry.workno, name: {}, authors: [] };
        return workCard(work, {
          activity: state.get('activity')?.get(entry.workno),
          playing: playing?.workno === entry.workno && playing.playing,
          onPlay: ['audio', 'video'].includes(categoryOf(work)) ? () => playFrom(entry) : undefined,
        });
      }));
      clear(body, grid);
      if (!painted) kit.stagger(grid.children);
      painted = true;
      return;
    }
    const playing = app.player.current();
    const rows = h('ol', { class: `track-list ${editing ? 'editing' : ''}` }, entries.map((entry, position) => {
      const work = works.get(entry.workno);
      const name = kind === 'playlist' ? entry.path.split('/').pop().replace(/\.[a-z0-9]{2,5}$/i, '') : workTitle(work ?? { workno: entry.workno });
      const isPlaying = playing && playing.workno === entry.workno && (kind === 'mylist' || playing.path === entry.path);
      return h('li', { class: 'track', 'data-playing': isPlaying ? '' : undefined },
        h('button', { type: 'button', class: 'track-main', disabled: editing, onclick: () => playFrom(entry, position) },
          h('span', { class: 'track-cover' }, coverImage(work?.image ?? work?.thumb), isPlaying ? h('span', { class: 'eq' }, h('i'), h('i'), h('i')) : null),
          h('span', { class: 'track-text' }, h('strong', { text: name }), h('small', { text: kind === 'playlist' ? workTitle(work ?? { workno: entry.workno }) : entry.workno }))),
        editing ? h('span', { class: 'track-edit' },
          kit.iconButton('up', t('moveUp'), () => move(position, -1), { size: 'sm', tone: 'soft', className: position === 0 ? 'invisible' : '' }),
          kit.iconButton('down', t('moveDown'), () => move(position, 1), { size: 'sm', tone: 'soft', className: position === entries.length - 1 ? 'invisible' : '' }),
          kit.iconButton('trash', t('remove'), () => remove(entry), { size: 'sm', tone: 'danger' })) : null);
    }));
    clear(body, rows);
    if (!painted) kit.stagger(rows.children, { step: 14, distance: 6 });
    painted = true;
  }

  function setEditing(on) {
    editing = on;
    clear(renameButton, icon(on ? 'check' : 'edit'));
    renameButton.setAttribute('aria-label', on ? t('done') : t('edit'));
    renameButton.title = renameButton.getAttribute('aria-label');
    renameButton.toggleAttribute('data-on', on);
    actions.hidden = on || !entries.length;
    if (!on) state.refreshCollections(kind);
    render();
  }

  async function playFrom(entry, position = 0) {
    const current = app.player.current();
    if (current && current.workno === entry.workno && (kind === 'mylist' || current.path === entry.path)) { app.player.toggle(); return; }
    const queue = kind === 'mylist' ? entries.map(item => ({ workno: item.workno })) : entries.map(item => ({ workno: item.workno, path: item.path }));
    const started = kind === 'mylist'
      ? await app.player.playEntries([{ workno: entry.workno }], { returnHref: `/${kind}/${id}`, resume: true })
      : await app.player.playEntries(queue, { index: position, returnHref: `/${kind}/${id}` });
    if (!started) {
      if (kind === 'mylist') app.go(`/work/${entry.workno}`);
      else kit.toast(t('playFailed'), { icon: 'warning' });
    }
  }

  async function playAll(shuffle) {
    if (!entries.length) return;
    const queue = kind === 'mylist' ? entries.map(item => ({ workno: item.workno })) : entries.map(item => ({ workno: item.workno, path: item.path }));
    const started = await app.player.playEntries(queue, { shuffle, returnHref: `/${kind}/${id}`, resume: false, expand: app.mode() === 'mobile' });
    if (!started) kit.toast(t('playFailed'), { icon: 'warning' });
  }

  async function move(position, delta) {
    const target = position + delta;
    if (target < 0 || target >= entries.length) return;
    const next = entries.slice();
    [next[position], next[target]] = [next[target], next[position]];
    const previous = entries;
    entries = next;
    // Optimistic update of the cached list, then the server.
    list.data = kind === 'mylist' ? next.map(entry => entry.workno) : next.map(entry => ({ workno: entry.workno, src: entry.path, index: entry.index }));
    render();
    try {
      if (kind === 'mylist') await api.reorderMylist(id, next.map(entry => entry.workno));
      else await api.reorderPlaylist(id, next.map(entry => entry.index));
    } catch {
      entries = previous;
      kit.toast(t('updateFailed'), { icon: 'warning' });
      state.refreshCollections(kind);
    }
  }

  async function remove(entry) {
    try {
      if (kind === 'mylist') await api.removeFromMylist(id, entry.workno);
      else await api.removeFromPlaylist(id, entry.index);
      await state.refreshCollections(kind);
      kit.toast(t('removed'));
    } catch {
      kit.toast(t('updateFailed'), { icon: 'warning' });
    }
  }

  function openMore(anchor) {
    kit.menu(anchor, [
      { label: t('playAll'), icon: 'playFill', disabled: !entries.length, onSelect: () => playAll(false) },
      { label: t('shuffle'), icon: 'shuffle', disabled: !entries.length, onSelect: () => playAll(true) },
      'separator',
      { label: t('edit'), icon: 'edit', onSelect: () => setEditing(true) },
      { label: t('rename'), icon: 'tag', onSelect: async () => {
        const name = await kit.promptDialog({ title: t('rename'), label: t('listName'), value: list?.title ?? '' });
        if (!name || name === list?.title) return;
        try { await api.renameCollection(kind, id, name); await state.refreshCollections(kind); } catch { kit.toast(t('updateFailed'), { icon: 'warning' }); }
      } },
      { label: t('delete'), icon: 'trash', destructive: true, onSelect: async () => {
        if (!await kit.confirmDialog({ title: t('delete'), message: t('deleteConfirm', list?.title ?? ''), confirm: t('delete'), destructive: true })) return;
        try { await api.deleteCollection(kind, id); await state.refreshCollections(kind); app.go(`/${kind}`, { replace: true }); } catch { kit.toast(t('updateFailed'), { icon: 'warning' }); }
      } },
    ], { title: list?.title });
  }

  const offs = [state.on(kind, () => render()), app.player.on('change', () => render()), app.player.on('state', () => render()), offline.onChange(() => render())];
  render();
  state.loadCollections(kind).catch(() => {});
  return { node: scaffold.node, scroller: scaffold.scroller, title: list?.title ?? t(kind), destroy: () => offs.forEach(off => off()) };
}
