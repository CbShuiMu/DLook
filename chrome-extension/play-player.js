const DLookPlayPlayer = (() => {
  const artwork = '[class*="_audioPlayer_"] [class*="_albumart_"]';
  let container, observed, source, remembered, subtitleButton, sleep;
  const observer = new MutationObserver(() => {
    updateArtwork();
    DLookPlayCaptions.updateNative(container?.querySelector('[class*="_audioPlayer_"]'));
  });
  const coverTimers = new WeakMap();
  const modeButton = '#App [class*="_audioPlayer_"] :is([class*="_shuffle_"], [class*="_repeat_"])';
  let touch;

  // Safari can defer a compatibility click while resolving hover/tooltips. Send
  // one native click on a completed tap and cancel the delayed compatibility one.
  document.addEventListener('touchstart', event => {
    const button = event.target.closest?.(modeButton);
    const point = event.touches[0];
    touch = button && !button.disabled && event.touches.length === 1 ?
      { button, id: point.identifier, x: point.clientX, y: point.clientY } : undefined;
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', event => {
    const point = [...event.touches].find(point => point.identifier === touch?.id);
    if (!point || Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > 10) touch = undefined;
  }, { capture: true, passive: true });
  document.addEventListener('touchcancel', () => { touch = undefined; }, { capture: true, passive: true });
  document.addEventListener('touchend', event => {
    const tap = touch;
    touch = undefined;
    const point = [...event.changedTouches].find(point => point.identifier === tap?.id);
    if (!tap || !point || event.touches.length || !event.cancelable ||
        !tap.button.isConnected || tap.button.disabled ||
        event.target.closest?.(modeButton) !== tap.button ||
        Math.hypot(point.clientX - tap.x, point.clientY - tap.y) > 10) return;
    event.preventDefault();
    event.stopPropagation();
    tap.button.click();
  }, { capture: true, passive: false });

  function setBackground(player, background) {
    if (!player) return;
    if (background) player.style.setProperty('--dlook-player-cover', background);
    else player.style.removeProperty('--dlook-player-cover');
  }

  function fitCover(frame, image) {
    if (image.naturalWidth && image.naturalHeight) {
      frame.style.setProperty('--dlook-cover-ratio', image.naturalWidth / image.naturalHeight);
    }
  }

  function animateCover(stage) {
    clearTimeout(coverTimers.get(stage));
    stage.setAttribute('data-dlook-cover-moving', '');
    coverTimers.set(stage, setTimeout(() => stage.removeAttribute('data-dlook-cover-moving'), 280));
  }

  function updateSubtitleButton(player) {
    const source = player?.querySelector('[data-dd-action-name="player.subtitle"]');
    const stage = player?.querySelector('[class*="_albumartWrapper_"]');
    if (!source || !stage) {
      subtitleButton?.remove();
      subtitleButton = undefined;
      return;
    }
    if (subtitleButton?.parentElement !== stage) {
      subtitleButton?.remove();
      subtitleButton = document.createElement('button');
      subtitleButton.type = 'button';
      subtitleButton.className = 'dlook-caption-toggle';
      subtitleButton.append(DLookPlayIcons.create('captions'));
      subtitleButton.onclick = () => {
        animateCover(stage);
        player.querySelector('[data-dd-action-name="player.subtitle"]')?.click();
      };
      stage.append(subtitleButton);
    }
    source.setAttribute('data-dlook-subtitle-source', '');
    const label = source.getAttribute('aria-label');
    if (label && subtitleButton.getAttribute('aria-label') !== label) subtitleButton.setAttribute('aria-label', label);
    subtitleButton.setAttribute('aria-pressed', String(source.hasAttribute('data-active') && source.getAttribute('data-active') !== 'false'));
  }

  function updateSleep(player) {
    const stage = player?.querySelector('[class*="_albumartWrapper_"]');
    if (stage) {
      sleep ??= DLookPlaySleep.create(() => {
        const control = container?.querySelector('[data-control="play-pause"], [data-dd-action-name="player.mini_play_pause"]');
        // The native pause glyph has this viewBox; checking it avoids resuming
        // an already paused player when the deadline expires.
        if (control?.querySelector('svg[viewBox="0 0 77 100"]')) control.click();
      });
      if (sleep.button.parentElement !== stage) stage.append(sleep.button, sleep.picker);
    } else if (!container?.querySelector('[data-dd-action-name="player.mini_open"]')) sleep?.clear();
  }

  function updateArtwork() {
    const background = observed?.style.backgroundImage;
    setBackground(container?.querySelector('[class*="_audioPlayer_"]'), background);
    const url = /^url\(["']?(.*?)["']?\)$/.exec(background ?? '')?.[1];
    if (observed && url !== source) {
      source = url;
      observed.style.removeProperty('--dlook-cover-ratio');
      if (url) {
        const frame = observed;
        const image = new Image();
        image.onload = () => {
          if (frame === observed && url === source) fitCover(frame, image);
        };
        image.src = url;
      }
    }

    const album = observed?.closest('[class*="_audioPlayer_"]')?.querySelector('[class*="_album_"]')?.textContent.trim();
    if (url && album && !url.includes('no_img')) remembered = { album, background };

    const mini = container?.querySelector('[data-dd-action-name="player.mini_open"]');
    if (!mini) return;
    const name = mini.querySelector('[class*="_album_"]')?.textContent.trim();
    const metadata = navigator.mediaSession?.metadata;
    const mainImage = name && metadata?.album === name ? metadata.artwork?.[0]?.src : '';
    const cover = name && remembered?.album === name ? remembered.background :
      mainImage && !mainImage.includes('no_img') ? `url(${JSON.stringify(mainImage)})` : '';
    if (cover) mini.style.setProperty('--dlook-mini-cover', cover);
    else mini.style.removeProperty('--dlook-mini-cover');
  }

  function update(pageContainer) {
    container = pageContainer;
    const next = container?.querySelector(artwork);
    if (next !== observed) {
      observer.disconnect();
      observed = next;
      source = undefined;
      if (observed) observer.observe(observed, { attributes: true, attributeFilter: ['style'] });
    }
    updateArtwork();
    const player = container?.querySelector('[class*="_audioPlayer_"]');
    updateSubtitleButton(player);
    updateSleep(player);
    DLookPlayCaptions.updateNative(player);
    DLookPlayerMotion.updateNative(container);
  }

  return { fitCover, animateCover, setBackground, update };
})();
