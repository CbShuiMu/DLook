const DLookCartCampaigns = (() => {
  const summarySelector = '.payment_confirm_box, .cart_bill_content';
  const inactiveRow = '#buy_later, .buy_later, .cart_hold, ._removed, .is_actioned, .__non_purchasable_item, [hidden]';
  const campaignKey = /^[a-z0-9][a-z0-9_-]*$/i;
  const campaignField = /bulk.?buy|matome|set.?discount|bundle/i;

  function optionTitle(option) {
    if (option.tagName === 'OPTION') return option.textContent.trim();
    const label = Array.from(option.labels || [], node => node.textContent.trim()).find(Boolean);
    if (label) return label;
    // Older DLsite forms place the caption next to the radio as a text node.
    for (let node = option.nextSibling; node; node = node.nextSibling) {
      if (node.matches?.('input, br') || node.querySelector?.('input')) break;
      if (node.nodeType === Node.COMMENT_NODE) continue;
      const text = node.textContent.trim();
      if (text) return text;
    }
    return '';
  }

  async function lookupWishlist() {
    const floor = location.pathname.split('/')[1].replace(/-touch$/, '');
    const url = new URL(`/${floor}/mypage/wishlist`, location.origin);
    const locale = new URLSearchParams(location.search).get('locale');
    if (locale) url.searchParams.set('locale', locale);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
      if (!response.ok || new URL(response.url).origin !== url.origin) return null;
      // The template keeps DLsite's scripts, images and form controls inert.
      const page = document.createElement('template');
      page.innerHTML = await response.text();
      const form = page.content.querySelector('form#showList');
      if (!form) return null;
      const campaigns = new Map();
      const otherOptions = new Map();
      for (const option of form.querySelectorAll('input[type="radio"][name][value], select[name] option[value]')) {
        const key = option.value.trim();
        if (!campaignKey.test(key) || key === '0') continue;
        const title = optionTitle(option);
        if (!title) continue;
        const field = option.name || option.closest('select')?.name || '';
        (campaignField.test(field) ? campaigns : otherOptions).set(key, title);
      }
      // An exact key from the cart or product API can also identify a renamed filter field.
      return campaigns.size ? campaigns : otherOptions;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function cartCampaignTitles() {
    for (const script of document.querySelectorAll('script:not([src])')) {
      const json = script.textContent.match(/\bvar Bulkbuy\s*=\s*\{\s*_list:\s*\{\s*\},\s*_info:\s*(\{[\s\S]*?\})\s*,\s*_detection:/)?.[1];
      if (!json) continue;
      try {
        return new Map(Object.entries(JSON.parse(json))
          .filter(([key, info]) => campaignKey.test(key) && typeof info?.label === 'string' && info.label.trim())
          .map(([key, info]) => [key, info.label.trim()]));
      } catch {
        break;
      }
    }
    return new Map();
  }

  function create({ cartRows, cartItemId, lookupProductInfo, createLogo, schedule }) {
    const productKeys = new Map();
    const card = document.createElement('section');
    card.className = 'dlook-cart-campaigns';
    const header = document.createElement('div');
    header.className = 'dlook-cart-campaign-header';
    const heading = document.createElement('h2');
    heading.id = 'dlook-cart-campaigns-heading';
    card.setAttribute('aria-labelledby', heading.id);
    const list = document.createElement('ul');
    header.append(createLogo(), heading);
    card.append(header, list);
    let wishlistRequested = false;
    let campaignTitles;
    let rendered;

    async function lookupKeys(ids) {
      try {
        const products = await lookupProductInfo(ids);
        for (const id of ids) productKeys.set(id, products?.[id]?.bulkbuy_key);
      } catch {
        // Cart rows with a native key still have a verified match.
      } finally {
        schedule();
      }
    }

    function update(language, copy) {
      const summaries = Array.from(document.querySelectorAll(summarySelector))
        .filter(summary => summary.getClientRects().length);
      const coupon = summaries.map(summary => summary.querySelector('.coupon_available'))
        .find(box => box?.getClientRects().length);
      const summary = coupon?.closest(summarySelector) || summaries[0];
      if (!summary) {
        card.remove();
        return;
      }
      const works = new Map();
      for (const row of document.querySelectorAll(cartRows)) {
        if (row.closest(inactiveRow) || !row.getClientRects().length) continue;
        const id = cartItemId(row);
        if (!id) continue;
        const value = row.getAttribute('data-bulkbuy_key')?.trim() || '';
        const nativeKey = value !== '0' && campaignKey.test(value) ? value : '';
        if (!works.has(id) || nativeKey) works.set(id, nativeKey);
      }
      if (!works.size) {
        card.remove();
        return;
      }

      if (!wishlistRequested) {
        wishlistRequested = true;
        void lookupWishlist().then(choices => {
          campaignTitles = choices ?? new Map();
          for (const [key, title] of cartCampaignTitles()) {
            if (!campaignTitles.has(key)) campaignTitles.set(key, title);
          }
          schedule();
        });
      }
      if (!campaignTitles?.size) return;

      const missing = [];
      const counts = new Map();
      for (const [id, nativeKey] of works) {
        if (!nativeKey && !productKeys.has(id)) {
          productKeys.set(id, null);
          missing.push(id);
        }
        const key = nativeKey || productKeys.get(id);
        if (campaignTitles.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
      }
      for (let start = 0; start < missing.length; start += 50) void lookupKeys(missing.slice(start, start + 50));
      if (!counts.size) {
        card.remove();
        return;
      }

      const matches = Array.from(campaignTitles).filter(([key]) => counts.has(key));
      const signature = JSON.stringify([language, matches.map(([key]) => [key, counts.get(key)])]);
      if (signature !== rendered) {
        card.lang = language;
        heading.textContent = copy.cartCampaigns;
        list.replaceChildren(...matches.map(([key, title]) => {
          const item = document.createElement('li');
          const name = document.createElement('span');
          const count = document.createElement('span');
          name.textContent = title;
          count.className = 'dlook-cart-campaign-count';
          count.textContent = copy.cartCampaignWorks(counts.get(key));
          item.append(name, count);
          return item;
        }));
        rendered = signature;
      }

      const subtotal = summary.querySelector('.payment_summary_table, .cart_bill_detail');
      const anchor = coupon || subtotal;
      if (anchor) {
        if (anchor.nextElementSibling !== card) anchor.after(card);
      } else if (summary.firstElementChild !== card) {
        summary.prepend(card);
      }
    }

    return { update };
  }

  return { create, summarySelector };
})();
