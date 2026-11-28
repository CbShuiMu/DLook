// Work page: cover hero, primary play/read action, offline saving, lists, share, hide,
// details and a file browser. Desktop uses two columns (sticky hero + files);
// mobile stacks a blurred-cover hero above the file list.
import { h, clear, formatBytes, formatTime, scrollWithin } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t, localized, lang } from '../../core/i18n.js';
import * as kit from '../kit.js';
import * as prefs from '../../core/prefs.js';
import { page } from '../page.js';
import { coverImage } from '../cards.js';
import * as api from '../../data/api.js';
import * as source from '../../data/source.js';
import * as offline from '../../data/offline.js';
import * as covers from '../../data/covers.js';
import { workTitle, circleOf, authorNames, voiceNames, categoryOf, kindIcon, listsContaining } from '../state.js';

const kindIcons = { folder: 'folder', audio: 'headphones', video: 'film', image: 'photo', pdf: 'doc', text: 'doc', vtt: 'captions', html: 'globe', epub: 'book', other: 'doc' };

export async function create(app, route) {
  const { state } = app;
  const { workno } = route.params;
  let folder = route.params.folder ?? '';
  let light = state.findWork(workno);
  let info = null, tree = null, treeError = null;

  /* ---------------- scaffold */
  const heartButton = kit.iconButton('heart', t('addToList'), (e, b) => openLists(b), { className: 'act-heart', tone: 'glass' });
  const shareButton = kit.iconButton('share', t('share'), () => share(), { tone: 'glass' });
  const moreButton = kit.iconButton('more', t('more'), (e, b) => openMore(b), { tone: 'glass' });
  const scaffold = page(app, { title: light ? workTitle(light) : workno, back: '/', actions: [shareButton, moreButton], className: 'work' });
  const { node, scroller, content } = scaffold;
  scaffold.heading.hidden = true;

  const heroCover = h('div', { class: 'hero-cover' });
  const heroBackdrop = h('div', { class: 'hero-backdrop', 'aria-hidden': 'true' });
  const titleNode = h('h1', { class: 'work-title' });
  const circleNode = h('div', { class: 'work-circle' });
  const castNode = h('div', { class: 'work-cast' });
  const metaNode = h('div', { class: 'work-meta' });
  const primary = h('div', { class: 'primary-actions' });
  const offlineLine = h('div', { class: 'offline-line', role: 'status' });
  const hero = h('section', { class: 'hero' }, heroBackdrop, heroCover,
    h('div', { class: 'hero-text' }, titleNode, circleNode, castNode, metaNode, primary, offlineLine));
  const crumbs = h('nav', { class: 'crumbs', 'aria-label': t('files') });
  const fileList = h('ol', { class: 'files' });
  const filesSection = h('section', { class: 'files-section' }, h('div', { class: 'section-head' }, h('h2', { text: t('files') }), crumbs), fileList);
  const detailsSection = h('section', { class: 'details-section' });
  content.append(h('div', { class: 'work-layout' }, h('div', { class: 'work-aside' }, hero), h('div', { class: 'work-main' }, filesSection, detailsSection)));

  /* ---------------- hero */
  function paintHero() {
    const work = light ?? (info ? api.normalize({ workno, ...info }) : null);
    const title = work ? workTitle(work) : workno;
    scaffold.setTitle(title);
    titleNode.textContent = title;
    titleNode.title = title;
    const circle = work && circleOf(work);
    clear(circleNode, circle ? h('a', { href: `/library/author/${encodeURIComponent(circle.name)}`, class: 'link' }, icon('people'), h('span', { text: circle.name })) : null);
    const names = work ? voiceNames(work) : [];
    clear(castNode, names.slice(0, 8).map(name => h('a', { href: `/library/voice/${encodeURIComponent(name)}`, class: 'cast-chip', text: name })));
    const category = work ? categoryOf(work) : 'other';
    const facts = [
      h('span', { class: 'fact' }, icon(kindIcon(category)), t(category)),
      work?.released ? h('span', { class: 'fact' }, icon('clock'), new Date(work.released).toLocaleDateString(lang())) : null,
      work?.age && work.age !== 'all' ? h('span', { class: 'fact age', text: work.age.toUpperCase() }) : null,
      h('span', { class: 'fact mono', text: workno }),
    ];
    clear(metaNode, ...facts);
    const image = work?.image ?? info?.images?.main;
    if (image && !heroCover.firstChild) {
      heroCover.append(coverImage(image, { eager: true }));
      covers.cached(image).then(url => { heroBackdrop.style.backgroundImage = `url(${JSON.stringify(url ?? image)})`; });
    }
    paintPrimary();
    paintHeart();
  }

  function primaryLabel() {
    const category = light ? categoryOf(light) : info ? categoryOf(api.normalize({ workno, ...info })) : 'other';
    const activity = state.get('activity')?.get(workno);
    const resume = activity && Number(activity.progress_percentage) > 0 && Number(activity.progress_percentage) < 100 && activity.last_unit_key;
    if (category === 'comic') return { text: resume ? t('resumeRead') : t('read'), icon: 'book', category, resume };
    if (category === 'video') return { text: resume ? t('resumeWatch') : t('watch'), icon: 'playFill', category, resume };
    if (category === 'audio') return { text: resume ? t('resume') : t('listen'), icon: 'playFill', category, resume };
    return { text: t('open'), icon: 'forward', category, resume };
  }

  function paintPrimary() {
    const label = primaryLabel();
    const playing = app.player.current();
    const isPlaying = playing?.workno === workno && playing.playing;
    const main = kit.pill(isPlaying ? 'pauseFill' : label.icon, isPlaying ? t('pause') : label.text, () => start(), { className: 'primary' });
    // The progress sits inside the button, so the action row stays a single aligned line.
    if (label.resume && !isPlaying) {
      const activity = state.get('activity')?.get(workno);
      main.append(h('span', { class: 'pill-progress', text: `${activity.progress_percentage}%` }));
    }
    const saveButton = offlineButton();
    clear(primary, main, saveButton, heartButton);
  }

  function paintHeart() {
    const inList = listsContaining(workno).length > 0;
    heartButton.toggleAttribute('data-on', inList);
    clear(heartButton, icon(inList ? 'heartFill' : 'heart'));
    heartButton.setAttribute('aria-label', inList ? t('inList') : t('addToList'));
    heartButton.title = heartButton.getAttribute('aria-label');
  }

  /* ---------------- start playback / reading */
  async function start() {
    const playing = app.player.current();
    if (playing?.workno === workno) { app.player.toggle(); return; }
    const label = primaryLabel();
    if (label.category === 'audio' || label.category === 'video') {
      const activity = state.get('activity')?.get(workno);
      const select = label.resume ? { key: activity.last_unit_key } : undefined;
      let started = await app.player.playEntries([{ workno }], { select, resume: Boolean(select), returnHref: route.url.pathname, expand: app.mode() === 'mobile' || label.category === 'video' });
      if (!started && select) started = await app.player.playEntries([{ workno }], { resume: false, returnHref: route.url.pathname, expand: app.mode() === 'mobile' || label.category === 'video' });
      if (!started) kit.toast(t('playFailed'), { icon: 'warning' });
      return;
    }
    // Comics: open the first readable file (or the one last read).
    if (!tree && !treeError) await treeTask;
    if (!tree && [401, 402, 403].includes(treeError?.status)) {
      // The account has no access: say so instead of silently doing nothing.
      kit.toast(t('noAccess'), { icon: 'warning', duration: 3200 });
      return;
    }
    if (!tree) {
      // No file list (still loading or unavailable): let the official page open the work.
      openOfficial(`/work/${workno}`);
      return;
    }
    const nodes = flatten(tree);
    const activity = state.get('activity')?.get(workno);
    const last = activity?.last_unit_key && nodes.find(file => file.hashname === activity.last_unit_key);
    const target = last ?? nodes.find(file => file.kind === 'image' || file.kind === 'pdf') ?? nodes.find(file => file.kind !== 'folder');
    if (target) openFile(target);
    else app.go(`/work/${workno}/tree`);
  }

  const flatten = nodes => nodes.flatMap(file => file.kind === 'folder' ? flatten(file.children) : [file]);

  /* ---------------- offline */
  let savedState = null;
  function offlineButton() {
    const job = offline.job(workno);
    const result = offline.result(workno);
    const status = job ?? result ?? savedState;
    const complete = status && status.total > 0 && status.saved === status.total && !job;
    const playable = primaryLabel().category === 'audio' || primaryLabel().category === 'video' || savedState;
    if (!playable) return null;
    const ring = job ? h('i', { class: 'ring live', style: { '--p': `${status.total ? ((status.saved + (job.fraction || 0)) / status.total) * 100 : 4}%` } }) : null;
    const button = kit.iconButton(job ? 'pause' : complete ? 'downloaded' : 'download',
      job ? t('pauseSaving') : complete ? t('saved') : status?.saved ? t('resumeSaving') : t('saveOffline'),
      () => job ? offline.pause(workno) : complete ? offlineMenu(button) : saveOffline(), { className: 'act-save', tone: 'glass' });
    if (ring) button.append(ring);
    button.toggleAttribute('data-on', Boolean(complete));
    paintOfflineLine(status, job);
    return button;
  }
  function paintOfflineLine(status, job) {
    const parts = [];
    if (status?.total) parts.push(t('savedCount', status.saved, status.total));
    if (status?.message) parts.push(t(status.message));
    if (status?.status >= 400) parts.push(`(HTTP ${status.status})`);
    offlineLine.textContent = job || status?.message || (status && status.saved < status.total) ? parts.join(' · ') : '';
    offlineLine.toggleAttribute('data-error', Boolean(status?.message && status.message !== 'stopped'));
  }
  async function saveOffline() {
    const locale = offline.localeFor(lang());
    const work = await source.identify(workno, locale).catch(() => null);
    if (!work) { kit.toast(t('noAudio'), { icon: 'warning' }); return; }
    offline.save(workno, work);
  }
  function offlineMenu(anchor) {
    kit.menu(anchor, [
      { label: t('offline'), icon: 'download', onSelect: () => app.go(offline.offlineHref) },
      { label: t('removeOffline'), icon: 'trash', destructive: true, onSelect: async () => {
        if (!await kit.confirmDialog({ title: t('removeOffline'), message: t('removeOfflineConfirm', titleNode.textContent), confirm: t('delete'), destructive: true })) return;
        try { await offline.remove(workno); savedState = null; paintPrimary(); kit.toast(t('removed')); } catch { kit.toast(t('removeFailed'), { icon: 'warning' }); }
      } },
    ], { title: t('saved') });
  }
  const offOffline = offline.onChange(changed => {
    if (changed !== workno) return;
    offline.state(workno).then(value => { savedState = value; paintPrimary(); paintFiles(); }).catch(() => {});
  });
  offline.state(workno).then(value => { savedState = value; paintPrimary(); }).catch(() => {});

  /* ---------------- lists / share / hide */
  async function openLists(anchor) {
    const lists = state.get('mylist') ?? await state.loadCollections('mylist').catch(() => []);
    const items = lists.map(list => {
      const has = Array.isArray(list.data) && list.data.includes(workno);
      return { label: list.title, icon: 'folder', checked: has, onSelect: async () => {
        try {
          if (has) { await api.removeFromMylist(list.id, workno); kit.toast(t('removed')); }
          else { await api.addToMylist(list.id, workno); kit.toast(t('added', list.title), { icon: 'heartFill' }); }
          await state.refreshCollections('mylist');
          paintHeart();
          kit.animate(heartButton, [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 420 });
        } catch { kit.toast(t('updateFailed'), { icon: 'warning' }); }
      } };
    });
    kit.menu(anchor, [...items, items.length ? 'separator' : null,
      { label: t('newMylist'), icon: 'plus', onSelect: async () => {
        const name = await kit.promptDialog({ title: t('newMylist'), label: t('listName'), confirm: t('create') });
        if (!name) return;
        try {
          const created = await api.createCollection('mylist', name);
          if (created?.mylist_id) await api.addToMylist(created.mylist_id, workno);
          await state.refreshCollections('mylist');
          paintHeart();
          kit.toast(t('added', name), { icon: 'heartFill' });
        } catch { kit.toast(t('createFailed'), { icon: 'warning' }); }
      } }], { title: t('chooseList') });
  }
  async function share() {
    const url = `https://play.dlsite.com/work/${workno}`;
    const title = titleNode.textContent;
    try {
      if (navigator.share && app.mode() === 'mobile') await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); kit.toast(t('copied'), { icon: 'share' }); }
    } catch (error) {
      if (error?.name !== 'AbortError') { try { await navigator.clipboard.writeText(url); kit.toast(t('copied')); } catch {} }
    }
  }
  function openMore(anchor) {
    const hidden = state.get('hidden')?.has(workno);
    kit.menu(anchor, [
      { label: t('share'), icon: 'share', onSelect: share },
      { label: t('addToList'), icon: 'heart', onSelect: () => openLists(heartButton) },
      'separator',
      { label: hidden ? t('unhide') : t('hide'), icon: hidden ? 'eye' : 'eyeOff', onSelect: async () => {
        try { await state.setHidden(workno, !hidden); kit.toast(hidden ? t('unhiddenDone') : t('hiddenDone'), { icon: hidden ? 'eye' : 'eyeOff' }); } catch { kit.toast(t('updateFailed'), { icon: 'warning' }); }
      } },
      { label: t('openOfficial'), icon: 'external', onSelect: () => openOfficial(`/work/${workno}`) },
    ], { title: titleNode.textContent });
  }
  /** Shows the official screen for this URL (DLook steps aside). */
  function openOfficial(path) {
    app.go(path);
    document.documentElement.setAttribute('data-dn-pass', '');
    app.frame.setAttribute('data-pass', '');
  }

  /* ---------------- files */
  /**
   * Like DLsite Play, caption files attached to an audio/video file in the same folder are
   * hidden: the one its playfile links to, or one named after it ("01.mp3.vtt", "01.vtt").
   */
  function withoutCaptionFiles(nodes) {
    const media = nodes.filter(file => file.kind === 'audio' || file.kind === 'video');
    if (!media.length) return nodes;
    const linked = new Set(media.map(file => file.playfile?.[file.kind]?.vtt).filter(Boolean));
    const stems = new Set(media.flatMap(file => [file.name, file.name.replace(/\.[^.]+$/, '')]).map(name => name.toLowerCase()));
    return nodes.filter(file => file.kind !== 'vtt' || !(linked.has(file.hashname) || stems.has(file.name.replace(/\.[^.]+$/, '').toLowerCase())));
  }
  // Most works wrap everything in one top folder; open it directly to save a tap.
  const effectiveFolder = () => !folder && tree?.length === 1 && tree[0].kind === 'folder' ? tree[0].path : folder;
  function folderNodes() {
    let nodes = tree ?? [];
    const current = effectiveFolder();
    for (const segment of current ? current.split('/') : []) nodes = nodes.find(entry => entry.kind === 'folder' && entry.name === segment)?.children ?? [];
    if (prefs.get('hideCaptionFiles')) nodes = withoutCaptionFiles(nodes);
    // Folders first, like DLsite Play; otherwise the work's own order.
    return nodes.filter(file => file.kind === 'folder').concat(nodes.filter(file => file.kind !== 'folder'));
  }
  function paintCrumbs() {
    const current = effectiveFolder();
    const parts = current ? current.split('/') : [];
    clear(crumbs,
      h('a', { href: `/work/${workno}`, class: 'crumb', 'aria-current': parts.length ? undefined : 'page' }, icon('folder'), h('span', { text: workno })),
      parts.map((part, index) => [h('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, icon('forward')),
        h('a', { href: `/work/${workno}/tree/${parts.slice(0, index + 1).map(encodeURIComponent).join('/')}`, class: 'crumb', 'aria-current': index === parts.length - 1 ? 'page' : undefined, text: part })]));
  }
  function paintFiles() {
    paintCrumbs();
    const denied = [401, 402, 403].includes(treeError?.status);
    if (treeError && offlineTracks.length) {
      // No online access (offline, or the account lost the entitlement): browse the saved copy.
      tree = offlineTree(offlineTracks);
      filesSection.querySelector('.files-note')?.remove();
      fileList.before(h('p', { class: 'files-note', role: 'status' }, icon(denied ? 'warning' : 'wifiOff'), denied ? t('noAccessSaved') : t('offlineNotice')));
    } else if (treeError) {
      clear(fileList, h('li', {}, denied ? kit.emptyState('warning', t('noAccess'), t('noAccessHint')) : kit.errorState(t('catalog'), () => loadTree(true))));
      return;
    }
    if (!tree) { clear(fileList, ...Array.from({ length: 6 }, () => h('li', { class: 'file skeleton-row' }, h('i', { class: 'shimmer' })))); return; }
    const nodes = folderNodes();
    const playing = app.player.current();
    const saved = new Set((savedState?.saved ? offlineTracks : []).map(track => offline.trackPath(track)));
    if (!nodes.length) { clear(fileList, h('li', { class: 'files-empty', text: t('noFiles') })); return; }
    const media = nodes.filter(file => file.kind === 'audio' || file.kind === 'video');
    const rows = nodes.map(file => {
      const isMedia = file.kind === 'audio' || file.kind === 'video';
      const isPlaying = playing?.workno === workno && playing.path === file.path;
      const duration = Number(file.playfile?.[file.kind]?.duration ?? file.playfile?.[file.kind]?.optimized?.duration);
      const row = h('li', { class: `file kind-${file.kind}`, 'data-playing': isPlaying ? '' : undefined },
        h('button', { type: 'button', class: 'file-main', onclick: () => openFile(file) },
          h('span', { class: 'file-icon' }, icon(kindIcons[file.kind] ?? 'doc'), isPlaying ? h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')) : null),
          h('span', { class: 'file-name' }, h('strong', { text: file.name.replace(/\.[a-z0-9]{2,5}$/i, '') }),
            h('small', { text: file.kind === 'folder' ? t('items', countFiles(file)) : [file.name.split('.').pop()?.toUpperCase(), Number.isFinite(duration) ? formatTime(duration) : null].filter(Boolean).join(' · ') })),
          saved.has(file.path) ? h('span', { class: 'file-saved', title: t('saved') }, icon('downloaded')) : null,
          file.kind === 'folder' ? icon('forward', 'chevron') : null),
        isMedia && file.kind === 'audio' ? kit.iconButton('plus', t('addToPlaylist'), (e, b) => addToPlaylist(b, file), { size: 'sm', className: 'file-add', tone: 'soft' }) : null);
      return row;
    });
    clear(fileList, ...rows);
    if (media.length > 1) fileList.prepend(h('li', { class: 'file-folder-play' }, kit.pill('playFill', t('playFolder'), () => playFolder(media), { tone: 'soft' })));
    kit.stagger(fileList.children, { step: 12, max: 12, distance: 6 });
  }
  const countFiles = file => flatten(file.children ?? []).length;
  let offlineTracks = [];
  offline.get(workno).then(work => { offlineTracks = work?.tracks ?? []; paintFiles(); });

  function openFile(file) {
    if (file.kind === 'folder') { app.go(`/work/${workno}/tree/${file.path.split('/').map(encodeURIComponent).join('/')}`); return; }
    if (file.kind === 'audio' || file.kind === 'video') {
      app.player.playEntries([{ workno }], { select: { path: file.path }, resume: true, returnHref: route.url.pathname, expand: file.kind === 'video' || app.mode() === 'mobile' })
        .then(started => { if (!started) kit.toast(t('playFailed'), { icon: 'warning' }); });
      return;
    }
    // Images and PDFs open in the DLook reader; other types use the official viewer.
    // DLsite Play routes the whole file path as ONE segment (slashes encoded as %2F).
    const href = `/work/${workno}/view/${encodeURIComponent(file.path)}`;
    // The view route decides: DLook reader (images/PDF), DLook text page, or the official viewer.
    app.go(href);
  }
  function playFolder(media) {
    const first = media[0];
    app.player.playEntries([{ workno }], { select: { path: first.path }, resume: false, returnHref: route.url.pathname, expand: app.mode() === 'mobile' });
  }
  async function addToPlaylist(anchor, file) {
    const lists = state.get('playlist') ?? await state.loadCollections('playlist').catch(() => []);
    const src = file.path;
    kit.menu(anchor, [
      ...lists.map(list => ({ label: list.title, icon: 'queue', onSelect: async () => {
        try { await api.addToPlaylist(list.id, { workno, src }); await state.refreshCollections('playlist'); kit.toast(t('added', list.title), { icon: 'queue' }); }
        catch { kit.toast(t('updateFailed'), { icon: 'warning' }); }
      } })),
      lists.length ? 'separator' : null,
      { label: t('newPlaylist'), icon: 'plus', onSelect: async () => {
        const name = await kit.promptDialog({ title: t('newPlaylist'), label: t('listName'), confirm: t('create') });
        if (!name) return;
        try {
          const created = await api.createCollection('playlist', name);
          if (created?.playlist_id) await api.addToPlaylist(created.playlist_id, { workno, src });
          await state.refreshCollections('playlist');
          kit.toast(t('added', name), { icon: 'queue' });
        } catch { kit.toast(t('createFailed'), { icon: 'warning' }); }
      } },
    ], { title: t('addToPlaylist') });
  }

  /* ---------------- details */
  function paintDetails() {
    if (!info) { detailsSection.hidden = true; return; }
    detailsSection.hidden = false;
    const work = api.normalize({ workno, ...info });
    const rows = [
      [t('circle'), circleOf(work)?.name],
      [t('authors'), authorNames(work).join(' / ')],
      [t('cast'), (voiceNames(work).length ? voiceNames(work) : voiceNames(light)).join(' / ')],
      [t('release'), work.released ? new Date(work.released).toLocaleDateString(lang()) : null],
      [t('purchasedOn'), light?.purchased ? new Date(light.purchased).toLocaleDateString(lang()) : null],
      [t('type'), [info.work_type, info.file_type].filter(Boolean).join(' · ')],
      [t('fileSize'), info.pc_file_size ? formatBytes(info.pc_file_size) : null],
    ].filter(([, value]) => value);
    clear(detailsSection, h('div', { class: 'section-head' }, h('h2', { text: t('details') })),
      h('dl', { class: 'facts' }, rows.map(([label, value]) => [h('dt', { text: label }), h('dd', { text: value })])));
  }

  /** A browsable tree built from the offline copy's tracks. */
  function offlineTree(tracks) {
    const root = [];
    for (const track of tracks.slice().sort((a, b) => a.order - b.order)) {
      let nodes = root, path = '';
      for (const part of track.folder ? track.folder.split('/') : []) {
        path = path ? `${path}/${part}` : part;
        let folderNode = nodes.find(node => node.kind === 'folder' && node.name === part);
        if (!folderNode) { folderNode = { name: part, path, kind: 'folder', children: [] }; nodes.push(folderNode); }
        nodes = folderNode.children;
      }
      nodes.push({ name: track.name, path: offline.trackPath(track), kind: track.kind === 'video' ? 'video' : 'audio', hashname: track.hashname, playfile: null });
    }
    return root;
  }

  /* ---------------- loading */
  async function loadTree(force = false) {
    treeError = null;
    if (force) { tree = null; paintFiles(); }
    try {
      tree = source.fileTree(await source.manifest(workno, { force }));
    } catch (error) {
      treeError = error;
    }
    paintFiles();
  }
  api.work(workno, { onUpdate: value => { info = value; paintHero(); paintDetails(); } })
    .then(value => { info = value; if (!light && value) light = null; paintHero(); paintDetails(); })
    .catch(() => { paintHero(); });
  paintHero();
  paintFiles();
  let treeTask = loadTree();

  const unsubscribe = [
    state.on('mylist', paintHeart),
    state.on('activity', paintPrimary),
    state.on('library', () => { light = state.findWork(workno) ?? light; paintHero(); paintDetails(); }),
    app.player.on('state', () => { paintPrimary(); paintFiles(); }),
    app.player.on('change', () => { paintPrimary(); paintFiles(); }),
    offOffline,
  ];
  // Desktop: the hero keeps a little parallax of its blurred backdrop while scrolling.
  scroller.addEventListener('scroll', () => { heroBackdrop.style.transform = `translateY(${Math.min(120, scroller.scrollTop * 0.3)}px)`; }, { passive: true });

  return {
    node, scroller, title: titleNode.textContent,
    update(next) {
      if (next.params.folder === folder) return;
      folder = next.params.folder ?? '';
      route = next;
      paintFiles();
      scrollWithin(scroller, filesSection, { block: 'nearest', behavior: kit.reducedMotion.matches ? 'auto' : 'smooth' });
    },
    destroy() { unsubscribe.forEach(off => off()); },
  };
}
