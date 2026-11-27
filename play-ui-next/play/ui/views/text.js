// Text files of a work (Read me, scripts, credits) shown in DLook's own page instead of the
// official viewer: readable typography, adjustable size, copy, and clickable links.
import { h, clear } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import * as prefs from '../../core/prefs.js';
import * as kit from '../kit.js';
import { page } from '../page.js';
import * as source from '../../data/source.js';

const SIZES = [14, 15, 16, 17, 18, 20, 22];

/** Splits text into nodes, turning http(s) URLs into links that open in a new tab. */
function linkify(text) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'）)」』】]+/g)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(h('a', { href: match[0], target: '_blank', rel: 'noopener noreferrer', class: 'text-link', text: match[0] }));
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export async function create(app, route) {
  const { workno, path } = route.params;
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const backHref = `/work/${workno}${folder ? `/tree/${folder.split('/').map(encodeURIComponent).join('/')}` : ''}`;
  const name = path.split('/').pop();
  let content = '';

  const smaller = kit.iconButton('minus', t('smaller'), () => setSize(-1), { tone: 'soft', className: 'text-size' });
  smaller.replaceChildren(h('span', { class: 'aa small', text: 'A' }));
  const larger = kit.iconButton('plus', t('larger'), () => setSize(1), { tone: 'soft', className: 'text-size' });
  larger.replaceChildren(h('span', { class: 'aa', text: 'A' }));
  const copy = kit.iconButton('doc', t('copy'), async () => {
    try { await navigator.clipboard.writeText(content); kit.toast(t('copiedText')); } catch { kit.toast(t('failed'), { icon: 'warning' }); }
  }, { tone: 'soft' });
  const scaffold = page(app, { title: name.replace(/\.[a-z0-9]{2,5}$/i, ''), subtitle: workno, back: backHref, actions: [smaller, larger, copy], className: 'text-page' });
  const body = h('article', { class: 'text-body glass-card', lang: 'ja' }, h('div', { class: 'loading-block' }, kit.spinner()));
  scaffold.content.append(body);

  function setSize(step) {
    const current = SIZES.indexOf(prefs.get('textSize'));
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, (current < 0 ? 2 : current) + step))];
    prefs.set('textSize', next);
    body.style.setProperty('--text-size', `${next}px`);
  }
  body.style.setProperty('--text-size', `${prefs.get('textSize') ?? 16}px`);

  try {
    content = await source.text(workno, path);
    if (content == null) throw new Error('not a text file');
    clear(body, h('pre', { class: 'text-pre' }, ...linkify(content)));
  } catch (error) {
    const denied = [401, 402, 403].includes(error?.status);
    clear(body, denied ? kit.emptyState('warning', t('noAccess'), t('noAccessHint')) : kit.errorState(t('loadFailed'), () => app.replace(route.url.pathname)));
  }
  return { node: scaffold.node, scroller: scaffold.scroller, title: name };
}
