// Native content pages (notifications, help and their articles) inside DLook.
// Their content is bundled in DLsite Play's own front end (no API), so DLook keeps the
// official page rendering hidden underneath and mirrors its content pane into a DLook page:
// same text, links and buttons, DLook typography. Internal links open the next page in DLook,
// buttons forward the click to the original element.
import { h, clear, debounce } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import * as kit from '../kit.js';
import { page } from '../page.js';

const DROP = 'script, style, noscript, template, svg, iframe, object, embed, input, select, textarea, header';
const KEEP_ATTRS = { a: ['href'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };
const INTERACTIVE = 'a[href], button, [role="button"]';

function nativePane() {
  return document.querySelector('#App > .loContainer > main [data-content-pane="true"]');
}

function nativeTitle() {
  const header = document.querySelector('#App > .loContainer > main > header');
  // textContent, not innerText: the official page is visibility:hidden underneath DLook.
  const text = [...(header?.querySelectorAll('h1, h2, h3, [class*="title" i]') ?? [])].map(node => node.textContent.trim()).find(Boolean);
  return text || document.title.split(' | ')[0].trim();
}

/** A clean copy of the native pane: structure and text only, no native classes or styles. */
function mirror(pane) {
  const originals = [...pane.querySelectorAll(INTERACTIVE)];
  const blockLinks = new Set(originals.filter(node => node.matches('a[href]') && /^(block|flex|grid|list-item)$/.test(getComputedStyle(node).display)));
  const copy = pane.cloneNode(true);
  const copies = [...copy.querySelectorAll(INTERACTIVE)];
  copies.forEach((node, index) => {
    node.dataset.ni = String(index);
    if (blockLinks.has(originals[index])) node.dataset.row = '';
  });
  copy.querySelectorAll(DROP).forEach(node => node.remove());
  for (const node of [copy, ...copy.querySelectorAll('*')]) {
    const keep = new Set([...(KEEP_ATTRS[node.localName] ?? []), 'data-ni', 'data-row']);
    for (const attribute of [...node.attributes]) if (!keep.has(attribute.name)) node.removeAttribute(attribute.name);
    if (node.localName === 'a') {
      const href = node.getAttribute('href') ?? '';
      if (/^https?:/i.test(href) && !href.startsWith(location.origin)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    }
    if (node.localName === 'img' && node.getAttribute('src')) node.setAttribute('src', new URL(node.getAttribute('src'), location.href).href);
  }
  // Empty wrappers left behind by removed icons only add gaps.
  for (const node of [...copy.querySelectorAll('div, span')].reverse()) {
    if (!node.textContent.trim() && !node.querySelector('img, a, button')) node.remove();
  }
  return { copy, originals };
}

export async function create(app, route) {
  const segments = route.path.split('/').filter(Boolean);
  const back = segments.length > 1 ? `/${segments[0]}` : '/settings';
  const scaffold = page(app, { title: '', back, className: 'mirror' });
  const body = h('div', { class: 'mirror-body glass-card' }, h('div', { class: 'loading-block' }, kit.spinner()));
  scaffold.content.append(body);
  let originals = [], painted = false, signature = '';

  function sync() {
    if (location.pathname !== route.url.pathname) return;
    const pane = nativePane();
    if (!pane || !pane.textContent.trim()) return;
    const title = nativeTitle();
    if (title) scaffold.setTitle(title);
    const next = pane.textContent;
    if (next === signature) return;
    signature = next;
    const result = mirror(pane);
    originals = result.originals;
    clear(body, ...result.copy.childNodes);
    if (!painted) kit.stagger(body.children, { step: 20, max: 12, distance: 8 });
    painted = true;
  }

  // Buttons act on the original element; links route through DLook (handled by the shell).
  body.addEventListener('click', event => {
    const control = event.target.closest('[data-ni]');
    if (!control || control.localName === 'a') return;
    event.preventDefault();
    originals[Number(control.dataset.ni)]?.click();
  });

  const schedule = debounce(sync, 120);
  const observer = new MutationObserver(schedule);
  const app$ = document.querySelector('#App');
  if (app$) observer.observe(app$, { childList: true, subtree: true, characterData: true });
  sync();
  // Also poll briefly: the official page may finish rendering without a mutation we observe.
  const poll = setInterval(() => { if (painted) clearInterval(poll); else sync(); }, 400);
  setTimeout(() => clearInterval(poll), 8000);
  // If the official page never renders content (e.g. offline), show a clear state.
  const timeout = setTimeout(() => {
    if (!painted) clear(body, kit.emptyState('warning', t('loadFailed'), null, kit.pill('external', t('openOfficial'), () => app.showNative(), { tone: 'soft' })));
  }, 8000);

  return {
    node: scaffold.node, scroller: scaffold.scroller, title: '',
    update(next) { route = next; signature = ''; painted = false; sync(); },
    destroy() { observer.disconnect(); clearTimeout(timeout); clearInterval(poll); schedule.cancel(); },
  };
}
