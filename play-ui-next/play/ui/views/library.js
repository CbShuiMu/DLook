// Library: works / circles / voices, category filters, search, sort, layout and the
// "continue" shelf. Data comes from the shared cache; filtering happens locally.
import { h, clear, debounce, scrollWithin } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import * as prefs from '../../core/prefs.js';
import * as kit from '../kit.js';
import { page } from '../page.js';
import { workCard, workRow, personCard, skeletonGrid } from '../cards.js';
import * as offline from '../../data/offline.js';
import * as api from '../../data/api.js';
import { workTitle, circleOf, authorNames, categoryOf, searchText } from '../state.js';

const CATEGORIES = [
  { value: 'all', icon: 'grid' },
  { value: 'audio', icon: 'headphones' },
  { value: 'video', icon: 'film' },
  { value: 'comic', icon: 'book' },
  { value: 'other', icon: 'sparkle' },
];
const SORTS = ['purchased', 'purchasedOld', 'release', 'title', 'circle', 'recent'];
const SORT_LABELS = { purchased: 'sortPurchased', purchasedOld: 'sortPurchasedOld', release: 'sortRelease', title: 'sortTitle', circle: 'sortCircle', recent: 'sortRecent' };
const BATCH = 48;

export async function create(app, route) {
  const { state } = app;
  const params = route.params;
  const isPerson = params.person !== undefined;
  const isHidden = params.view === 'hidden';
  // A circle / voice actor page lists that person's works.
  let view = isHidden || isPerson ? 'works' : params.view;
  let query = '';
  let savedWorks = new Set();
  offline.list().then(list => { savedWorks = new Set(list.map(work => work.workno)); schedule(); }).catch(() => {});

  /* ---------------- header & toolbar */
  const searchInput = h('input', { type: 'search', class: 'search-input', placeholder: t('searchPlaceholder'), 'aria-label': t('search'), enterkeyhint: 'search', autocomplete: 'off', spellcheck: false });
  const clearSearch = kit.iconButton('close', t('close'), () => { searchInput.value = ''; onSearch(); searchInput.focus(); }, { className: 'search-clear', size: 'xs' });
  const search = h('label', { class: 'search glass-field' }, icon('search'), searchInput, clearSearch);
  const onSearch = debounce(() => { query = searchInput.value.trim().normalize('NFKC').toLowerCase(); search.toggleAttribute('data-filled', Boolean(query)); render(); }, 120);
  searchInput.addEventListener('input', () => { search.toggleAttribute('data-filled', Boolean(searchInput.value)); onSearch(); });
  searchInput.addEventListener('keydown', event => { if (event.key === 'Escape' && searchInput.value) { event.stopPropagation(); searchInput.value = ''; onSearch(); } });

  const viewSwitch = kit.segmented([
    { value: 'works', label: t('works'), icon: 'grid' },
    { value: 'circles', label: t('circles'), icon: 'people' },
    { value: 'voices', label: t('voices'), icon: 'mic' },
  ], view, value => app.go(value === 'works' ? '/' : value === 'circles' ? '/library/author' : '/library/voice'), { className: 'view-switch', label: t('library') });

  const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t('type') });
  const chipButtons = CATEGORIES.map(category => {
    const button = h('button', { type: 'button', role: 'radio', class: 'chip', dataset: { value: category.value },
      onclick: () => { prefs.set('libraryCategory', category.value); syncChips(true); render(); } },
    icon(category.icon), h('span', { class: 'chip-label', text: t(category.value) }), h('span', { class: 'chip-count' }));
    chips.append(button);
    return button;
  });
  function syncChips(scroll = false) {
    const current = prefs.get('libraryCategory');
    for (const button of chipButtons) {
      const on = button.dataset.value === current;
      button.setAttribute('aria-checked', String(on));
      if (on && scroll) scrollWithin(chips, button, { block: null, inline: 'center', behavior: 'smooth' });
    }
  }

  const sortButton = kit.iconButton('sort', t('sort'), (e, button) => openSort(button), { tone: 'soft' });
  const moreButton = kit.iconButton('more', t('more'), (e, button) => openMore(button), { tone: 'soft' });
  const searchToggle = kit.iconButton('search', t('search'), () => { toolbar.toggleAttribute('data-search', !toolbar.hasAttribute('data-search')); if (toolbar.hasAttribute('data-search')) searchInput.focus(); }, { className: 'search-toggle', tone: 'soft' });
  const syncLine = h('div', { class: 'sync-line', role: 'status', hidden: true }, kit.spinner('sm'), h('span'));

  const toolbar = h('div', { class: 'library-tools' },
    h('div', { class: 'tools-row' }, isPerson || isHidden ? null : viewSwitch, search),
    view === 'works' && !isPerson ? chips : null, syncLine);
  if (route.params.view !== 'works' && !isPerson) toolbar.setAttribute('data-people', '');

  const titleText = isHidden ? t('hidden') : isPerson ? params.person : t('library');
  const scaffold = page(app, {
    title: titleText,
    back: isPerson || isHidden ? (params.view === 'voices' ? '/library/voice' : params.view === 'circles' ? '/library/author' : '/') : undefined,
    actions: [searchToggle, view === 'works' ? sortButton : null, moreButton].filter(Boolean),
    toolbar,
    className: 'library',
  });
  const { node, scroller, content } = scaffold;
  const shelf = h('section', { class: 'shelf', hidden: true });
  const results = h('div', { class: 'results' });
  const sentinel = h('div', { class: 'sentinel', 'aria-hidden': 'true' });
  content.append(shelf, results, sentinel);

  /* ---------------- menus */
  function openSort(anchor) {
    kit.menu(anchor, [
      { section: t('sort') },
      ...SORTS.map(sort => ({ label: t(SORT_LABELS[sort]), checked: prefs.get('librarySort') === sort, onSelect: () => { prefs.set('librarySort', sort); render(); } })),
      'separator',
      { section: t('layout') },
      { label: t('layoutGrid'), icon: 'grid', checked: prefs.get('libraryLayout') === 'grid', onSelect: () => { prefs.set('libraryLayout', 'grid'); render(); } },
      { label: t('layoutList'), icon: 'list', checked: prefs.get('libraryLayout') === 'list', onSelect: () => { prefs.set('libraryLayout', 'list'); render(); } },
    ], { title: t('sort') });
  }
  function openMore(anchor) {
    const sync = state.get('sync');
    kit.menu(anchor, [
      { label: t('sync'), icon: 'sync', disabled: sync.running || !navigator.onLine, onSelect: () => syncNow() },
      { label: t('showHidden'), icon: 'eyeOff', hint: state.get('hidden')?.size ? String(state.get('hidden').size) : undefined, onSelect: () => app.go('/library/hidden') },
      'separator',
      { section: t('density') },
      { label: t('comfortable'), checked: prefs.get('libraryDensity') === 'comfortable', onSelect: () => { prefs.set('libraryDensity', 'comfortable'); applyDensity(); } },
      { label: t('compact'), checked: prefs.get('libraryDensity') === 'compact', onSelect: () => { prefs.set('libraryDensity', 'compact'); applyDensity(); } },
    ], { title: t('more') });
  }
  async function syncNow() {
    app.native.activate('sync').catch(() => {});
    try { await state.syncLibrary(); kit.toast(t('synced')); } catch { kit.toast(t('syncFailed'), { icon: 'warning' }); }
  }
  function applyDensity() { node.dataset.density = prefs.get('libraryDensity'); }
  applyDensity();

  /* ---------------- data shaping */
  function visibleWorks() {
    const library = state.get('library');
    if (!library) return null;
    const hidden = state.get('hidden') ?? new Set();
    let works = library.works.filter(work => isHidden ? hidden.has(work.workno) : !hidden.has(work.workno));
    if (isPerson) {
      works = works.filter(work => params.view === 'voices'
        ? authorNames(work).includes(params.person)
        : circleOf(work)?.name === params.person || (work.workno.startsWith('BJ') && authorNames(work).includes(params.person)));
    }
    return works;
  }
  function counts(works) {
    const result = { all: works.length, audio: 0, video: 0, comic: 0, other: 0 };
    for (const work of works) result[categoryOf(work)]++;
    return result;
  }
  function sorted(works) {
    const sort = prefs.get('librarySort');
    const activity = state.get('activity') ?? new Map();
    const title = work => workTitle(work);
    const compare = {
      purchased: (a, b) => b.purchased - a.purchased,
      purchasedOld: (a, b) => a.purchased - b.purchased,
      release: (a, b) => b.released - a.released,
      title: (a, b) => (a.phonetic || title(a)).localeCompare(b.phonetic || title(b), 'ja'),
      circle: (a, b) => (circleOf(a)?.name ?? '').localeCompare(circleOf(b)?.name ?? '', 'ja') || b.purchased - a.purchased,
      recent: (a, b) => (Date.parse(activity.get(b.workno)?.last_accessed_at ?? 0) || 0) - (Date.parse(activity.get(a.workno)?.last_accessed_at ?? 0) || 0) || b.purchased - a.purchased,
    }[sort] ?? (() => 0);
    return works.slice().sort((a, b) => compare(a, b) || a.workno.localeCompare(b.workno));
  }
  function people(works, kind) {
    const groups = new Map();
    for (const work of works) {
      const names = kind === 'voices' ? (work.workno.startsWith('BJ') ? [] : authorNames(work))
        : [circleOf(work)?.name, ...(work.workno.startsWith('BJ') ? authorNames(work) : [])].filter(Boolean);
      for (const name of new Set(names)) {
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(work);
      }
    }
    return [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ja'));
  }

  /* ---------------- rendering */
  let pending = [], rendered = 0, renderMode = '';
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) more(); }, { root: scroller, rootMargin: '900px 0px' });
  observer.observe(sentinel);

  function more() {
    if (rendered >= pending.length) return;
    const container = results.firstElementChild;
    if (!container) return;
    const slice = pending.slice(rendered, rendered + BATCH);
    rendered += slice.length;
    const nodes = slice.map(build);
    container.append(...nodes);
  }

  let build = () => null;
  function render() {
    const works = visibleWorks();
    const sync = state.get('sync');
    if (!works) { clear(results, skeletonGrid(prefs.get('libraryLayout') === 'list' ? 8 : 12)); return; }
    syncChips();
    const category = prefs.get('libraryCategory');
    const activity = state.get('activity') ?? new Map();
    const playing = app.player.current();
    if (view === 'works') {
      const tally = counts(works);
      for (const button of chipButtons) {
        button.querySelector('.chip-count').textContent = tally[button.dataset.value] ? String(tally[button.dataset.value]) : '';
        button.hidden = button.dataset.value !== 'all' && !tally[button.dataset.value] && button.dataset.value !== category;
      }
      let list = category === 'all' || isPerson ? works : works.filter(work => categoryOf(work) === category);
      if (query) list = list.filter(work => searchText(work).includes(query));
      pending = sorted(list);
      const layout = prefs.get('libraryLayout');
      renderMode = `works-${layout}`;
      build = work => layout === 'list'
        ? workRow(work, { activity: activity.get(work.workno), saved: savedWorks.has(work.workno) })
        : workCard(work, {
          activity: activity.get(work.workno), saved: savedWorks.has(work.workno),
          playing: playing?.workno === work.workno && playing.playing,
          onPlay: ['audio', 'video'].includes(categoryOf(work)) ? () => quickPlay(work) : undefined,
        });
      const container = h('div', { class: layout === 'list' ? 'rows' : 'grid works-grid' });
      clear(results, container);
      rendered = 0;
      if (!pending.length) {
        clear(results, query || category !== 'all'
          ? kit.emptyState('search', t('noResults'))
          : isHidden ? kit.emptyState('eyeOff', t('hidden'))
            : library().failed ? kit.errorState(t('syncFailed'), () => state.loadLibrary({ force: true }).then(render, render))
              : sync.running ? h('div', { class: 'loading-block' }, kit.spinner(), h('p', { text: t('syncing', sync.value, sync.max) }))
                : kit.emptyState('library', t('emptyLibrary'), t('emptyLibraryHint'), kit.pill('sync', t('sync'), () => syncNow(), { tone: 'soft' })));
      } else {
        more();
        if (!kit.reducedMotion.matches) kit.stagger(container.children);
      }
    } else {
      let groups = people(works, view);
      if (query) groups = groups.filter(([name]) => name.normalize('NFKC').toLowerCase().includes(query));
      pending = groups;
      renderMode = view;
      build = ([name, list]) => personCard(name, list, `/library/${view === 'voices' ? 'voice' : 'author'}/${encodeURIComponent(name)}`);
      const container = h('div', { class: 'grid people-grid' });
      clear(results, container);
      rendered = 0;
      if (!pending.length) clear(results, kit.emptyState(view === 'voices' ? 'mic' : 'people', query ? t('noResults') : t('emptyLibrary')));
      else { more(); kit.stagger(container.children); }
    }
    renderShelf();
    scaffold.setTitle(titleText, isPerson || isHidden ? t('count', works.length) : works.length ? t('count', works.length) : '');
  }
  const library = () => state.get('library') ?? {};
  let dirty = false;
  const rerender = debounce(render, 60);
  // While the page is cached off-screen, only remember that it needs a refresh.
  const schedule = () => { if (node.isConnected) rerender(); else dirty = true; };

  /* ---------------- continue shelf */
  const extra = new Map(), requested = new Set();
  function renderShelf() {
    const show = view === 'works' && !isPerson && !isHidden && !query && prefs.get('libraryCategory') === 'all';
    const activity = state.get('activity');
    const history = state.get('history') ?? [];
    const library = state.get('library');
    if (!show || !activity || !library) { shelf.hidden = true; return; }
    const known = new Map(library.works.map(work => [work.workno, work]));
    const recent = [...activity.values()]
      .filter(item => item.progress_status === 1 && Number(item.progress_percentage) < 100)
      .sort((a, b) => Date.parse(b.last_accessed_at) - Date.parse(a.last_accessed_at))
      .map(item => item.workno);
    for (const entry of history) if (!recent.includes(entry.workno)) recent.push(entry.workno);
    // Works opened recently may not be in the synced library (e.g. accessible through
    // another entitlement); resolve their basic info once and keep it cached.
    const missing = recent.slice(0, 12).filter(workno => !known.has(workno) && !extra.has(workno) && !requested.has(workno));
    if (missing.length && navigator.onLine) {
      missing.forEach(workno => requested.add(workno));
      api.works(missing).then(found => { for (const [workno, work] of found) extra.set(workno, work); if (found.size) schedule(); }).catch(() => {});
    }
    const works = recent.map(workno => known.get(workno) ?? extra.get(workno)).filter(Boolean).slice(0, 12);
    if (!works.length) { shelf.hidden = true; return; }
    shelf.hidden = false;
    const playing = app.player.current();
    clear(shelf, h('div', { class: 'section-head' }, h('h2', { text: t('continue') })),
      h('div', { class: 'shelf-row', role: 'list' }, works.map(work => {
        const card = workCard(work, {
          activity: activity.get(work.workno), saved: savedWorks.has(work.workno),
          playing: playing?.workno === work.workno && playing.playing,
          onPlay: ['audio', 'video'].includes(categoryOf(work)) ? () => quickPlay(work) : undefined,
        });
        card.setAttribute('role', 'listitem');
        return card;
      })));
  }

  /** Resumes a work straight from its card (DLsite Play's "continue listening"). */
  async function quickPlay(work) {
    const current = app.player.current();
    if (current?.workno === work.workno) { app.player.toggle(); return; }
    const activity = state.get('activity')?.get(work.workno);
    const select = activity?.last_unit_key && Number(activity.progress_percentage) < 100 ? { key: activity.last_unit_key } : undefined;
    const started = await app.player.playEntries([{ workno: work.workno }], { select, resume: Boolean(select), returnHref: `/work/${work.workno}` })
      || (select && await app.player.playEntries([{ workno: work.workno }], { resume: false, returnHref: `/work/${work.workno}` }));
    if (!started) app.go(`/work/${work.workno}`);
  }

  /* ---------------- live updates */
  const unsubscribe = [
    state.on('library', schedule), state.on('hidden', schedule), state.on('activity', schedule), state.on('history', schedule),
    state.on('sync', sync => {
      syncLine.hidden = !sync.running;
      syncLine.querySelector('span').textContent = t('syncing', sync.value, sync.max);
    }),
    app.player.on('state', () => markPlaying()),
    app.player.on('change', () => markPlaying()),
    offline.onChange(() => offline.list().then(list => { savedWorks = new Set(list.map(work => work.workno)); schedule(); }).catch(() => {})),
  ];
  function markPlaying() {
    const playing = app.player.current();
    for (const card of node.querySelectorAll('.work-card')) {
      const on = playing?.workno === card.dataset.workno && playing.playing;
      if (card.hasAttribute('data-playing') === on) continue;
      card.toggleAttribute('data-playing', on);
      const button = card.querySelector('.card-play');
      if (button) clear(button, icon(on ? 'pauseFill' : 'playFill'));
      card.querySelector('.card-eq')?.remove();
      if (on) card.querySelector('.cover').append(h('span', { class: 'card-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
    }
  }
  const sync = state.get('sync');
  syncLine.hidden = !sync.running;
  render();

  return {
    node, scroller, title: titleText,
    focusSearch: () => { toolbar.setAttribute('data-search', ''); searchInput.focus(); },
    show() {
      // Tapping a segment moves the thumb on the page being left; reset it to this page's view.
      if (!isPerson && !isHidden) viewSwitch.select(view);
      if (dirty) { dirty = false; render(); }
    },
    destroy() { observer.disconnect(); unsubscribe.forEach(off => off()); },
  };
}
