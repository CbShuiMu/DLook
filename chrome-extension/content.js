(() => {
  const productPattern = /\/work\/(?:[^/?#]+\/)*product_id\/((?:RJ|BJ|VJ)\d{6,10})(?=\.html(?:\/|$)|\/|$)/i;
  const cartPage = /^\/[^/]+\/cart(?:\/|$)/.test(location.pathname);
  const touchPage = /^\/[^/]+-touch\//.test(location.pathname);
  const productId = path => path.match(productPattern)?.[1].toUpperCase();
  if (!cartPage && !productId(location.pathname)) return;
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'site-language') respond(DLookLanguage.siteLanguage());
  });

  const prices = new Map();
  const mounted = new Map();
  let language, copy;
  const logoUrl = chrome.runtime.getURL('dlook-logo.svg') + '#on-dark';
  const validAmount = value => Number.isFinite(value) && value >= 0;
  let scheduled = false;

  function targets() {
    const result = new Map();
    if (cartPage) {
      const rows = document.querySelectorAll('#show_cart .cart_list_item, #show_cart li._cart_item, .cart_list > .cart_list_item, .type_cart > li._cart_item');
      for (const row of rows) {
        const raw = row.getAttribute('data-workno') || '';
        const link = row.querySelector('a[href*="/work/"][href*="/product_id/"]');
        const id = /^(?:RJ|BJ|VJ)\d{6,10}$/i.test(raw) ? raw.toUpperCase() : link && productId(link.pathname);
        if (!id) continue;
        const priceColumn = row.querySelector('.n_work_price_wrap, .work_price_wrap, div.work_price');
        if (!priceColumn) continue;
        const currentPrice = DLookCurrentPrice.cart(row, priceColumn);
        result.set(row, {
          id, anchor: priceColumn, position: 'beforeend',
          touch: Boolean(priceColumn.closest('.n_work_item')) || touchPage,
          currentPrice, currentOff: DLookCurrentPrice.cartDiscount(row, currentPrice)
        });
      }
    } else {
      const priceBox = document.querySelector('.c-purchaseBox__priceInfo') || document.querySelector('#work_buy_box #work_price, #work_buy_box_wrapper #work_price');
      const lastPrice = priceBox?.querySelectorAll(':scope > .c-purchaseBox__item, .work_buy_body:has(.price)');
      const priceRow = lastPrice?.[lastPrice.length - 1];
      const buy = priceRow || priceBox || document.querySelector('#work_buy_box');
      // On touch pages the native price and ratings share one horizontal row.
      const priceAndRatings = priceBox?.closest('.c-purchaseBox__inner');
      const anchor = priceAndRatings || buy;
      const id = productId(location.pathname);
      const currentPrice = DLookCurrentPrice.product(id, priceRow || priceBox);
      if (anchor && id) result.set(anchor, {
        id, anchor, position: !priceAndRatings && priceRow ? 'afterend' : 'beforeend',
        touch: Boolean(priceAndRatings) || touchPage, currentPrice, currentOff: DLookCurrentPrice.productDiscount(priceBox, currentPrice)
      });
    }
    return result;
  }

  function part(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  function addDiscount(labels, priceRow, off, plain) {
    if (off === null) {
      labels.prepend(part('span', 'dlook-unknown-off', copy.unknownOff));
    } else if (plain) {
      priceRow.append(part('b', 'dlook-off-value', `${off}% OFF`));
    } else {
      labels.prepend(part('span', 'dlook-off', `${off}% OFF`));
    }
  }

  function logo() {
    const image = new Image(45, 15);
    image.src = logoUrl;
    image.alt = 'DLook';
    return image;
  }

  function render(badge, id, entry, currentPrice, currentOff, money) {
    badge.lang = language;
    badge.setAttribute('role', 'group');
    badge.setAttribute('aria-label', 'DLook · ' + copy.low);
    badge.replaceChildren();
    badge.dataset.state = entry.status;
    if (entry.status !== 'ready' || entry.price === null || entry.off === 0) {
      // An original price with OFF=0 cannot establish a discounted minimum.
      const empty = entry.status === 'ready';
      if (empty) badge.dataset.state = 'empty';
      const note = entry.price === null ? copy.missing : copy.noDiscount;
      const text = empty ? (currentPrice === 0 ? copy.free + ' · ' : '') + note : copy[entry.status];
      badge.append(logo(), part('span', 'dlook-note', text));
      if (entry.status !== 'error') return;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = copy.retry;
      retry.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        prices.delete(id);
        schedule();
      });
      badge.append(retry);
      return;
    }
    const matched = currentPrice === entry.price;
    const newLow = currentPrice !== null && currentPrice < entry.price;
    const atLow = matched || newLow;
    badge.dataset.state = newLow ? 'new-low' : matched ? 'low' : 'record';

    const details = part('div', 'dlook-details', '');
    const values = part('div', 'dlook-low-values', '');
    const labels = part('div', 'dlook-low-labels', '');
    if (atLow) {
      const tag = part('span', 'dlook-low-tag', newLow ? copy.newTag : copy.tag);
      tag.title = newLow ? copy.newLow : copy.currentLow;
      labels.append(tag);
    } else {
      labels.append(part('span', 'dlook-recorded', copy.recorded));
    }
    const price = part('strong', atLow ? 'dlook-gold-price' : '', money.amount(newLow ? currentPrice : entry.price));
    price.append(' ', part('small', 'dlook-unit', money.unit));
    const amountRow = part('div', 'dlook-low-amount', '');
    amountRow.append(price);
    values.append(labels, amountRow);
    details.append(values);
    const off = newLow ? currentOff : entry.off;
    if (!newLow || off > 0) addDiscount(labels, amountRow, off, atLow || currentOff === 0);
    const history = part('a', 'dlook-history', '');
    history.append(logo(), part('span', '', copy.history));
    history.href = 'https://dlook.site/products/' + encodeURIComponent(id);
    history.target = '_blank';
    history.rel = 'noopener noreferrer';
    badge.append(details, history);
  }

  async function lookup(ids) {
    try {
      const reply = await chrome.runtime.sendMessage({ type: 'price-lows', ids });
      const items = new Map(reply.items.map(item => [item.id, item]));
      for (const id of ids) {
        const item = items.get(id);
        const valid = item && (item.historicalLowPrice === null || validAmount(item.historicalLowPrice)) &&
          (item.off === null || (validAmount(item.off) && item.off <= 100));
        prices.set(id, valid ? { status: 'ready', price: item.historicalLowPrice, off: item.off } : { status: 'error' });
      }
    } catch {
      for (const id of ids) prices.set(id, { status: 'error' });
    }
    schedule();
  }

  function update() {
    scheduled = false;
    if (!copy) return;
    const current = targets();
    for (const [node, view] of mounted) {
      const target = current.get(node);
      if (!target || target.id !== view.id || target.anchor !== view.anchor || !view.badge.isConnected) {
        view.badge.remove();
        mounted.delete(node);
      }
    }
    if (!current.size) return;
    const currency = DLookCurrency.quote(schedule);
    let money;
    const needed = [];
    for (const [node, { id, anchor, position, touch, currentPrice, currentOff }] of current) {
      if (!prices.has(id)) {
        needed.push(id);
        prices.set(id, { status: 'loading' });
      }
      if (!mounted.has(node)) {
        const badge = document.createElement('div');
        badge.className = 'dlook-price-low';
        if (touch) badge.dataset.layout = 'touch';
        anchor.insertAdjacentElement(position, badge);
        mounted.set(node, { id, anchor, badge });
      }
      const entry = prices.get(id);
      const view = mounted.get(node);
      // Keep the card with its price when the site adds or rearranges price details.
      if (position === 'afterend' && anchor.nextElementSibling !== view.badge) anchor.after(view.badge);
      if (cartPage && position === 'beforeend' && anchor.lastElementChild !== view.badge) anchor.append(view.badge);
      if (view.entry !== entry || view.language !== language || view.currentPrice !== currentPrice ||
          view.currentOff !== currentOff || view.currency !== currency.code || view.rate !== currency.rate) {
        money ??= DLookCurrency.formatter(currency, language, cartPage);
        render(view.badge, id, entry, currentPrice, currentOff, money);
        view.entry = entry;
        view.language = language;
        view.currentPrice = currentPrice;
        view.currentOff = currentOff;
        view.currency = currency.code;
        view.rate = currency.rate;
      }
    }
    for (let start = 0; start < needed.length; start += 50) void lookup(needed.slice(start, start + 50));
  }

  function schedule() {
    if (!scheduled) {
      scheduled = true;
      setTimeout(update, 40);
    }
  }
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, characterData: true, subtree: true, attributes: true,
    attributeFilter: ['href', 'class', 'style', 'hidden', 'data-workno', 'data-price', 'data-official_price', 'data-bulkbuy_key', 'data-bulkbuy_price', 'data-bulkbuy_origin_price']
  });
  window.addEventListener('storage', event => {
    if (event.key === 'currency' || event.key === null) schedule();
  });
  DLookLanguage.watch((nextLanguage, messages) => {
    language = nextLanguage;
    copy = messages;
    schedule();
  });
})();
