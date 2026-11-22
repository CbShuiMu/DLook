const select = document.querySelector('#language');
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Outside a supported DLsite page the popup has no storefront locale.
  const site = tab?.id ? await chrome.tabs.sendMessage(tab.id, { type: 'site-language' }).catch(() => null) : null;
  DLookLanguage.watch((language, copy, mode) => {
    document.documentElement.lang = language;
    document.querySelector('label').textContent = copy.language;
    select.options[0].textContent = copy.auto;
    select.value = mode;
  }, site || 'en');
}
select.addEventListener('change', () => chrome.storage.local.set({ languageMode: select.value }));
init();
