// User preferences stored in localStorage and synced across tabs.

const key = 'dlook-next-prefs';
const defaults = {
  accent: 'blue',            // 'blue' | 'pink'
  appearance: 'auto',        // 'auto' | 'light' | 'dark'
  librarySort: 'purchased',  // purchased | purchasedOld | release | title | circle | recent
  libraryLayout: 'grid',     // grid | list
  libraryDensity: 'comfortable',
  libraryCategory: 'all',
  skipBack: 15,
  skipForward: 30,
  autoplayNext: true,
  volume: 1,
  rates: {},                 // workno -> playback rate
  readerDirection: 'rtl',    // rtl | ltr
  readerMode: 'auto',        // auto | single | spread | vertical
  readerFit: 'screen',       // screen | width
  captionMode: 'lyrics',     // off | lyrics (previous / current / next, scrollable) | single (current line only)
  hideCaptionFiles: true,    // hide caption files that belong to an audio/video file in the same folder
  textSize: 16,              // text file viewer font size (px)
  motion: 'full',            // full | system (follow the OS reduce-motion setting)
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    const merged = { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
    // Earlier versions had an on/off captions switch.
    if (!saved?.captionMode && saved?.showCaptions === false) merged.captionMode = 'off';
    delete merged.showCaptions;
    // Carry over the previous extension's theme choice.
    if (!saved?.accent) {
      const legacy = localStorage.getItem('dlook-play-theme');
      if (legacy === 'pink' || legacy === 'blue') merged.accent = legacy;
    }
    return merged;
  } catch {
    return { ...defaults };
  }
}

export const get = name => state[name];
export const all = () => ({ ...state });

export function set(name, value) {
  if (state[name] === value) return;
  state = { ...state, [name]: value };
  try {
    localStorage.setItem(key, JSON.stringify(state));
    if (name === 'accent') localStorage.setItem('dlook-next-accent', value);
    if (name === 'appearance') localStorage.setItem('dlook-next-appearance', value);
  } catch {}
  for (const listener of listeners) listener(name, value);
}

export const onChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };

window.addEventListener('storage', event => {
  if (event.key !== key) return;
  const previous = state;
  state = load();
  for (const name of Object.keys(state)) {
    if (previous[name] !== state[name]) for (const listener of listeners) listener(name, state[name]);
  }
});
