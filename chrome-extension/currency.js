const DLookCurrency = (() => {
  // Defaults from DLsite's language and currency settings.
  const defaults = new Map(Object.entries({
    'en-us': 'USD', 'zh-cn': 'CNY', 'zh-tw': 'TWD', 'ko-kr': 'KRW',
    'es-es': 'EUR', 'de-de': 'EUR', 'fr-fr': 'EUR', 'it-it': 'EUR', 'pt-br': 'EUR',
    'id-id': 'IDR', 'sv-se': 'SEK', 'th-th': 'THB', 'vi-vn': 'VND',
  }));
  const yen = { code: 'JPY', rate: 1 };
  let rates, pending;
  let retryAfter = 0;

  function selected() {
    try {
      const code = localStorage.getItem('currency');
      if (code && /^[A-Z]{3}$/.test(code)) return code;
    } catch {
      // The browser may block storage access.
    }
    return defaults.get(DLookLanguage.siteLocale()) || 'JPY';
  }

  function quote(onChange, code = selected()) {
    if (code === 'JPY') return yen;
    if (!rates && !pending && Date.now() >= retryAfter) {
      // DLsite publishes these rates as yen per unit of the selected currency.
      pending = fetch('/home/api/=/exchangeConfig.json', {
        credentials: 'omit', signal: AbortSignal.timeout(8000)
      }).then(async response => {
        if (!response.ok) throw new Error('Exchange rates unavailable');
        const { data } = await response.json();
        if (data?.JPY !== 1) throw new Error('Invalid exchange rates');
        rates = data;
      }).catch(() => {
        retryAfter = Date.now() + 30000;
      }).finally(() => {
        pending = null;
        onChange();
      });
    }
    const rate = rates?.[code];
    return Number.isFinite(rate) && rate > 0 ? { code, rate } : yen;
  }

  function formatter({ code, rate }, language, cartPage) {
    if (code === 'JPY') {
      const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
      const amount = value => `¥${number.format(value)}`;
      return { amount, unit: 'JPY' };
    }
    // DLsite rounds item prices in TWD on product pages and uses cents in the cart.
    const wholeUnits = code === 'IDR' || (code === 'TWD' && !cartPage);
    const digits = wholeUnits ? 0
      : new Intl.NumberFormat(language, { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
    const number = new Intl.NumberFormat(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const unit = code === 'CNY' ? 'RMB' : code;
    const amount = value => number.format(value / rate);
    return { amount, unit };
  }

  return { selected, quote, formatter };
})();
