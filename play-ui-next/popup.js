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
    offline.textContent = offlineLabels[language] ?? offlineLabels[language.split('-')[0]] ?? offlineLabels.en;
  }, { ...DLookPlatform.language, popupSiteLanguage: site || 'en' });
}
// The offline page belongs to the extension, so it opens without reaching DLsite.
const offline = document.querySelector('#offline');
const offlineLabels = { 'zh-CN': '离线播放', zh: '离线播放', en: 'Offline playback', ja: 'オフライン再生', ko: '오프라인 재생', th: 'เล่นแบบออฟไลน์' };
offline.addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('play/offline.html') }); window.close(); });
select.addEventListener('change', () => chrome.storage.local.set({ languageMode: select.value }));
init();
