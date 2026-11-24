const DLookPlayMotion = (() => {
  const leaveDuration = 85;
  const revealDuration = 200;
  const loadLimit = 4000;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function snapshot(layout) {
    const pane = layout?.pane;
    const contents = pane ? [...pane.children].filter(child => !child.classList.contains('dlook-play-settings')) : [];
    return { pane, contents };
  }

  function viewChanged(previous, layout) {
    const next = snapshot(layout);
    return previous.pane !== next.pane || previous.contents.length !== next.contents.length ||
      previous.contents.some((child, index) => child !== next.contents[index]);
  }

  function create(schedule) {
    let shown, pending, revealTimer, unmaskedKey;

    function setPhase(phase) {
      const root = document.documentElement;
      if (phase) root?.setAttribute('data-dlook-route-phase', phase);
      else root?.removeAttribute('data-dlook-route-phase');
    }

    function finish(reveal = false) {
      clearTimeout(revealTimer);
      if (pending) {
        clearTimeout(pending.leaveTimer);
        clearTimeout(pending.loadTimer);
        pending.resolveStart(false);
        pending.resolveDone();
        pending = undefined;
      }
      if (reveal && !reduced.matches) {
        setPhase('in');
        revealTimer = setTimeout(() => setPhase(null), revealDuration);
      } else setPhase(null);
    }

    function begin(route, animateLeave = false) {
      if (!route.supported || route.key === shown?.route.key) return null;
      if (route.key === pending?.route.key) return pending;
      finish();
      const ticket = { route, expired: false };
      ticket.start = new Promise(resolve => { ticket.resolveStart = resolve; });
      ticket.done = new Promise(resolve => { ticket.resolveDone = resolve; });
      pending = ticket;
      if (animateLeave && shown && !reduced.matches) {
        setPhase('out');
        ticket.leaveTimer = setTimeout(() => {
          setPhase('wait');
          ticket.resolveStart(true);
        }, leaveDuration);
      } else {
        setPhase('wait');
        ticket.resolveStart(true);
      }
      ticket.loadTimer = setTimeout(() => {
        ticket.expired = true;
        schedule();
      }, loadLimit);
      return ticket;
    }

    function ready(route, layout) {
      if (!document.body || document.readyState === 'loading') {
        if (pending) setPhase('wait');
        return false;
      }
      if (!route.supported) return true;
      if (pending && route.key === shown?.route.key) {
        if (!pending.expired) return false;
        finish();
      }
      if (route.key === shown?.route.key) return true;
      const newPane = layout && (!shown || route.path === shown.route.path || viewChanged(shown.layout, layout));
      if (route.key === unmaskedKey) return Boolean(newPane);
      const ticket = begin(route);
      if (route.offline) return true;
      if (ticket?.expired) {
        if (newPane) return true;
        unmaskedKey = route.key;
        finish();
        return false;
      }
      return Boolean(newPane && !layout.pane.querySelector('[class*="_inner_"][aria-busy="true"]'));
    }

    function historyChanged(route) {
      if (pending && route.key === shown?.route.key) finish();
      else begin(route);
    }

    function present(route, layout) {
      const changed = shown?.route.key !== route.key;
      shown = { route, layout: snapshot(layout) };
      unmaskedKey = undefined;
      if (pending || !route.supported) finish(changed && route.supported && Boolean(layout || route.offline));
    }

    return { begin, ready, historyChanged, present };
  }

  return { create };
})();
