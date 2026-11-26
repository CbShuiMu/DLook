const DLookPlayLibrary = (() => {
  const searchLabels = { zh: '搜索作品', 'zh-tw': '搜尋作品', ja: '作品を検索', ko: '작품 검색', en: 'Search works' };
  const viewLabels = {
    authors: { zh: '作者/社团', 'zh-tw': '作者/社團', ja: '作者・サークル', ko: '작가/서클', en: 'Authors and circles' },
    voices: { zh: '声优', 'zh-tw': '聲優', ja: '声優', ko: '성우', en: 'Voice actors' },
    works: { zh: '作品', ja: '作品', ko: '작품', en: 'Works' },
  };
  const workTypeDropdown = '[data-dd-action-name="library.work_type_dropdown"]';
  const workFilters = `button:is([data-dd-action-name="library.category_tab"], ${workTypeDropdown})`;
  let active, activeTools, searchButton, searchField;

  function localize(copy, language) {
    return copy[language] ?? copy[language.split('-')[0]] ?? copy.en;
  }

  function closeSearch(event) {
    if (event.key === 'Escape' && searchButton.getAttribute('aria-expanded') === 'true') {
      searchButton.setAttribute('aria-expanded', 'false');
      searchButton.focus({ preventScroll: true });
    }
  }

  function updateSearch(main, language) {
    const right = main?.querySelector(':scope > header [class*="_colRight_"]');
    const tools = right?.querySelector('[class*="_utility_"]') ??
      (right?.querySelector('input[type="search"], button[data-btn-type="others"]') ? right : undefined);
    if (activeTools !== tools) {
      activeTools?.removeAttribute('data-dlook-library-tools');
      activeTools = tools;
      tools?.setAttribute('data-dlook-library-tools', '');
    }
    const field = tools?.querySelector('input[type="search"]');
    if (field !== searchField) {
      searchField?.removeEventListener('keydown', closeSearch);
      searchButton?.remove();
      searchField = field;
      searchButton = undefined;
      if (field) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'dlook-library-search';
        control.setAttribute('aria-expanded', 'false');
        control.append(DLookPlayIcons.create('search'));
        control.onclick = () => {
          const expanded = control.getAttribute('aria-expanded') !== 'true';
          control.setAttribute('aria-expanded', String(expanded));
          if (expanded) field.focus({ preventScroll: true });
        };
        field.addEventListener('keydown', closeSearch);
        tools.prepend(control);
        searchButton = control;
      }
    }
    if (searchButton) {
      const label = localize(searchLabels, language);
      if (label !== searchButton.getAttribute('aria-label')) searchButton.setAttribute('aria-label', label);
    }
    if (tools) {
      const afterSearch = String(Math.max(0, tools.querySelectorAll(':scope > button').length - 1));
      if (main.style.getPropertyValue('--dlook-tools-after-search') !== afterSearch) {
        main.style.setProperty('--dlook-tools-after-search', afterSearch);
      }
    }
  }

  function categoryIcon(label) {
    if (/漫画|漫畫|マンガ|コミック|manga|comic|만화|\bcg\b/i.test(label)) return 'comics';
    if (/音[声聲频頻]|audio|voice|오디오|음성/i.test(label)) return 'headphones';
    if (/视频|影片|視訊|動画|video|동영상/i.test(label)) return 'video';
    return 'works';
  }

  function addFilterIcon(button, icon, label) {
    if (label && button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
    if (button.dataset.dlookLibraryFilter !== icon || !button.querySelector(':scope > .dlook-play-icon')) {
      button.dataset.dlookLibraryFilter = icon;
      button.querySelector(':scope > .dlook-play-icon')?.remove();
      button.append(DLookPlayIcons.create(icon));
    }
  }

  function keepSelectedFilter(event) {
    if (event.type === 'keydown' && !['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function updateWorkFilter(button) {
    const label = button.textContent.trim();
    addFilterIcon(button, categoryIcon(label), label);
    const selected = String(button.hasAttribute('data-active'));
    if (button.getAttribute('aria-pressed') !== selected) button.setAttribute('aria-pressed', selected);
    // Play replaces the selected category with a trigger for its subtype menu.
    if (button.matches(workTypeDropdown)) {
      button.removeAttribute('aria-haspopup');
      button.removeAttribute('aria-expanded');
      for (const type of ['pointerdown', 'click', 'keydown']) {
        button.addEventListener(type, keepSelectedFilter, true);
      }
    }
  }

  function update(page, path, language) {
    const main = page && (path === '/' || path === '/library' || path.startsWith('/library/')) ? page.main : undefined;
    if (active !== main) {
      active?.removeAttribute('data-dlook-library');
      active = main;
      main?.setAttribute('data-dlook-library', '');
    }
    updateSearch(main, language);
    DLookPlayCoverCache.update(main ? page.pane : undefined);
    if (!main) return;
    const dropdown = page.pane.querySelector('[data-dd-action-name="library.category_dropdown"]');
    if (dropdown) {
      const view = path === '/library/author' ? 'authors' : path === '/library/voice' ? 'voices' : 'works';
      addFilterIcon(dropdown, view === 'works' ? 'library' : view, dropdown.textContent.trim() || localize(viewLabels[view], language));
      dropdown.closest('[class*="_viewSwitcherTab_"]')?.setAttribute('data-dlook-library-filters', '');
    }
    for (const button of page.pane.querySelectorAll(workFilters)) updateWorkFilter(button);
    const useCards = /^\/library\/(author|voice)(?:\/|$)/.test(path);
    page.pane.toggleAttribute('data-dlook-library-cards', useCards);
    if (useCards) {
      for (const link of page.pane.querySelectorAll('[data-index] a:is([href^="/library/"], [href^="/work/"]):has([class*="_thumbnail_"])')) {
        link.setAttribute('data-dlook-library-card', '');
        const slot = link.closest('[data-index]')?.parentElement;
        if (slot?.hasAttribute('data-index')) {
          slot.parentElement.setAttribute('data-dlook-library-grid', '');
          const index = slot.dataset.index;
          if (slot.style.getPropertyValue('--dlook-library-item-index') !== index) {
            slot.style.setProperty('--dlook-library-item-index', index);
          }
        }
      }
    }
  }

  return { update };
})();
