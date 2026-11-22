chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'price-lows') return;
  const ids = message.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 ||
      !ids.every(id => typeof id === 'string' && /^(?:RJ|BJ|VJ)\d{6,10}$/.test(id))) return;

  const url = new URL('https://dlook.site/api/price-lows');
  url.searchParams.set('ids', [...new Set(ids)].join(','));
  fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(15000) })
    .then(async response => {
      if (!response.ok) throw new Error('Price lookup failed');
      const data = await response.json();
      if (data.currency !== 'JPY' || !Array.isArray(data.items)) throw new Error('Invalid price response');
      respond({ items: data.items });
    })
    .catch(() => respond({ error: true }));
  return true;
});
