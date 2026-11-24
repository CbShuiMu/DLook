const DLookPlayPlayer = (() => {
  const artwork = '[class*="_audioPlayer_"] [class*="_albumart_"]';
  let container, observed, source, remembered, subtitleButton;
  const observer = new MutationObserver(updateArtwork);
  const coverTimers = new WeakMap();

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
    subtitleButton.setAttribute('aria-pressed', String(source.getAttribute('data-active') === 'true'));
  }

  function updateArtwork() {
    const background = observed?.style.backgroundImage;
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
    DLookPlayCaptions.updateNative(player);
  }

  return { fitCover, animateCover, update };
})();
