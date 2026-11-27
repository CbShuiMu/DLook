// Tiny DOM helpers. Views build plain DOM trees; no framework is involved.

export function h(tag, props, ...children) {
  const node = tag instanceof Node ? tag : document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'vars') for (const [name, v] of Object.entries(value)) node.style.setProperty(name, v);
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'text') node.textContent = value;
      else if (key in node && !key.startsWith('aria') && key !== 'role' && typeof value !== 'string') node[key] = value;
      else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(value));
    }
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children) {
    if (child === undefined || child === null || child === false) continue;
    if (Array.isArray(child)) append(node, child);
    else node.append(child instanceof Node ? child : String(child));
  }
}

export function clear(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

export const $ = (root, selector) => root.querySelector(selector);
export const $$ = (root, selector) => [...root.querySelectorAll(selector)];

export function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

export function toggle(node, name, on) {
  if (on) node.setAttribute(name, on === true ? '' : on);
  else node.removeAttribute(name);
}

export const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

export function debounce(run, wait) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => run(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function formatTime(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = part => String(part).padStart(2, '0');
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes <= 0) return '0 KB';
  if (bytes < 1048576) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

/** Calls `cleanup` when `node` leaves the document (used by views with timers/listeners). */
export function onDisconnect(node, cleanup) {
  const check = () => {
    if (node.isConnected) return;
    observer.disconnect();
    cleanup();
  };
  const observer = new MutationObserver(check);
  queueMicrotask(() => {
    const root = node.getRootNode();
    observer.observe(root === node ? document : root, { childList: true, subtree: true });
  });
  return () => observer.disconnect();
}

/**
 * Scrolls `element` into view inside `container` only. Unlike element.scrollIntoView(), it
 * never scrolls outer scrollers (sheets, the page), which made overlays jump while opening.
 * block / inline: 'start' | 'center' | 'nearest'.
 */
export function scrollWithin(container, element, { block = 'center', inline, behavior = 'auto' } = {}) {
  if (!container || !element) return;
  const box = container.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  const offset = (start, size, viewStart, viewSize, mode) => {
    const relative = start - viewStart;
    if (mode === 'start') return relative;
    if (mode === 'center') return relative - (viewSize - size) / 2;
    if (relative < 0) return relative;
    if (relative + size > viewSize) return relative + size - viewSize;
    return 0;
  };
  const top = block ? container.scrollTop + offset(target.top, target.height, box.top, box.height, block) : container.scrollTop;
  const left = inline ? container.scrollLeft + offset(target.left, target.width, box.left, box.width, inline) : container.scrollLeft;
  container.scrollTo({ top, left, behavior });
}
