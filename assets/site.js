/* ReproLegal — shared behaviour.
   Every module is guarded and isolated: a failure in one can never stop the others,
   and content is never left hidden because a script threw. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealAll() {
    document.querySelectorAll('.reveal:not(.in)').forEach(function (e) { e.classList.add('in'); });
    document.querySelectorAll('.word:not(.in)').forEach(function (e) { e.classList.add('in'); });
  }

  /* safety net: if anything below throws, or an observer never fires,
     nothing stays invisible for more than a few seconds */
  window.addEventListener('error', revealAll);
  setTimeout(revealAll, 4000);

  function module(name, fn) {
    try { fn(); } catch (err) { console.warn('[site.js] ' + name + ' failed:', err); }
  }

  module('header', function () {
    var hdr = document.getElementById('hdr');
    if (!hdr) return;
    if (hdr.classList.contains('solid')) return;   // inner pages are solid from the start
    var onScroll = function () {
      hdr.classList.toggle('solid', window.scrollY > window.innerHeight * 0.75);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });

  module('drawer', function () {
    var drawer = document.getElementById('drawer');
    var burger = document.getElementById('burger');
    var close = document.getElementById('close');
    if (!drawer || !burger) return;
    burger.addEventListener('click', function () { drawer.classList.add('open'); });
    if (close) close.addEventListener('click', function () { drawer.classList.remove('open'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') drawer.classList.remove('open');
    });
  });

  module('hero-headline', function () {
    var h = document.getElementById('heroH1');
    if (!h) return;                                 // <- the bug: this page simply has no hero
    // On phones the per-word spans are atomic boxes and wrapping goes to pieces,
    // so the whole headline fades in as one block instead.
    if (window.matchMedia('(max-width:760px)').matches) {
      h.style.opacity = 0;
      h.style.transition = 'opacity .8s cubic-bezier(.22,.61,.36,1)';
      setTimeout(function () { h.style.opacity = 1; }, reduce ? 0 : 200);
      return;
    }
    var words = h.textContent.trim().split(/\s+/);
    h.innerHTML = words.map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
    h.querySelectorAll('.word').forEach(function (s, i) {
      setTimeout(function () { s.classList.add('in'); }, reduce ? 0 : 260 + i * 45);
    });
  });

  module('scroll-reveal', function () {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) { revealAll(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  });

  module('parallax', function () {
    var bg = document.getElementById('jbg');
    if (!bg || reduce) return;
    var band = bg.parentElement, ticking = false;
    function upd() {
      var r = band.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { ticking = false; return; }
      var p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      bg.style.transform = 'scale(1.12) translateY(' + (p * -38).toFixed(1) + 'px)';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(upd); }
    }, { passive: true });
    upd();
  });

  module('counters', function () {
    var els = document.querySelectorAll('.count');
    if (!els.length) return;
    var small = window.matchMedia('(max-width:560px)');
    function paint(el, p) {
      var suf = (small.matches && el.getAttribute('data-suffix-sm')) || el.getAttribute('data-suffix') || '';
      el.textContent = (el.getAttribute('data-prefix') || '') +
        Math.round(+el.getAttribute('data-to') * p).toLocaleString('en-US') + suf;
    }
    function run(el) {
      if (el.dataset.done) return; el.dataset.done = '1';
      if (reduce) { paint(el, 1); return; }
      var t0 = null;
      (function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / 1400, 1);
        paint(el, 1 - Math.pow(1 - p, 4));
        if (p < 1) requestAnimationFrame(step);
      })(performance.now());
    }
    if (small.addEventListener) small.addEventListener('change', function () {
      els.forEach(function (e) { if (e.dataset.done) paint(e, 1); });
    });
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { paint(e, 1); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    els.forEach(function (e) { io.observe(e); });
  });

  module('team-carousel', function () {
    var track = document.getElementById('ttrack');
    if (!track) return;
    var cards = [].slice.call(track.querySelectorAll('.tperson'));
    var dots  = document.getElementById('tdots');
    var prev  = document.getElementById('tprev');
    var next  = document.getElementById('tnext');
    if (!cards.length) return;

    function step() {
      var r = cards[0].getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      return r.width + gap;
    }
    function maxScroll() { return track.scrollWidth - track.clientWidth; }
    function pages() { return Math.max(1, Math.ceil(maxScroll() / step()) + 1); }

    function buildDots() {
      dots.innerHTML = '';
      var n = pages();
      if (n <= 1) { dots.style.display = 'none'; return; }
      dots.style.display = 'flex';
      for (var i = 0; i < n; i++) {
        var b = document.createElement('i');
        (function (idx) {
          b.addEventListener('click', function () {
            track.scrollTo({ left: idx * step(), behavior: reduce ? 'auto' : 'smooth' });
          });
        })(i);
        dots.appendChild(b);
      }
    }

    function sync() {
      var m = maxScroll();
      var wrap = track.closest('.tcarousel');
      if (wrap) wrap.classList.toggle('static', m <= 2);   // nothing to scroll -> hide the chrome
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = track.scrollLeft >= m - 4;
      var i = m <= 0 ? 0 : Math.round(track.scrollLeft / step());
      [].forEach.call(dots.children, function (b, n) { b.classList.toggle('on', n === i); });
    }

    if (prev) prev.addEventListener('click', function () {
      track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' });
    });
    if (next) next.addEventListener('click', function () {
      track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' });
    });
    track.addEventListener('scroll', function () {
      window.clearTimeout(track._t);
      track._t = window.setTimeout(sync, 60);
    }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
    });
    window.addEventListener('resize', function () {
      window.clearTimeout(track._r);
      track._r = window.setTimeout(function () { buildDots(); sync(); }, 150);
    });

    buildDots(); sync();
  });

  module('view-counter', function () {
    // article pages: increment and show
    var el = document.getElementById('views');
    if (el) {
      fetch('/api/views?path=' + encodeURIComponent(location.pathname))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          el.textContent = (d && typeof d.views === 'number') ? d.views.toLocaleString('en-US') + ' reads' : '';
        })
        .catch(function () { el.textContent = ''; });
    }

    // listing pages: read only, one request for every card
    var spans = [].slice.call(document.querySelectorAll('[data-views]'));
    if (!spans.length) return;
    var paths = spans.map(function (s) { return s.getAttribute('data-views'); });
    fetch('/api/views?peek=1&paths=' + encodeURIComponent(paths.join(',')))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.views) return;
        spans.forEach(function (s) {
          var n = d.views[s.getAttribute('data-views')];
          s.textContent = (typeof n === 'number' && n > 0) ? n.toLocaleString('en-US') + ' reads' : '';
        });
      })
      .catch(function () {});
  });
})();
