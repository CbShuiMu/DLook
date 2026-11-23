// auto, zh-CN, en, ja, ko, th
const languageMode = 'auto';

let logo, cardSheet;
function makeSheet(css) {
  if (typeof CSSStyleSheet === 'undefined' || !CSSStyleSheet.prototype.replaceSync) return;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  } catch {
    // applyStyles can also install this CSS as a local style element.
  }
}

function applyStyles(root, sheet, css) {
  if (sheet && 'adoptedStyleSheets' in root) {
    try {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return;
    } catch {
      // The document may reject a sheet constructed in an extension world.
    }
  }
  const style = document.createElement('style');
  style.textContent = css;
  (root.head || root).append(style);
}

const DLookPlatform = {
  separateProductRow: true,
  prepare() {
    cardSheet = makeSheet(dlookCardCss);
    applyStyles(document, makeSheet(dlookLayoutCss), dlookLayoutCss);
  },
  createPanel(host) {
    const root = host.attachShadow({ mode: 'open' });
    applyStyles(root, cardSheet, dlookCardCss);
    host.style.width = '100%';
    host.style.minWidth = '0';
    const panel = document.createElement('div');
    panel.className = 'dlook-price-low';
    panel.style.whiteSpace = 'normal';
    if (host.dataset.layout) panel.dataset.layout = host.dataset.layout;
    root.append(panel);
    return panel;
  },
  async lookupPrices(ids) {
    const url = new URL('https://dlook.site/api/price-lows');
    url.searchParams.set('ids', ids.join(','));
    let timer;
    const response = await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('Price lookup failed'));
      // A disconnected Userscripts background port can leave every handler pending.
      timer = setTimeout(fail, 16000);
      // Userscripts stringifies these fields before forwarding them to xhr.open().
      const request = GM.xmlHttpRequest({
        method: 'GET', url: url.href, user: '', password: '', overrideMimeType: 'application/json',
        timeout: 15000, responseType: 'text',
        onload: resolve, onerror: fail, ontimeout: fail, onabort: fail,
      });
      // Earlier versions return an abort handle. Newer ones also resolve a Promise.
      request?.then?.(result => { if (typeof result?.status === 'number') resolve(result); }, reject);
    }).finally(() => clearTimeout(timer));
    if (response.status < 200 || response.status >= 300) throw new Error('Price lookup failed');
    const payload = response.responseText ?? response.response;
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (data?.currency !== 'JPY' || !Array.isArray(data.items)) throw new Error('Invalid price response');
    return data;
  },
  createLogo() {
    if (!logo) {
      logo = new DOMParser().parseFromString(dlookLogoMarkup, 'image/svg+xml').documentElement;
      logo.removeAttribute('id');
      logo.setAttribute('class', 'dlook-logo');
      logo.setAttribute('role', 'img');
      logo.setAttribute('aria-label', 'DLook');
      logo.setAttribute('width', '44');
      logo.setAttribute('height', '15');
    }
    return document.importNode(logo, true);
  },
  language: { getMode: () => languageMode },
};
