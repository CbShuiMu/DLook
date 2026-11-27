const select = document.querySelector('#language');
async function activeSiteLanguage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) return await chrome.tabs.sendMessage(tab.id, { type: 'site-language' });
  } catch {
    // The popup can also open without a reachable DLsite tab.
  }
}

async function init() {
  const site = await activeSiteLanguage();
  DLookLanguage.watch((language, copy, mode) => {
    document.documentElement.lang = language;
    document.querySelector('label').textContent = copy.language;
    select.options[0].textContent = copy.auto;
    select.value = mode;
  }, { ...DLookPlatform.language, popupSiteLanguage: site || 'en' });
}
select.addEventListener('change', () => chrome.storage.local.set({ languageMode: select.value }));
init();
