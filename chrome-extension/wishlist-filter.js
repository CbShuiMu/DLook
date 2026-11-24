const DLookWishlistFilter = {
  create(schedule, scheduleTargets, rows, touch) {
    const states = ['new-low', 'low', 'record'];
    const storageKey = 'dlook-wishlist-filter';
    const labels = {
      'zh-CN': ['DLook 史低筛选（本页）', '本页匹配', '件', '查价中…'],
      en: ['DLook price filters (this page)', 'Matches on this page:', '', 'Checking prices…'],
      ja: ['DLook 最安値フィルター（このページ）', 'このページの該当件数', '件', '価格を確認中…'],
      ko: ['DLook 최저가 필터 (이 페이지)', '이 페이지에서 일치', '개', '가격 확인 중…'],
      th: ['ตัวกรองราคาต่ำสุด DLook (หน้านี้)', 'ตรงเงื่อนไขในหน้านี้', 'รายการ', 'กำลังค้นหาราคา…'],
    };
    let saved = [];
    try {
      saved = (sessionStorage.getItem(storageKey) || '').split(',');
    } catch {
      // Keep filtering available if session storage is blocked.
    }
    let selected = new Set(states.filter(state => saved.includes(state)));
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'dlook-wishlist-filter';
    const heading = document.createElement('legend');
    fieldset.append(heading);
    const options = states.map(state => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(state);
      const text = document.createElement('span');
      label.append(input, text);
      fieldset.append(label);
      input.addEventListener('change', () => {
        if (!fieldset.closest('#filter_drawer')) applySelection();
      });
      return { state, input, text };
    });
    const status = document.createElement('span');
    status.className = 'dlook-wishlist-filter-status';
    status.setAttribute('role', 'status');
    fieldset.append(status);

    function applySelection() {
      selected = new Set(options.filter(({ input }) => input.checked).map(({ state }) => state));
      try {
        sessionStorage.setItem(storageKey, [...selected].join(','));
      } catch {
        // The current page can still apply the selection.
      }
      schedule();
    }

    if (touch) {
      // Capture before DLsite's handlers reload the list or submit the form.
      document.addEventListener('click', event => {
        if (!fieldset.closest('#filter_drawer')) return;
        if (event.target.closest?.('#filter_drawer .filter_clear')) {
          for (const { input } of options) input.checked = false;
        } else if (event.target.closest?.('#filter_drawer .drawer_filter')) {
          applySelection();
        }
      }, true);
      document.addEventListener('submit', event => {
        if (event.submitter?.matches('#filter_drawer .drawer_filter')) applySelection();
      }, true);
    }

    let currentDrawer;
    let wasOpen = false;
    function place() {
      const drawer = touch ? document.querySelector('#filter_drawer .refine_drawer_content') : null;
      if (drawer) {
        if (!drawer.contains(fieldset)) drawer.append(fieldset);
        if (!status.isConnected || fieldset.contains(status)) {
          status.classList.add('dlook-wishlist-filter-summary');
          placeOutside(status);
        }
      } else if (!fieldset.isConnected) {
        placeOutside(fieldset);
        status.classList.remove('dlook-wishlist-filter-summary');
        fieldset.append(status);
      }
      const open = Boolean(drawer?.closest('.refine_drawer.active'));
      if ((open && !wasOpen) || drawer !== currentDrawer) {
        for (const { input, state } of options) input.checked = selected.has(state);
      }
      currentDrawer = drawer;
      wasOpen = open;
    }

    function placeOutside(element) {
      const filters = document.querySelector(touch ? '.wishlist_top' : 'form#showList');
      if (filters) {
        filters.after(element);
      } else {
        document.querySelector('._wishlist_work_list, .one_column_work_list, .n_work_list:has(> .n_work_list_item)')?.before(element);
      }
    }

    let currentLanguage;
    function update(language, copy, mounted, pendingQuotes) {
      place();
      const [title, matches, unit, loading] = labels[language] || labels.en;
      if (currentLanguage !== language) {
        currentLanguage = language;
        fieldset.lang = language;
        heading.textContent = title;
        const names = [copy.newTag, copy.tag, copy.recorded];
        options.forEach(({ text }, index) => { text.textContent = names[index]; });
      }
      const attribute = 'data-dlook-wishlist-filtered';
      if (!selected.size) {
        const hidden = document.querySelectorAll('[' + attribute + ']');
        for (const element of hidden) element.removeAttribute(attribute);
        if (hidden.length) scheduleTargets();
        if (status.textContent) status.textContent = '';
        return;
      }
      let count = 0;
      let waiting = false;
      let restored = false;
      for (const row of document.querySelectorAll(rows)) {
        const view = mounted.get(row);
        const state = view?.panel.dataset.state;
        const pending = state === 'loading' || (view && pendingQuotes.get(view.id) === null);
        const visible = !pending && selected.has(state);
        const item = row.closest('.search_result_img_box_inner') || row;
        if (visible && item.hasAttribute(attribute)) restored = true;
        item.toggleAttribute(attribute, !visible);
        if (visible) count++;
        waiting ||= Boolean(pending);
      }
      const message = waiting ? loading : [matches, count, unit].filter(Boolean).join(' ');
      if (status.textContent !== message) status.textContent = message;
      // Discount labels must be measured again after their item becomes visible.
      if (restored) scheduleTargets();
    }
    return { update };
  },
};
