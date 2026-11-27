// Cards: every card in a grid shares the same cover ratio and a one-line title, so rows
// stay perfectly aligned. Covers always fill their frame (cropping allowed, no letterboxing).
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t } from '../core/i18n.js';
import * as covers from '../data/covers.js';
import { workTitle, circleOf, categoryOf, kindIcon, authorNames } from './state.js';

export function coverImage(url, { alt = '', eager = false } = {}) {
  const img = h('img', { class: 'cover-img', alt, loading: eager ? 'eager' : 'lazy', draggable: false });
  // Portrait art (comics) is anchored to the top so faces/titles stay visible when cropped.
  img.addEventListener('load', () => { if (img.naturalHeight > img.naturalWidth * 1.05) img.dataset.portrait = ''; }, { once: true });
  covers.paint(img, url);
  return img;
}

function cover(url, overlays = [], className = '') {
  return h('div', { class: `cover ${className}`.trim() }, h('div', { class: 'cover-ph', 'aria-hidden': 'true' }), coverImage(url), ...overlays);
}

/** A purchased work. options: { href, activity, saved, onPlay, playing, compact } */
export function workCard(work, { href = `/work/${work.workno}`, activity, saved, onPlay, playing } = {}) {
  const title = workTitle(work);
  const circle = circleOf(work)?.name ?? authorNames(work)[0] ?? '';
  const category = categoryOf(work);
  const percent = Number(activity?.progress_percentage);
  const overlays = [
    // One capsule for the type and the saved state keeps the corner tidy and aligned.
    h('span', { class: 'badges glass-chip', title: saved ? `${t(category)} · ${t('saved')}` : t(category) },
      icon(kindIcon(category)), saved ? icon('downloaded', 'badge-saved') : null),
    Number.isFinite(percent) && percent > 0 ? h('span', { class: 'progress-line', style: { '--p': `${Math.min(100, percent)}%` }, 'aria-hidden': 'true' }) : null,
    onPlay ? h('button', { type: 'button', class: 'card-play', 'aria-label': `${t('play')} · ${title}`, onclick: event => { event.preventDefault(); event.stopPropagation(); onPlay(event); } }, icon(playing ? 'pauseFill' : 'playFill')) : null,
    playing ? h('span', { class: 'card-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')) : null,
  ];
  const card = h('a', { href, class: 'card work-card', title, dataset: { workno: work.workno, kind: category } },
    cover(work.image ?? work.thumb ?? work.coverUrl, overlays),
    h('div', { class: 'card-text' },
      h('strong', { class: 'card-title', text: title }),
      h('small', { class: 'card-sub', text: circle || work.workno })));
  if (playing) card.setAttribute('data-playing', '');
  return card;
}

/** A row variant for list layout. */
export function workRow(work, { href = `/work/${work.workno}`, activity, saved, trailing } = {}) {
  const title = workTitle(work);
  const circle = circleOf(work)?.name ?? '';
  const category = categoryOf(work);
  const percent = Number(activity?.progress_percentage);
  return h('a', { href, class: 'row work-row', title, dataset: { workno: work.workno } },
    cover(work.image ?? work.thumb, [Number.isFinite(percent) && percent > 0 ? h('span', { class: 'progress-line', style: { '--p': `${percent}%` } }) : null], 'row-cover'),
    h('div', { class: 'row-text' },
      h('strong', { class: 'row-title', text: title }),
      h('small', { class: 'row-sub' }, icon(kindIcon(category)), h('span', { text: [circle, work.workno].filter(Boolean).join(' · ') }))),
    h('div', { class: 'row-trail' }, saved ? icon('downloaded', 'saved-icon') : null, trailing ?? icon('forward', 'chevron')));
}

/** 2×2 cover mosaic (people, lists). Fewer covers repeat so the tile never shows gaps. */
export function mosaic(urls, { round = false } = {}) {
  const list = urls.filter(Boolean).slice(0, 4);
  const grid = h('div', { class: `mosaic n${Math.max(1, Math.min(list.length, 4))} ${round ? 'round' : ''}`.trim() });
  if (!list.length) grid.append(h('div', { class: 'mosaic-empty' }, icon(round ? 'person' : 'folder')));
  for (const url of list) {
    const img = coverImage(url);
    // A missing cover must not leave a grey hole: drop it and re-flow the mosaic.
    img.addEventListener('error', () => {
      img.remove();
      const left = grid.querySelectorAll('.cover-img').length;
      grid.classList.remove('n1', 'n2', 'n3', 'n4');
      grid.classList.add(`n${Math.max(1, left)}`);
      if (!left) grid.append(h('div', { class: 'mosaic-empty' }, icon(round ? 'person' : 'folder')));
    }, { once: true });
    grid.append(img);
  }
  return grid;
}

export function personCard(name, works, href) {
  return h('a', { href, class: 'card person-card', title: name },
    h('div', { class: 'cover' }, mosaic(works.map(work => work.image ?? work.thumb))),
    h('div', { class: 'card-text' },
      h('strong', { class: 'card-title', text: name }),
      h('small', { class: 'card-sub', text: t('count', works.length) })));
}

export function collectionCard({ title, href, urls, sub, kindIcon: name = 'folder' }) {
  return h('a', { href, class: 'card list-card', title },
    h('div', { class: 'cover' }, mosaic(urls), h('span', { class: 'badges glass-chip' }, icon(name))),
    h('div', { class: 'card-text' },
      h('strong', { class: 'card-title', text: title }),
      h('small', { class: 'card-sub', text: sub })));
}

export function skeletonGrid(count = 12) {
  return h('div', { class: 'grid skeleton', 'aria-hidden': 'true' }, Array.from({ length: count }, () =>
    h('div', { class: 'card' }, h('div', { class: 'cover shimmer' }), h('div', { class: 'card-text' }, h('i', { class: 'line shimmer' }), h('i', { class: 'line short shimmer' })))));
}
