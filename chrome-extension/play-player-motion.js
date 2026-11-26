const DLookPlayerMotion = (() => {
  const fullSelector = '[class*="_audioPlayer_"]';
  const miniSelector = '[data-dd-action-name="player.mini_open"]';
  const artSelector = '[class*="_albumart_"], .dlook-audio-art';
  const thumbSelector = '[class*="_thumbnail_"], .dlook-audio-mini-thumb';
  const miniLike = `${miniSelector}, .dlook-offline-mini`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const openDuration = 420;
  const closeDuration = 340;
  const easing = 'cubic-bezier(.2,.75,.2,1)';
  let current;

  function rect(element) {
    const box = element?.getBoundingClientRect();
    return box?.width && box.height ? { left: box.left, top: box.top, width: box.width, height: box.height } : null;
  }

  function animate(ticket, element, frames, delay = 0, length = ticket.length, curve = easing) {
    const animation = element.animate(frames, { duration: length, delay, easing: curve, fill: 'both' });
    ticket.animations.push(animation);
    return animation;
  }

  function cleanup(ticket) {
    if (!ticket) return;
    clearTimeout(ticket.timeout);
    for (const animation of ticket.animations) animation.cancel();
    for (const element of [ticket.source, ticket.target, ticket.ghost]) {
      element?.removeAttribute('data-dlook-player-morph');
      element?.removeAttribute('data-dlook-player-covered');
    }
    ticket.ghost?.remove();
    ticket.art?.remove();
    ticket.skin?.remove();
    if (current === ticket) current = undefined;
  }

  // A mini-styled layer that rides on top of the morphing shell. Expanding, it
  // starts as an exact copy of the mini card and dissolves into the player;
  // collapsing, it settles into the mini's look before the real mini takes
  // over, so neither end of the morph swaps one surface for another.
  function addSkin(ticket, frames) {
    const layer = document.createElement('div');
    layer.className = 'dlook-player-mini-skin';
    layer.setAttribute('aria-hidden', 'true');
    ticket.root.append(layer);
    ticket.skin = layer;
    animate(ticket, layer, frames);
    animate(ticket, layer, ticket.open ?
      [{ opacity: 1 }, { opacity: 1, offset: .1 }, { opacity: 0, offset: .5 }, { opacity: 0 }] :
      [{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1, offset: .8 }, { opacity: 1 }],
    0, ticket.length, 'linear');
  }

  function addFace(ticket, mini, box) {
    if (!ticket.skin || ticket.face || !mini || !box) return;
    const face = mini.cloneNode(true);
    face.hidden = false;
    face.inert = true;
    face.removeAttribute('data-dlook-player-covered');
    // The mini sits on the bottom edge and the card grows upward from it. The
    // -1px offsets cancel the skin's border so the copy lands pixel-exact.
    const style = { position: 'absolute', left: '-1px', top: 'auto', right: 'auto', bottom: '-1px', margin: '0px',
      width: `${box.width}px`, height: `${box.height}px`, background: 'transparent', 'border-color': 'transparent',
      'box-shadow': 'none', transform: 'none', 'z-index': 'auto' };
    for (const [name, value] of Object.entries(style)) face.style.setProperty(name, value, 'important');
    ticket.skin.append(face);
    ticket.face = face;
    if (ticket.open) animate(ticket, face, [{ opacity: 1 }, { opacity: 0 }], 0, 110, 'ease-out');
    else {
      const elapsed = performance.now() - ticket.startedAt;
      const delay = Math.max(0, ticket.length * .55 - elapsed);
      animate(ticket, face, [{ opacity: 0 }, { opacity: 1 }], delay,
        Math.max(60, ticket.length - elapsed - delay), 'ease-out');
    }
  }

  function fallbackMini() {
    const probe = document.createElement('div');
    probe.className = 'dlook-offline-mini';
    probe.style.visibility = 'hidden';
    probe.setAttribute('aria-hidden', 'true');
    document.body.append(probe);
    const box = rect(probe);
    probe.remove();
    return box;
  }

  function thumbBox(mini, box) {
    return rect(mini?.querySelector(thumbSelector)) ??
      { left: box.left + 12, top: box.top + 10, width: 40, height: 40 };
  }

  function movingArtwork(ticket, from, to, frame) {
    let source = frame?.querySelector('img:not([hidden])')?.src;
    let background = source ? `url(${JSON.stringify(source)})` : frame && getComputedStyle(frame).backgroundImage;
    if ((!background || background === 'none') && ticket.artFrame) {
      source = ticket.artFrame.querySelector('img')?.src;
      background = source ? `url(${JSON.stringify(source)})` : getComputedStyle(ticket.artFrame).backgroundImage;
    }
    if (!background || background === 'none') return;
    const artwork = document.createElement('div');
    artwork.className = 'dlook-player-flying-art';
    artwork.style.backgroundImage = background;
    artwork.setAttribute('aria-hidden', 'true');
    document.body.append(artwork);
    ticket.art = artwork;
    ticket.skin?.setAttribute('data-dlook-art', '');
    const position = (box, radius) => ({ left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px`, borderRadius: `${radius}px` });
    animate(ticket, artwork, [position(from, ticket.open ? 8 : 16), position(to, ticket.open ? 16 : 8)]);
  }

  function completeWhenReady(ticket) {
    if (current === ticket && ticket.done && ticket.target?.isConnected) cleanup(ticket);
  }

  function start(ticket, target, targetMini) {
    if (current !== ticket || ticket.started) return;
    ticket.started = true;
    ticket.target = ticket.open ? target : undefined;
    const shell = ticket.open ? target : ticket.ghost;
    shell.setAttribute('data-dlook-player-morph', '');
    const full = ticket.open ? rect(target) : ticket.box;
    const small = ticket.open ? ticket.box : rect(targetMini) ?? fallbackMini();
    const frame = shell.querySelector(artSelector);
    const largeArt = rect(frame);
    if (!full || !small) { cleanup(ticket); return; }
    const children = [...shell.children].map(child => ({ child, box: rect(child) }));

    const position = (box, radius) => ({ left: `${box.left}px`, top: `${box.top}px`,
      right: 'auto', bottom: 'auto', margin: '0px', width: `${box.width}px`, height: `${box.height}px`, borderRadius: radius });
    const large = position(full, getComputedStyle(shell).borderRadius);
    const little = position(small, '14px');
    const frames = ticket.open ? [little, large] : [large, little];
    ticket.startedAt = performance.now();
    const animation = animate(ticket, shell, frames);
    // Hold the inner layout still while the outer card changes size. Long
    // caption transcripts should not reflow on every animation frame.
    for (const { child, box } of children) {
      if (!box) continue;
      const layout = { position: 'absolute', left: `${box.left - full.left}px`, top: `${box.top - full.top}px`,
        width: `${box.width}px`, height: `${box.height}px`, margin: '0px' };
      animate(ticket, child, ticket.open ? [{ ...layout, opacity: 0 }, { ...layout, opacity: 1 }] :
        [{ ...layout, opacity: 1 }, { ...layout, opacity: 0 }],
        ticket.open ? 110 : 0, ticket.open ? 240 : 100, 'ease-out');
    }
    if (!ticket.open || ticket.source.matches(miniLike)) {
      addSkin(ticket, frames);
      if (ticket.open) {
        // The native mini can stay mounted for a frame or two under the shell.
        ticket.source.setAttribute('data-dlook-player-covered', '');
        addFace(ticket, ticket.source, ticket.box);
      }
    }
    if (largeArt) movingArtwork(ticket, ticket.open ? ticket.thumb : largeArt,
      ticket.open ? largeArt : thumbBox(targetMini, small), frame);
    if (targetMini) revealMini(ticket, targetMini);
    animation.finished.then(() => {
      ticket.done = true;
      completeWhenReady(ticket);
    }, () => {});
  }

  function revealMini(ticket, mini) {
    if (ticket.target === mini) return;
    ticket.target = mini;
    if (!ticket.done) {
      // The real mini stays hidden until the skin above the shell already
      // looks like it; cleanup then swaps them on the same frame.
      mini.setAttribute('data-dlook-player-covered', '');
      addFace(ticket, mini, rect(mini));
    }
    completeWhenReady(ticket);
  }

  function prepare(source, open, artwork) {
    cleanup(current);
    if (reduced.matches || !source?.isConnected || source.hidden) return;
    const box = rect(source);
    if (!box) return;
    const ticket = { source, box, open, animations: [], length: open ? openDuration : closeDuration,
      root: source.closest('#App') ?? document.body };
    current = ticket;
    ticket.timeout = setTimeout(() => cleanup(ticket), 1500);
    if (open) {
      ticket.artFrame = artwork ?? source.querySelector(thumbSelector);
      ticket.thumb = rect(ticket.artFrame) ?? thumbBox(source, box);
    }
    else {
      // A cloned <video> would load its source again, so clone with placeholders in its place.
      const media = [...source.querySelectorAll('video')];
      const holders = media.map(node => {
        const holder = document.createElement('div');
        holder.className = node.className;
        holder.hidden = node.hidden;
        node.replaceWith(holder);
        return holder;
      });
      const ghost = source.cloneNode(true);
      holders.forEach((holder, index) => holder.replaceWith(media[index]));
      ghost.setAttribute('data-dlook-transition-ghost', '');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      ghost.style.cssText += `;position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;` +
        'right:auto;bottom:auto;margin:0;z-index:11000;pointer-events:none;';
      // Keep native selectors working, outside the live .loContainer queried by
      // the player adapter. React can unmount its player while this copy exits.
      ticket.root.append(ghost);
      const originals = source.querySelectorAll('[class*="_textTrack_"], .dlook-audio-captions');
      ghost.querySelectorAll('[class*="_textTrack_"], .dlook-audio-captions').forEach((pane, i) => {
        pane.scrollTop = originals[i]?.scrollTop ?? 0;
      });
      ticket.ghost = ghost;
      source.setAttribute('data-dlook-player-covered', '');
    }
    return ticket;
  }

  function change(source, target, open, commit, artwork) {
    const ticket = prepare(source, open, artwork);
    commit();
    if (ticket) start(ticket, target, open ? null : target);
  }

  function updateNative(container) {
    const ticket = current;
    if (!ticket?.native) return;
    const target = container?.querySelector(ticket.open ? fullSelector : miniSelector);
    if (!target) return;
    if (ticket.open) start(ticket, target);
    else revealMini(ticket, target);
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target.closest?.(miniSelector);
    const minimize = event.target.closest?.('[data-dd-action-name="player.minimize"], [class*="_hiddenButton_"]');
    const source = minimize?.closest(fullSelector) ?? target;
    if (!source || target && event.target.closest('[data-dd-action-name="player.mini_play_pause"], [class*="_close_"]')) return;
    const ticket = prepare(source, Boolean(target));
    if (!ticket) return;
    ticket.native = true;
    if (!ticket.open) start(ticket);
  }, true);
  window.addEventListener('resize', () => cleanup(current));
  window.addEventListener('pagehide', () => cleanup(current));
  reduced.addEventListener('change', () => { if (reduced.matches) cleanup(current); });
  return { change, updateNative };
})();
