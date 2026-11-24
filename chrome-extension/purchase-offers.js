const DLookPurchaseOffers = (() => {
  const affiliateUrl = 'https://dlaf.jp/home/dlaf/=/aid/DL00k/url/https%3A%2F%2Fwww.dlsite.com%2Fhome%2Fcart%3Futm_medium%3Daffiliate%26utm_campaign%3Dbnlink%26utm_content%3Dtext';
  const checkout = '.payment_confirm_box .payment_button_box:has(> :is(button, input[type="submit"], a.payment_confirm)), .cart_bill_content .btn_01:has(> [type="submit"][name="credit_x"])';
  const productGroups = '.p-purchaseButtonsPc, .p-purchaseBox__links';
  const purchaseActions = '.btn_buy, .btn_cart';
  const visible = node => node.getClientRects().length > 0;

  function productGroup() {
    for (const group of document.querySelectorAll(productGroups)) {
      if (Array.from(group.querySelectorAll(purchaseActions)).some(visible)) return group;
    }
  }

  function create(cartPage) {
    const link = document.createElement('a');
    link.className = 'dlook-offer-link ' + (cartPage ? 'dlook-cart-offer' : 'dlook-product-offer');
    link.href = affiliateUrl;
    link.rel = 'sponsored noreferrer';
    const logo = DLookPlatform.createLogo();
    const caption = document.createElement('span');
    link.append(logo, caption);

    return {
      update(language, copy) {
        const anchor = cartPage ? Array.from(document.querySelectorAll(checkout)).find(visible) : productGroup();
        if (!anchor) {
          link.remove();
          return;
        }
        if (link.lang !== language) {
          link.lang = language;
          caption.textContent = cartPage ? copy.viewOffers : copy.buyWithOffer;
        }
        if (cartPage) {
          if (anchor.previousElementSibling !== link) anchor.before(link);
        } else if (anchor.lastElementChild !== link) {
          // An extra node before the native controls can be matched to a
          // purchase button during hydration. Append and use CSS to move it.
          anchor.append(link);
        }
      },
    };
  }

  return { create };
})();
