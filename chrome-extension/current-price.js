const DLookCurrentPrice = (() => {
  function amount(value) {
    const text = String(value ?? '').trim();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
    const number = Number(text.replaceAll(',', ''));
    return Number.isFinite(number) ? number : null;
  }

  function displayedYen(value) {
    const text = (value || '').normalize('NFKC').trim();
    const match = /^(?:JPY|JP¥)\s*([\d,.]+)$|^(?:¥\s*)?([\d,.]+)\s*(?:円|JPY|日元|日圓|日币|yen)$/i.exec(text);
    return match ? amount(match[1] ?? match[2]) : null;
  }

  function cart(row, column) {
    for (const node of column.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE &&
          node.matches('.dlook-price-low, .work_price_original, .strike, s, del')) continue;
      const price = displayedYen(node.textContent);
      if (price !== null) return price;
    }
    // DLsite keeps JPY inputs on the row even when it displays a converted amount.
    if (row.getAttribute('data-bulkbuy_key')) {
      const field = row.classList.contains('type_matome') ? 'data-bulkbuy_price' : 'data-bulkbuy_origin_price';
      return amount(row.getAttribute(field));
    }
    return amount(row.getAttribute('data-price'));
  }

  function saleDiscount(scope) {
    for (const label of scope?.querySelectorAll(
      '.c-purchaseBox__labels .label_sale, ._display_discount_rate:is(.type_sale, .icon_campaign, .icon_lead_01), .discount_rate, .rate_label'
    ) || []) {
      if (!label.checkVisibility()) continue;
      const text = label.textContent.normalize('NFKC').trim();
      const percent = text.match(/(\d+(?:\.\d+)?)\s*%/);
      const tenths = text.match(/(\d+(?:\.\d+)?)\s*折/);
      if (!percent && !tenths) continue;
      // Chinese storefronts can write 15% off as either 8.5折 or 85折.
      let value;
      if (percent) value = Number(percent[1]);
      else {
        const paid = Number(tenths[1]);
        value = 100 - (paid > 10 && Number.isInteger(paid) ? paid : paid * 10);
      }
      if (value >= 0 && value <= 100) return Math.round(value * 100) / 100;
    }
    return null;
  }

  function cartDiscount(row, current) {
    const off = saleDiscount(row);
    if (off !== null) return off;
    const original = amount(row.getAttribute('data-official_price'));
    return current !== null && current > 0 && current === original ? 0 : null;
  }

  function productDiscount(priceBox, current) {
    const scope = priceBox?.closest('.c-purchaseBox__main, #work_buy_box, #work_buy_box_wrapper');
    const off = saleDiscount(scope);
    if (off !== null || !scope || !current) return off;
    const prices = priceBox.querySelectorAll('.app-price');
    const hasCampaign = scope.querySelector('.label_sale, .c-purchaseBox__discountText, .discount_rate, .rate_label');
    return !hasCampaign && prices.length === 1 && !prices[0].matches('.app-price_strike') ? 0 : null;
  }

  function product(id, priceRow) {
    const visiblePrice = priceRow?.querySelector('.app-price:not(.app-price_strike), .price:not(.strike)');
    const displayed = displayedYen(visiblePrice?.textContent);
    if (displayed !== null) return displayed;

    // Localized pages publish their yen offer alongside the converted display price.
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(script.textContent); } catch { continue; }
      const products = Array.isArray(data) ? data : data?.['@graph'] || [data];
      if (!Array.isArray(products)) continue;
      for (const item of products) {
        if (item?.['@type'] !== 'Product' || item.sku !== id) continue;
        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
        for (const offer of offers) {
          const price = offer?.priceCurrency === 'JPY' ? amount(offer.price) : null;
          if (price !== null) return price;
        }
      }
    }
    const legacy = document.querySelector(`#work_buy_box_wrapper [data-product_id="${id}"][data-price]`);
    return amount(legacy?.getAttribute('data-price'));
  }
  return { cart, product, cartDiscount, productDiscount };
})();
