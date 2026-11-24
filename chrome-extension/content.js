(() => {
  const productPattern = /\/work\/(?:[^/?#]+\/)*product_id\/((?:RJ|BJ|VJ)\d{6,10})(?=\.html(?:\/|$)|\/|$)/i;
  const workNumber = /^(?:RJ|BJ|VJ)\d{6,10}$/i;
  const buyPattern = /\/cart\/buynow\/1\/product_id\/((?:RJ|BJ|VJ)\d{6,10})\/?$/i;
  const cartPage = /^\/[^/]+\/cart(?:\/|$)/.test(location.pathname);
  const wishlistPage = /^\/[^/]+\/mypage\/wishlist(?:\/|$)/.test(location.pathname);
  const touchPage = /^\/[^/]+-touch\//.test(location.pathname);
  const productId = path => path.match(productPattern)?.[1].toUpperCase();
  if (!cartPage && !wishlistPage && !productId(location.pathname)) return;
  DLookPlatform.prepare();

  const prices = new Map();
  const wishlistQuotes = new Map();
  const mounted = new Map();
  let language, copy;
  const validAmount = value => Number.isFinite(value) && value >= 0;
  let scheduled = false;
  let selectedCurrency;
  let currentTargets, expiryTimer;
  let scheduledEnd = Infinity;
  const wishlistRows = '._wishlist_work_list .work_wrap, .one_column_work_list .one_column_work_item' +
    (touchPage ? ', .n_work_list_item:has(> div > dl.n_work_item, > .n_work_item > dl.work_desc)' : '');
  const cartRows = '#show_cart .cart_list_item, #show_cart li._cart_item, .cart_list > .cart_list_item, .type_cart > li._cart_item';
  const wishlistFilter = wishlistPage ? DLookWishlistFilter.create(schedule, scheduleTargets, wishlistRows, touchPage) : null;
  const cartCampaigns = cartPage ? DLookCartCampaigns.create({
    cartRows, cartItemId, lookupProductInfo, createLogo: DLookPlatform.createLogo, schedule
  }) : null;
  const purchaseOffers = wishlistPage ? null : DLookPurchaseOffers.create(cartPage);
  const priceScope = cartPage ? '#show_cart, .cart_list, .type_cart, ' + DLookCartCampaigns.summarySelector
    : wishlistPage ? '._wishlist_work_list, .one_column_work_list' + (touchPage ? ', .n_work_list_item, #filter_drawer' : '')
    : '.c-purchaseSide__main, .c-purchaseBox, .c-purchaseBox__main, .c-purchaseBox__inner, .c-purchaseBox__priceInfo, #work_buy_box, #work_buy_box_wrapper, #work_name, .c-productTitle, script[type="application/ld+json"]';

  function firstVisible(selector) {
    return Array.from(document.querySelectorAll(selector)).find(node => node.getClientRects().length);
  }

  function detailProductId() {
    const translation = new URLSearchParams(location.search).get('translation') ?? '';
    if (workNumber.test(translation)) return translation.toUpperCase();

    // DLsite may select a translation in the purchase box even on the canonical URL.
    const buy = firstVisible('a.btn_buy[href*="/cart/buynow/"]');
    const purchaseId = buy?.origin === location.origin ? buy.pathname.match(buyPattern)?.[1] : undefined;
    return purchaseId?.toUpperCase() ?? productId(location.pathname);
  }

  function wishlistTargets() {
    const result = new Map();
    const rows = document.querySelectorAll(wishlistRows);
    for (const row of rows) {
      const link = row.querySelector('.work_name a[href*="/product_id/"], a[href*="/work/"][href*="/product_id/"]');
      const id = productId(link?.pathname || '');
      const price = row.querySelector('.work_price_wrap, .n_work_price_wrap') || row.querySelector('.work_price:not(.strike)');
      if (!id || !price) continue;
      const rating = row.querySelector('.review_and_rating, .work_rating, .n_work_value, .work_value_trans, .star_rating');
      const ratingRow = rating?.closest('dd, .review_and_rating, .work_rating, .n_work_value, .work_value_trans') || rating;
      const afterPrice = ratingRow && Boolean(price.compareDocumentPosition(ratingRow) & Node.DOCUMENT_POSITION_FOLLOWING);
      const anchor = afterPrice ? ratingRow : price.closest('.work_price_wrap, .n_work_price_wrap, li, dd, p') || price;
      result.set(row, {
        id, anchor, position: afterPrice ? 'beforebegin' : 'afterend',
        touch: touchPage, ...DLookCurrentPrice.wishlist(row, price)
      });
    }
    return result;
  }

  async function lookupProductInfo(ids) {
    const floor = location.pathname.split('/')[1];
    const url = new URL('/' + floor + '/product/info/ajax', location.origin);
    url.search = new URLSearchParams({ product_id: ids.join(','), cdn_cache: '3' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal
      });
      if (!response.ok) throw new Error('DLsite product info lookup failed');
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function lookupWishlistQuotes(ids) {
    try {
      const quotes = await lookupProductInfo(ids);
      for (const id of ids) {
        const quote = quotes?.[id];
        if (!validAmount(quote?.price)) continue;
        const off = quote.discount_rate;
        wishlistQuotes.set(id, { price: quote.price, off: validAmount(off) && off <= 100 ? off : null });
      }
    } catch {
      // The historical card can still be shown when DLsite has no JPY quote.
    } finally {
      for (const id of ids) if (wishlistQuotes.get(id) === null) wishlistQuotes.set(id, undefined);
      schedule();
    }
  }

  function cartItemId(row) {
    const raw = row.getAttribute('data-workno') || '';
    return workNumber.test(raw) ? raw.toUpperCase()
      : productId(row.querySelector('a[href*="/work/"][href*="/product_id/"]')?.pathname || '');
  }

  function targets() {
    if (wishlistPage) return wishlistTargets();
    const result = new Map();
    if (cartPage) {
      for (const row of document.querySelectorAll(cartRows)) {
        const id = cartItemId(row);
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
      const priceBox = firstVisible('.c-purchaseBox__priceInfo, #work_buy_box #work_price, #work_buy_box_wrapper #work_price');
      const lastPrice = priceBox && Array.from(priceBox.querySelectorAll(':scope > .c-purchaseBox__item, .work_buy_body'))
        .filter(row => row.parentElement === priceBox && row.classList.contains('c-purchaseBox__item') || row.querySelector('.price'));
      const priceRow = lastPrice?.[lastPrice.length - 1];
      const buy = priceRow || priceBox || firstVisible('#work_buy_box, .c-purchaseBox');
      // On touch pages the native price and ratings share one horizontal row.
      const priceAndRatings = priceBox?.closest('.c-purchaseBox__inner');
      const anchor = priceAndRatings || buy || firstVisible('#work_name, .c-productTitle');
      const separateRow = priceAndRatings ? DLookPlatform.separateProductRow : Boolean(priceRow || !buy);
      const id = detailProductId();
      const currentPrice = DLookCurrentPrice.product(id, priceRow || priceBox, productId(location.pathname));
      if (anchor && id) result.set(anchor, {
        id, anchor, position: separateRow ? 'afterend' : 'beforeend',
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

  function render(badge, id, entry, currentPrice, currentOff, confirmedNewLow, money) {
    badge.lang = language;
    badge.setAttribute('role', 'group');
    badge.setAttribute('aria-label', 'DLook · ' + copy.low);
    badge.replaceChildren();
    badge.dataset.state = entry.status;
    const newLow = confirmedNewLow || (entry.status === 'ready' && entry.price !== null &&
      currentPrice !== null && currentPrice < entry.price);
    if (entry.status !== 'ready' || (!newLow && (entry.price === null || entry.off === 0))) {
      // An original price with OFF=0 cannot establish a discounted minimum.
      const empty = entry.status === 'ready';
      if (empty) badge.dataset.state = 'empty';
      const note = entry.price === null ? copy.missing : copy.noDiscount;
      const text = empty ? (currentPrice === 0 ? copy.free + ' · ' : '') + note : copy[entry.status];
      badge.append(DLookPlatform.createLogo(), part('span', 'dlook-note', text));
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
    const off = newLow ? currentOff ?? (confirmedNewLow ? entry.off : null) : entry.off;
    if (off > 0) {
      amountRow.append(part('b', 'dlook-off-value', `${off}% OFF`));
    } else if (!newLow && off === null) {
      labels.prepend(part('span', 'dlook-unknown-off', copy.unknownOff));
    }
    const history = part('a', 'dlook-history', '');
    history.append(DLookPlatform.createLogo(), part('span', '', copy.history));
    history.href = 'https://dlook.site/products/' + encodeURIComponent(id);
    history.target = '_blank';
    history.rel = 'noopener noreferrer';
    badge.append(details, history);
  }

  async function lookup(ids) {
    try {
      const reply = await DLookPlatform.lookupPrices(ids);
      const items = new Map(reply.items.map(item => [item.id, item]));
      for (const id of ids) {
        const item = items.get(id);
        const valid = item && (item.historicalLowPrice === null || validAmount(item.historicalLowPrice)) &&
          (item.off === null || (validAmount(item.off) && item.off <= 100));
        prices.set(id, valid ? {
          status: 'ready', price: item.historicalLowPrice, off: item.off,
          newLowUntil: Number.isSafeInteger(item.newLowUntil) ? item.newLowUntil : 0,
        } : { status: 'error' });
      }
    } catch {
      for (const id of ids) prices.set(id, { status: 'error' });
    }
    schedule();
  }

  function update() {
    scheduled = false;
    if (!copy) return;
    const current = currentTargets ??= targets();
    for (const [node, view] of mounted) {
      const target = current.get(node);
      if (!target || target.id !== view.id || target.anchor !== view.anchor || !view.badge.isConnected) {
        view.badge.remove();
        mounted.delete(node);
      }
    }
    if (current.size) selectedCurrency = DLookCurrency.selected();
    const currency = current.size ? DLookCurrency.quote(schedule, selectedCurrency) : null;
    const now = Date.now();
    let nextEnd = Infinity;
    let money;
    const needed = [];
    const missingQuotes = [];
    for (const [node, target] of current) {
      const { id, anchor, position, touch } = target;
      if (wishlistPage && target.currentPrice === null && !wishlistQuotes.has(id)) {
        wishlistQuotes.set(id, null);
        missingQuotes.push(id);
      }
      const quote = wishlistQuotes.get(id);
      const currentPrice = target.currentPrice ?? quote?.price ?? null;
      const currentOff = target.currentOff ?? (quote?.price === currentPrice ? quote.off : null);
      if (!prices.has(id)) {
        needed.push(id);
        prices.set(id, { status: 'loading' });
      }
      if (!mounted.has(node)) {
        const parent = position === 'beforeend' ? anchor : anchor.parentElement;
        const tag = wishlistPage && parent.matches('dl') ? 'dd'
          : wishlistPage && parent.matches('ul, ol') ? 'li' : 'div';
        const badge = document.createElement(tag);
        badge.className = 'dlook-price-low';
        if (wishlistPage) badge.classList.add('dlook-wishlist-card');
        if (touch) badge.dataset.layout = wishlistPage ? 'wishlist-touch' : 'touch';
        anchor.insertAdjacentElement(position, badge);
        const panel = DLookPlatform.createPanel?.(badge) ?? badge;
        mounted.set(node, { id, anchor, badge, panel });
      }
      const entry = prices.get(id);
      const view = mounted.get(node);
      const confirmedNewLow = currentPrice !== null && currentPrice === entry.price && entry.newLowUntil > now;
      if (confirmedNewLow) nextEnd = Math.min(nextEnd, entry.newLowUntil);
      // Keep the card with its price when the site adds or rearranges price details.
      if (position === 'afterend' && anchor.nextElementSibling !== view.badge) anchor.after(view.badge);
      if (position === 'beforebegin' && anchor.previousElementSibling !== view.badge) anchor.before(view.badge);
      if (cartPage && position === 'beforeend' && anchor.lastElementChild !== view.badge) anchor.append(view.badge);
      if (view.entry !== entry || view.language !== language || view.currentPrice !== currentPrice ||
          view.currentOff !== currentOff || view.confirmedNewLow !== confirmedNewLow ||
          view.currency !== currency.code || view.rate !== currency.rate) {
        money ??= DLookCurrency.formatter(currency, language, cartPage);
        render(view.panel, id, entry, currentPrice, currentOff, confirmedNewLow, money);
        view.entry = entry;
        view.language = language;
        view.currentPrice = currentPrice;
        view.currentOff = currentOff;
        view.confirmedNewLow = confirmedNewLow;
        view.currency = currency.code;
        view.rate = currency.rate;
      }
    }
    if (scheduledEnd !== nextEnd) {
      clearTimeout(expiryTimer);
      scheduledEnd = nextEnd;
      if (Number.isFinite(nextEnd)) {
        expiryTimer = setTimeout(() => {
          scheduledEnd = Infinity;
          schedule();
        }, Math.min(2147483647, Math.max(0, nextEnd - Date.now())));
      }
    }
    wishlistFilter?.update(language, copy, mounted, wishlistQuotes);
    cartCampaigns?.update(language, copy);
    purchaseOffers?.update(language, copy);
    for (let start = 0; start < needed.length; start += 50) void lookup(needed.slice(start, start + 50));
    for (let start = 0; start < missingQuotes.length; start += 50) void lookupWishlistQuotes(missingQuotes.slice(start, start + 50));
  }

  function schedule() {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(update);
    }
  }
  function scheduleTargets() {
    currentTargets = undefined;
    schedule();
  }
  function affectsPrice(record) {
    const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
    if (element?.closest('.dlook-price-low, .dlook-wishlist-filter, .dlook-wishlist-filter-status, .dlook-cart-campaigns, .dlook-offer-link')) return false;
    const inside = element?.closest(priceScope);
    if (record.type === 'characterData') return Boolean(inside);
    // A change on an ancestor can hide a price or turn a cart into a different list.
    if (record.type === 'attributes') return inside || element.querySelector(priceScope + ', .dlook-price-low');
    const injected = '.dlook-price-low, .dlook-cart-campaigns, .dlook-offer-link';
    if (Array.from(record.removedNodes).some(node => node.matches?.(injected))) return true;
    if (inside) return record.removedNodes.length ||
      Array.from(record.addedNodes).some(node => !node.matches?.(injected));
    return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE &&
      (node.matches(priceScope) || node.querySelector(priceScope)));
  }

  let mutationScheduled = false;
  new MutationObserver(records => {
    if (mutationScheduled || (!records.some(affectsPrice) && (!mounted.size || selectedCurrency === DLookCurrency.selected()))) return;
    mutationScheduled = true;
    const flush = () => { mutationScheduled = false; scheduleTargets(); };
    if (document.hidden) setTimeout(flush, 40);
    else requestAnimationFrame(flush);
  }).observe(document.documentElement, {
    childList: true, characterData: true, subtree: true, attributes: true,
    attributeFilter: ['id', 'href', 'class', 'style', 'hidden', 'v-cloak', 'data-workno', 'data-product_id', 'data-price', 'data-official_price', 'data-bulkbuy_key', 'data-bulkbuy_price', 'data-bulkbuy_origin_price']
  });
  window.addEventListener('storage', event => {
    if (event.key === 'currency' || event.key === null) schedule();
  });
  if (!cartPage && !wishlistPage) {
    window.addEventListener('resize', scheduleTargets);
    window.addEventListener('popstate', scheduleTargets);
    const id = detailProductId();
    prices.set(id, { status: 'loading' });
    void lookup([id]);
  }
  DLookLanguage.watch((nextLanguage, messages) => {
    language = nextLanguage;
    copy = messages;
    schedule();
  }, DLookPlatform.language);
})();
