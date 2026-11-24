const DLookLanguage = (() => {
  const messages = {
    'zh-CN': {
      language: '显示语言', auto: '跟随 DLsite', low: '为您查询到', tag: '史低', loading: '查询中…',
      error: '史低查询失败', retry: '重试', missing: '暂无史低记录', unknownOff: '折扣未知',
      currentLow: '当前售价达到已记录的最低价', newLow: '当前售价低于已记录的最低价',
      recorded: '记录低价', newTag: '新史低',
      noDiscount: '暂无折扣史低记录', free: '当前免费', history: '查看价格走势',
      cartCampaigns: '活动提示', cartCampaignWorks: count => `${count} 件作品适用`,
      buyWithOffer: '优惠购买', viewOffers: '查看优惠',
    },
    en: {
      language: 'Display language', auto: 'Match DLsite', low: 'Found for you', tag: 'At record low', loading: 'Loading…',
      error: 'Price lookup failed', retry: 'Retry', missing: 'No price history', unknownOff: 'Discount unknown',
      currentLow: 'The current price matches the recorded low', newLow: 'The current price is below the recorded low',
      recorded: 'Recorded low', newTag: 'New low',
      noDiscount: 'No discount low on record', free: 'Currently free', history: 'View price history',
      cartCampaigns: 'Bundle offers', cartCampaignWorks: count => `${count} eligible ${count === 1 ? 'item' : 'items'}`,
      buyWithOffer: 'Shop offers', viewOffers: 'View offers',
    },
    ja: {
      language: '表示言語', auto: 'DLsite に合わせる', low: 'お調べした価格', tag: '最安', loading: '確認中…',
      error: '価格を取得できません', retry: '再試行', missing: '価格の記録なし', unknownOff: '割引率不明',
      currentLow: '現在の価格は記録上の最安値です', newLow: '現在の価格は記録上の最安値を下回っています',
      recorded: '記録最安値', newTag: '最安値更新',
      noDiscount: 'セール最安値の記録なし', free: '現在無料', history: '価格履歴を見る',
      cartCampaigns: 'キャンペーン情報', cartCampaignWorks: count => `対象作品 ${count}点`,
      buyWithOffer: 'お得に購入', viewOffers: '特典を見る',
    },
    ko: {
      language: '표시 언어', auto: 'DLsite 언어 따르기', low: '확인한 가격', tag: '최저가', loading: '조회 중…',
      error: '최저가를 불러올 수 없습니다', retry: '다시 시도', missing: '가격 기록 없음', unknownOff: '할인율 알 수 없음',
      currentLow: '현재 가격이 기록된 최저가와 같습니다', newLow: '현재 가격이 기록된 최저가보다 낮습니다',
      recorded: '기록된 최저가', newTag: '최저가 갱신',
      noDiscount: '할인 최저가 기록 없음', free: '현재 무료', history: '가격 기록 보기',
      cartCampaigns: '캠페인 안내', cartCampaignWorks: count => `대상 작품 ${count}개`,
      buyWithOffer: '할인 구매', viewOffers: '혜택 보기',
    },
    th: {
      language: 'ภาษาที่แสดง', auto: 'ตามภาษา DLsite', low: 'ราคาที่ค้นพบ', tag: 'ต่ำสุด', loading: 'กำลังค้นหา…',
      error: 'ค้นหาราคาต่ำสุดไม่สำเร็จ', retry: 'ลองอีกครั้ง', missing: 'ไม่มีประวัติราคา', unknownOff: 'ไม่ทราบส่วนลด',
      currentLow: 'ราคาปัจจุบันเท่ากับราคาต่ำสุดที่บันทึกไว้', newLow: 'ราคาปัจจุบันต่ำกว่าราคาต่ำสุดที่บันทึกไว้',
      recorded: 'ราคาต่ำสุดที่บันทึกไว้', newTag: 'ต่ำสุดใหม่',
      noDiscount: 'ไม่มีบันทึกราคาต่ำสุดช่วงลดราคา', free: 'ฟรีในขณะนี้', history: 'ดูประวัติราคา',
      cartCampaigns: 'โปรโมชันซื้อชุด', cartCampaignWorks: count => `ใช้ได้กับ ${count} รายการ`,
      buyWithOffer: 'ซื้อในราคาโปรโมชัน', viewOffers: 'ดูโปรโมชัน',
    },
  };
  function siteLocale() {
    const locale = document.documentElement.lang.trim() || new URLSearchParams(location.search).get('locale') ||
      location.pathname.match(/\/locale\/([^/.]+)/i)?.[1] || '';
    return locale.toLowerCase().replaceAll('_', '-');
  }

  function siteLanguage() {
    const primary = siteLocale().split('-')[0];
    if (primary === 'zh') return 'zh-CN';
    return hasLanguage(primary) ? primary : 'en';
  }

  function hasLanguage(value) {
    return Object.prototype.hasOwnProperty.call(messages, value);
  }

  function watch(listener, { popupSiteLanguage, getMode, onModeChange } = {}) {
    let mode = 'auto';
    const notify = () => {
      const lang = mode === 'auto' ? popupSiteLanguage ?? siteLanguage() : mode;
      listener(lang, messages[lang], mode);
    };
    const apply = value => {
      mode = hasLanguage(value) ? value : 'auto';
      notify();
    };
    if (popupSiteLanguage === undefined) {
      new MutationObserver(notify).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
    let changed = false;
    onModeChange?.(value => {
      changed = true;
      apply(value);
    });
    Promise.resolve().then(getMode).catch(() => 'auto').then(value => {
      if (!changed) apply(value);
    });
  }
  return { watch, siteLanguage, siteLocale };
})();
