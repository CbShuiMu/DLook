const DLookPurchaseOffers = (() => {
  const affiliateUrl = 'https://dlaf.jp/home/dlaf/=/aid/DL00k/url/https%3A%2F%2Fwww.dlsite.com%2Fhome%2Fcart%3Futm_medium%3Daffiliate%26utm_campaign%3Dbnlink%26utm_content%3Dtext';
  const checkout = '.payment_confirm_box .payment_button_box:has(> :is(button, input[type="submit"], a.payment_confirm))';
  const cartBar = '.work_cart_column_container';
  const bottomCartAction = cartBar + ' .btn_01 > :is(button, input[type="button"], input[type="submit"], a[href]):not(.dlook-offer-link)';
  const bottomProduct = '.c-purchaseBottomBar__nav > .single:has(> a.btn_cart_in[href])';
  const productGroups = '.p-purchaseButtonsPc';
  const purchaseActions = '.btn_buy, .btn_cart';
  const visible = node => node.getClientRects().length > 0;

  function productGroup() {
    for (const group of document.querySelectorAll(productGroups)) {
      if (Array.from(group.querySelectorAll(purchaseActions)).some(visible)) return group;
    }
  }

  function create(cartPage, touchPage) {
    const link = document.createElement('a');
    link.className = 'dlook-offer-link ' + (cartPage ? 'dlook-cart-offer' : 'dlook-product-offer');
    link.href = affiliateUrl;
    link.rel = 'sponsored noreferrer';
    const logo = DLookPlatform.createLogo();
    const caption = document.createElement('span');
    link.append(logo, caption);
    return {
      update(language, copy) {
        let anchor, bottom = touchPage;
        if (cartPage) {
          const action = Array.from(document.querySelectorAll(bottomCartAction)).find(visible);
          bottom = Boolean(action);
          anchor = action?.parentElement;
          if (!anchor && !touchPage) anchor = Array.from(document.querySelectorAll(checkout)).find(visible);
        } else if (touchPage) {
          anchor = Array.from(document.querySelectorAll(bottomProduct)).find(visible);
        } else {
          anchor = productGroup();
        }
        if (!anchor) {
          link.remove();
          return;
        }
        const cart = !cartPage && Array.from(anchor.querySelectorAll('a.btn_cart_in[href]')).find(visible);
        const productCart = Boolean(cart) && !touchPage;
        const text = cartPage ? copy.viewOffers : touchPage || productCart ? copy.viewCart : copy.buyWithOffer;
        if (link.lang !== language) link.lang = language;
        if (caption.textContent !== text) caption.textContent = text;
        link.classList.toggle('dlook-product-cart-offer', productCart);
        if (cart) {
          if (cart.getAttribute('aria-label') !== copy.viewCart) cart.setAttribute('aria-label', copy.viewCart);
          if (cart.title !== copy.viewCart) cart.title = copy.viewCart;
        }
        link.classList.toggle('dlook-bottom-offer', bottom);
        if (cartPage && !bottom) {
          if (anchor.previousElementSibling !== link) anchor.before(link);
        } else if (anchor.lastElementChild !== link) {
          // An extra node before the native controls can be matched to a
          // purchase button during hydration. Append and use CSS to move it.
          anchor.append(link);
        }
      },
    };
  }

  return { create, cartBar };
})();
