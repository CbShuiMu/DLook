const DLookPlatform = {
  prepare() {
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (message?.type === 'site-language') respond(DLookLanguage.siteLanguage());
    });
  },
  lookupPrices(ids) {
    return chrome.runtime.sendMessage({ type: 'price-lows', ids });
  },
  createLogo() {
    const image = new Image(45, 15);
    image.src = chrome.runtime.getURL('dlook-logo.svg') + '#on-dark';
    image.alt = 'DLook';
    return image;
  },
  language: {
    async getMode() {
      const { languageMode } = await chrome.storage.local.get('languageMode');
      return languageMode;
    },
    onModeChange(notify) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.languageMode) notify(changes.languageMode.newValue);
      });
    },
  },
};
