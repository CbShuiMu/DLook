const DLookPlaySleep = (() => {
  const durations = [5, 15, 30, 45, 60];
  const labels = {
    zh: ['定时关闭', '分钟', '取消定时', '未设置', '剩余'],
    ja: ['スリープタイマー', '分', 'タイマーを解除', 'オフ', '残り'],
    ko: ['취침 타이머', '분', '타이머 취소', '꺼짐', '남은 시간'],
    en: ['Sleep timer', 'min', 'Cancel timer', 'Off', 'Remaining'],
  };

  function create(onExpire, language = document.documentElement.lang) {
    const copy = labels[language.toLowerCase().split(/[-_]/)[0]] ?? labels.en;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dlook-sleep-toggle';
    button.append(DLookPlayIcons.create('timer'));
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    const picker = document.createElement('div');
    picker.className = 'dlook-sleep-picker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', copy[0]);
    picker.setAttribute('data-swipe-ignore', '');
    picker.hidden = true;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    picker.append(status);
    let deadline = 0, selected = 0, timer;
    const options = durations.map(minutes => {
      const option = document.createElement('button');
      option.type = 'button';
      option.textContent = `${minutes} ${copy[1]}`;
      option.onclick = () => {
        selected = minutes;
        deadline = Date.now() + minutes * 60000;
        tick();
        close(true);
      };
      picker.append(option);
      return { minutes, option };
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = copy[2];
    cancel.onclick = () => { clear(); close(true); };
    picker.append(cancel);

    function close(focus = false) {
      picker.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (focus) button.focus({ preventScroll: true });
    }

    function tick() {
      clearTimeout(timer);
      const remaining = Math.max(0, deadline - Date.now());
      const expired = deadline && !remaining;
      if (expired) deadline = selected = 0;
      const text = remaining ? `${copy[4]} ${Math.ceil(remaining / 60000)} ${copy[1]}` : copy[3];
      const label = `${copy[0]} · ${text}`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      button.title = label;
      button.setAttribute('aria-pressed', String(Boolean(remaining)));
      if (status.textContent !== text) status.textContent = text;
      for (const { minutes, option } of options) {
        option.setAttribute('aria-pressed', String(Boolean(remaining) && selected === minutes));
      }
      cancel.disabled = !remaining;
      if (remaining) timer = setTimeout(tick, Math.min(remaining, 1000));
      if (expired) { close(); onExpire(); }
    }

    function clear() { deadline = selected = 0; tick(); close(); }
    button.onclick = () => {
      const opening = picker.hidden;
      tick();
      picker.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      if (opening) options[0].option.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', event => {
      if (!picker.hidden && !picker.contains(event.target) && !button.contains(event.target)) close();
    });
    picker.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(true); }
    });
    document.addEventListener('visibilitychange', () => { if (deadline) tick(); });
    window.addEventListener('pageshow', () => { if (deadline) tick(); });
    tick();
    return { button, picker, clear };
  }

  return { create };
})();
