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
    disclosure.textContent = disclosureLabels[language] ?? disclosureLabels[language.split('-')[0]] ?? disclosureLabels.en;
  }, { ...DLookPlatform.language, popupSiteLanguage: site || 'en' });
}
// The offline page belongs to the extension, so it opens without reaching DLsite.
const offline = document.querySelector('#offline');
const offlineLabels = { 'zh-CN': '离线播放', zh: '离线播放', en: 'Offline playback', ja: 'オフライン再生', ko: '오프라인 재생', th: 'เล่นแบบออฟไลน์' };
// Chrome Web Store affiliate policy: disclose the DLook cart links in the UI.
const disclosure = document.querySelector('#disclosure');
const disclosureLabels = {
  'zh-CN': 'DLook 在 DLsite 页面中的购物车入口为推广链接，价格不变。',
  zh: 'DLook 在 DLsite 页面中的购物车入口为推广链接，价格不变。',
  en: 'DLook cart links on DLsite are affiliate links. Your price stays the same.',
  ja: 'DLsite 上の DLook カートリンクはアフィリエイトリンクです。価格は変わりません。',
  ko: 'DLsite의 DLook 장바구니 링크는 제휴 링크입니다. 가격은 동일합니다.',
  th: 'ลิงก์ตะกร้าของ DLook บน DLsite เป็นลิงก์แอฟฟิลิเอต ราคาไม่เปลี่ยนแปลง',
};
offline.addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('play/offline.html') }); window.close(); });
select.addEventListener('change', () => chrome.storage.local.set({ languageMode: select.value }));
init();
