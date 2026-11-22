// Keep only yen quotes in memory. Each tab still reads its own live price and currency.
const recent = new Map();
const pending = new Map();
const validAmount = value => Number.isFinite(value) && value >= 0;

async function fetchPrices(ids) {
  const url = new URL('https://dlook.site/api/price-lows');
  url.searchParams.set('ids', ids.join(','));
  const response = await fetch(url, {
    credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Price lookup failed');
  const data = await response.json();
  if (data.currency !== 'JPY' || !Array.isArray(data.items)) throw new Error('Invalid price response');
  const wanted = new Set(ids);
  const items = new Map();
  for (const item of data.items) {
    if (!wanted.has(item?.id) || !(item.historicalLowPrice === null || validAmount(item.historicalLowPrice)) ||
        !(item.off === null || (validAmount(item.off) && item.off <= 100))) continue;
    items.set(item.id, item);
    if (!recent.has(item.id) && recent.size >= 512) recent.delete(recent.keys().next().value);
    recent.set(item.id, { item, expires: Date.now() + (item.historicalLowPrice === null ? 10000 : 60000) });
  }
  return items;
}

async function lookup(ids) {
  const found = new Map();
  const batches = new Set();
  const missing = [];
  const now = Date.now();
  for (const id of ids) {
    const hit = recent.get(id);
    if (hit && hit.expires > now) found.set(id, hit.item);
    else if (pending.has(id)) batches.add(pending.get(id));
    else missing.push(id);
  }
  if (missing.length) {
    const batch = fetchPrices(missing).finally(() => {
      for (const id of missing) pending.delete(id);
    });
    for (const id of missing) pending.set(id, batch);
    batches.add(batch);
  }
  // If one batch fails, other products in the same cart can still be displayed.
  for (const result of await Promise.allSettled(batches)) {
    if (result.status === 'fulfilled') for (const [id, item] of result.value) found.set(id, item);
  }
  return { items: ids.map(id => found.get(id)).filter(Boolean) };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'price-lows') return;
  const ids = message.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 ||
      !ids.every(id => typeof id === 'string' && /^(?:RJ|BJ|VJ)\d{6,10}$/.test(id))) return;
  lookup([...new Set(ids)]).then(respond, () => respond({ error: true }));
  return true;
});
