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
      // solid as soon as the page moves, so hero copy never slides under a see-through bar
      hdr.classList.toggle('solid', window.scrollY > 8);
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
    // an anchor on the current page (/#contact) does not reload it, so shut the drawer ourselves
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) drawer.classList.remove('open');
    });
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

  // Contact dock: a floating button (desktop) or a bottom bar (mobile) that keeps
  // WhatsApp, a call booking and email one click away on every page. Every
  // "#contact" link opens it too. The panel is built in views so an "Ask" view
  // (AI assistant) can slot in later next to "main" and "cal".
  module('contact-dock', function () {
    var WA = '380973530670';
    var CAL = 'https://cal.com/alyona-kalchuk-4obylz/30min';
    var MAIL = 'reprolegal@gmail.com';
    var T = {
      en: { prefix: '', fab: 'Contact', title: 'Talk to us', role: 'Owner · replies within 24 hours', call: 'Book a free 30-minute call', bar: 'Book a call', mail: 'Email', more: 'Or leave a message', back: 'Back', close: 'Close', wa: "Hello! I'd like to ask about a programme." },
      uk: { prefix: '/ua', fab: 'Контакти', title: 'Напишіть нам', role: 'Засновниця · відповідає протягом 24 годин', call: 'Безкоштовний дзвінок 30 хвилин', bar: 'Дзвінок', mail: 'Email', more: 'Або залиште повідомлення', back: 'Назад', close: 'Закрити', wa: 'Вітаю! Хочу дізнатися про програму.' },
      de: { prefix: '/de', fab: 'Kontakt', title: 'Sprechen Sie mit uns', role: 'Inhaberin · Antwort innerhalb von 24 Stunden', call: 'Kostenloses 30-Minuten-Gespräch', bar: 'Termin', mail: 'E-Mail', more: 'Oder eine Nachricht hinterlassen', back: 'Zurück', close: 'Schließen', wa: 'Hallo! Ich interessiere mich für ein Programm.' },
      fr: { prefix: '/fr', fab: 'Contact', title: 'Parlons-en', role: 'Fondatrice · réponse sous 24 heures', call: 'Appel gratuit de 30 minutes', bar: 'Appel', mail: 'E-mail', more: 'Ou laissez un message', back: 'Retour', close: 'Fermer', wa: "Bonjour ! J'aimerais me renseigner sur un programme." },
      es: { prefix: '/es', fab: 'Contacto', title: 'Hable con nosotros', role: 'Fundadora · respuesta en menos de 24 horas', call: 'Llamada gratuita de 30 minutos', bar: 'Llamada', mail: 'Email', more: 'O deje un mensaje', back: 'Volver', close: 'Cerrar', wa: '¡Hola! Me gustaría informarme sobre un programa.' },
      it: { prefix: '/it', fab: 'Contatti', title: 'Parliamone', role: 'Titolare · risposta entro 24 ore', call: 'Chiamata gratuita di 30 minuti', bar: 'Chiamata', mail: 'Email', more: 'Oppure lasciate un messaggio', back: 'Indietro', close: 'Chiudi', wa: 'Buongiorno! Vorrei informazioni su un programma.' }
    };
    var t = T[(document.documentElement.lang || 'en').slice(0, 2)] || T.en;
    var waHref = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(t.wa);
    var track = function (action) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'contact_dock', contact_action: action });
    };
    var icon = {
      chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" stroke-linejoin="round"/></svg>',
      wa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
      cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
      mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="1"/><path d="m3.5 6.5 8.5 7 8.5-7"/></svg>'
    };

    var dock = document.createElement('div');
    dock.className = 'cdock';
    dock.innerHTML =
      '<button class="cdock-fab" type="button" aria-expanded="false" aria-controls="cdock-panel">' + icon.chat + '<span>' + t.fab + '</span></button>' +
      '<div class="cdock-panel" id="cdock-panel" role="dialog" aria-label="' + t.title + '" hidden>' +
        '<div class="cdock-view" data-view="main">' +
          '<button class="cdock-x" type="button" aria-label="' + t.close + '">&times;</button>' +
          '<div class="cdock-who"><img src="/img/team-alyona.webp" alt="" width="52" height="52" loading="lazy" />' +
            '<div><b>Alyona Kalchuk</b><small>' + t.role + '</small></div></div>' +
          '<p class="cdock-title">' + t.title + '</p>' +
          '<a class="cdock-btn cdock-wa" href="' + waHref + '" target="_blank" rel="noopener" data-track="whatsapp">' + icon.wa + 'WhatsApp</a>' +
          '<a class="cdock-btn" href="' + CAL + '" target="_blank" rel="noopener" data-view-go="cal" data-track="call">' + icon.cal + t.call + '</a>' +
          '<a class="cdock-btn" href="mailto:' + MAIL + '" data-track="email">' + icon.mail + MAIL + '</a>' +
          '<a class="cdock-more" href="' + t.prefix + '/#contact" data-dock-skip data-track="form">' + t.more + ' &rarr;</a>' +
        '</div>' +
        '<div class="cdock-view cdock-calview" data-view="cal" hidden>' +
          '<div class="cdock-calhead"><button class="cdock-back" type="button">&larr; ' + t.back + '</button>' +
          '<button class="cdock-x" type="button" aria-label="' + t.close + '">&times;</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="cdock-bar">' +
        '<a class="cdock-wa" href="' + waHref + '" target="_blank" rel="noopener" data-track="whatsapp">' + icon.wa + 'WhatsApp</a>' +
        '<a href="' + CAL + '" target="_blank" rel="noopener" data-track="call">' + icon.cal + t.bar + '</a>' +
      '</div>';
    document.body.appendChild(dock);

    var fab = dock.querySelector('.cdock-fab');
    var panel = dock.querySelector('.cdock-panel');
    var views = [].slice.call(dock.querySelectorAll('.cdock-view'));
    var mobile = window.matchMedia('(max-width: 760px)');

    var show = function (name) {
      views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
      dock.classList.toggle('wide', name === 'cal');
      if (name === 'cal' && !dock.querySelector('.cdock-calview iframe')) {
        var f = document.createElement('iframe');
        f.src = CAL + '?embed=true&theme=light';
        f.title = t.call;
        f.loading = 'lazy';
        dock.querySelector('.cdock-calview').appendChild(f);
      }
    };
    var open = function () {
      show('main');
      panel.hidden = false;
      dock.classList.add('open', 'shown');
      fab.setAttribute('aria-expanded', 'true');
      track('open');
    };
    var shut = function () {
      panel.hidden = true;
      dock.classList.remove('open', 'wide');
      fab.setAttribute('aria-expanded', 'false');
      onScroll();
    };

    fab.addEventListener('click', function () { dock.classList.contains('open') ? shut() : open(); });
    dock.addEventListener('click', function (e) {
      var el = e.target.closest('a,button');
      if (!el) return;
      if (el.hasAttribute('data-track')) track(el.getAttribute('data-track'));
      if (el.classList.contains('cdock-x')) shut();
      if (el.classList.contains('cdock-back')) show('main');
      // on a phone the calendar gets the whole screen in a new tab instead
      if (el.getAttribute('data-view-go') && !mobile.matches) { e.preventDefault(); show(el.getAttribute('data-view-go')); }
      if (el.hasAttribute('data-dock-skip')) shut();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
    document.addEventListener('click', function (e) {
      if (dock.classList.contains('open') && !dock.contains(e.target) && !e.target.closest('a[href$="#contact"]')) shut();
    });

    // every "contact" link on the site opens the dock instead of sending people to the bottom of the home page
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href$="#contact"]');
      if (!a || a.hasAttribute('data-dock-skip') || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      var drawer = document.getElementById('drawer');
      if (drawer) drawer.classList.remove('open');
      open();
    });

    // hidden over the first screen and while the real contact section is on screen
    var section = document.getElementById('contact');
    var sectionVisible = false;
    if (section && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        sectionVisible = entries[0].isIntersecting;
        onScroll();
      }, { threshold: 0.15 }).observe(section);
    }
    var onScroll = function () {
      var on = window.scrollY > 320 && !sectionVisible;
      dock.classList.toggle('shown', on || dock.classList.contains('open'));
      document.documentElement.classList.toggle('has-cbar', on);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });

  module('view-counter', function () {
    // the word after the count, in the page's language
    // one/few/many forms, picked by the language's own plural rules
    var WORD = {
      en: { one: 'read', other: 'reads' },
      uk: { one: 'прочитання', few: 'прочитання', many: 'прочитань', other: 'прочитання' },
      de: { one: 'Aufruf', other: 'Aufrufe' },
      fr: { one: 'lecture', other: 'lectures' },
      es: { one: 'lectura', other: 'lecturas' },
      it: { one: 'lettura', other: 'letture' }
    };
    var lang = WORD[document.documentElement.lang] ? document.documentElement.lang : 'en';
    var plural = window.Intl && Intl.PluralRules ? new Intl.PluralRules(lang) : { select: function (n) { return n === 1 ? 'one' : 'other'; } };
    var reads = function (n) {
      var w = WORD[lang];
      return n.toLocaleString(lang === 'en' ? 'en-US' : lang) + ' ' + (w[plural.select(n)] || w.other);
    };

    // article pages: increment and show
    var el = document.getElementById('views');
    if (el) {
      fetch('/api/views?path=' + encodeURIComponent(location.pathname))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          el.textContent = (d && typeof d.views === 'number') ? reads(d.views) : '';
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
          s.textContent = (typeof n === 'number' && n > 0) ? reads(n) : '';
        });
      })
      .catch(function () {});
  });
  module('consent', function () {
    // Cookie banner for Google Consent Mode v2. Nothing from Google loads until the visitor
    // accepts (see the loader in each page's <head>); a refusal is remembered and GTM never loads.
    var KEY = 'rl-consent', YEAR = 31536e6;
    var TXT = {
      en: { title: 'Cookies', body: 'We use analytics to see which pages help, and — only if you allow it — advertising cookies to show our ads to people who have visited. Nothing is set until you choose, and you can change your mind any time under Cookie settings.',
            policy: 'Cookie policy', reject: 'Reject all', settings: 'Settings', accept: 'Accept all', save: 'Save choices',
            nec: 'Necessary', necD: 'Remembers this choice. Always on.', an: 'Analytics', anD: 'Visits and page views, via Google Analytics.',
            ad: 'Advertising', adD: 'Measuring and showing our ads, via advertising platforms such as Google Ads.', footer: 'Cookie settings' },
      uk: { title: 'Cookie-файли', body: 'Ми використовуємо аналітику, щоб бачити, які сторінки корисні, і — лише з вашого дозволу — рекламні cookie, щоб показувати нашу рекламу тим, хто вже був на сайті. Нічого не встановлюється, доки ви не оберете, а змінити вибір можна будь-коли в «Налаштуваннях cookie».',
            policy: 'Політика cookie', reject: 'Відхилити все', settings: 'Налаштування', accept: 'Прийняти все', save: 'Зберегти вибір',
            nec: 'Необхідні', necD: 'Запам’ятовують цей вибір. Завжди увімкнені.', an: 'Аналітика', anD: 'Відвідування та перегляди сторінок, через Google Analytics.',
            ad: 'Реклама', adD: 'Вимірювання та показ нашої реклами, через рекламні платформи, як-от Google Ads.', footer: 'Налаштування cookie' },
      de: { title: 'Cookies', body: 'Wir nutzen Analyse-Cookies, um zu sehen, welche Seiten hilfreich sind, und – nur mit Ihrer Erlaubnis – Werbe-Cookies, um unsere Anzeigen Menschen zu zeigen, die uns bereits besucht haben. Nichts wird gesetzt, bevor Sie wählen, und Sie können Ihre Wahl jederzeit unter „Cookie-Einstellungen“ ändern.',
            policy: 'Cookie-Richtlinie', reject: 'Alle ablehnen', settings: 'Einstellungen', accept: 'Alle akzeptieren', save: 'Auswahl speichern',
            nec: 'Notwendig', necD: 'Speichert diese Auswahl. Immer aktiv.', an: 'Analyse', anD: 'Besuche und Seitenaufrufe, über Google Analytics.',
            ad: 'Werbung', adD: 'Messung und Ausspielung unserer Anzeigen, über Werbeplattformen wie Google Ads.', footer: 'Cookie-Einstellungen' },
      fr: { title: 'Cookies', body: 'Nous utilisons des cookies de mesure d’audience pour savoir quelles pages sont utiles et, uniquement avec votre accord, des cookies publicitaires pour montrer nos annonces aux personnes qui nous ont déjà rendu visite. Rien n’est déposé avant votre choix, et vous pouvez le modifier à tout moment dans « Paramètres des cookies ».',
            policy: 'Politique relative aux cookies', reject: 'Tout refuser', settings: 'Paramètres', accept: 'Tout accepter', save: 'Enregistrer mes choix',
            nec: 'Nécessaires', necD: 'Mémorisent ce choix. Toujours actifs.', an: 'Mesure d’audience', anD: 'Visites et pages vues, via Google Analytics.',
            ad: 'Publicité', adD: 'Mesure et diffusion de nos annonces, via des plateformes publicitaires comme Google Ads.', footer: 'Paramètres des cookies' },
      es: { title: 'Cookies', body: 'Usamos cookies analíticas para saber qué páginas resultan útiles y, solo si usted lo permite, cookies publicitarias para mostrar nuestros anuncios a quienes ya nos han visitado. No se instala nada hasta que usted elija, y puede cambiarlo en cualquier momento en «Configuración de cookies».',
            policy: 'Política de cookies', reject: 'Rechazar todo', settings: 'Configuración', accept: 'Aceptar todo', save: 'Guardar selección',
            nec: 'Necesarias', necD: 'Recuerdan esta elección. Siempre activas.', an: 'Analíticas', anD: 'Visitas y páginas vistas, mediante Google Analytics.',
            ad: 'Publicidad', adD: 'Medición y publicación de nuestros anuncios, mediante plataformas publicitarias como Google Ads.', footer: 'Configuración de cookies' },
      it: { title: 'Cookie', body: 'Usiamo cookie analitici per capire quali pagine sono utili e, solo se lo consenti, cookie pubblicitari per mostrare i nostri annunci a chi ci ha già visitato. Non viene impostato nulla finché non scegli, e puoi cambiare idea in qualsiasi momento da «Impostazioni cookie».',
            policy: 'Cookie policy', reject: 'Rifiuta tutto', settings: 'Impostazioni', accept: 'Accetta tutto', save: 'Salva le scelte',
            nec: 'Necessari', necD: 'Ricordano questa scelta. Sempre attivi.', an: 'Analitici', anD: 'Visite e pagine viste, tramite Google Analytics.',
            ad: 'Pubblicità', adD: 'Misurazione e pubblicazione dei nostri annunci, tramite piattaforme pubblicitarie come Google Ads.', footer: 'Impostazioni cookie' }
    };
    var FOLDER = { en: '', uk: '/ua', de: '/de', fr: '/fr', es: '/es', it: '/it' };
    var lang = TXT[document.documentElement.lang] ? document.documentElement.lang : 'en';
    var t = TXT[lang];

    function read() {
      try {
        var c = JSON.parse(localStorage.getItem(KEY) || 'null');
        return c && c.v === 1 && Date.now() - c.t < YEAR ? c : null;
      } catch (e) { return null; }
    }

    // put back the campaign tags and outside referrer this tab arrived with, so a visitor
    // who accepts on a later page is still attributed to the campaign that brought them
    function restoreLanding() {
      var land;
      try { land = JSON.parse(sessionStorage.getItem('rl-landing') || 'null'); } catch (e) {}
      if (!land) return;
      if (land.q && !/[?&](utm_|gclid=|gbraid=|wbraid=|fbclid=|msclkid=)/.test(location.search)) {
        var q = location.search ? location.search + '&' + land.q : '?' + land.q;
        history.replaceState(history.state, '', location.pathname + q + location.hash);
      }
      if (land.r && window.gtag) gtag('set', { page_referrer: land.r });
    }

    function clearGoogleCookies() {
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (!/^(_ga|_gid|_gat|_gcl|_fbp|_fbc)/.test(name)) return;
        var host = location.hostname, parts = host.split('.');
        [host, '.' + host, '.' + parts.slice(-2).join('.')].forEach(function (d) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + d;
        });
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      });
    }

    function decide(a, m) {
      var before = read();
      try { localStorage.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), a: !!a, m: !!m })); } catch (e) {}
      if (window.gtag) gtag('consent', 'update', {
        analytics_storage: a ? 'granted' : 'denied', ad_storage: m ? 'granted' : 'denied',
        ad_user_data: m ? 'granted' : 'denied', ad_personalization: m ? 'granted' : 'denied' });
      close();
      if (a || m) {
        if (!window.rlGTM) restoreLanding();
        window.dataLayer.push({ event: 'consent_update', consent_analytics: !!a, consent_ads: !!m });
        if (window.rlLoadGTM) window.rlLoadGTM();
      }
      // a withdrawal: drop what was set, and reload so the Google scripts already on the page stop
      if (before && ((before.a && !a) || (before.m && !m))) { clearGoogleCookies(); location.reload(); }
    }

    var box;
    function close() { if (box) { box.remove(); box = null; } document.documentElement.classList.remove('rlc-open'); }

    function open(withSettings) {
      close();
      var c = read() || { a: false, m: false };
      box = document.createElement('div');
      box.className = 'rlc';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-labelledby', 'rlc-title');
      box.innerHTML =
        '<div class="rlc-title" id="rlc-title">' + t.title + '</div>' +
        '<p class="rlc-body">' + t.body + ' <a href="' + FOLDER[lang] + '/cookies">' + t.policy + '</a></p>' +
        '<div class="rlc-prefs" hidden>' +
          '<label class="rlc-row"><span><b>' + t.nec + '</b><small>' + t.necD + '</small></span><input type="checkbox" checked disabled></label>' +
          '<label class="rlc-row"><span><b>' + t.an + '</b><small>' + t.anD + '</small></span><input type="checkbox" name="a"' + (c.a ? ' checked' : '') + '></label>' +
          '<label class="rlc-row"><span><b>' + t.ad + '</b><small>' + t.adD + '</small></span><input type="checkbox" name="m"' + (c.m ? ' checked' : '') + '></label>' +
        '</div>' +
        '<div class="rlc-actions">' +
          '<button type="button" class="rlc-btn" data-rlc="reject">' + t.reject + '</button>' +
          '<button type="button" class="rlc-btn" data-rlc="settings">' + t.settings + '</button>' +
          '<button type="button" class="rlc-btn" data-rlc="save" hidden>' + t.save + '</button>' +
          '<button type="button" class="rlc-btn" data-rlc="accept">' + t.accept + '</button>' +
        '</div>';
      document.body.appendChild(box);
      document.documentElement.classList.add('rlc-open');
      var prefs = box.querySelector('.rlc-prefs');
      var showPrefs = function () {
        prefs.hidden = false;
        box.querySelector('[data-rlc="settings"]').hidden = true;
        box.querySelector('[data-rlc="save"]').hidden = false;
      };
      if (withSettings) showPrefs();
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rlc]');
        if (!b) return;
        var act = b.getAttribute('data-rlc');
        if (act === 'accept') decide(true, true);
        else if (act === 'reject') decide(false, false);
        else if (act === 'settings') showPrefs();
        else if (act === 'save') decide(box.querySelector('[name="a"]').checked, box.querySelector('[name="m"]').checked);
      });
      box.querySelector('[data-rlc="accept"]').focus({ preventScroll: true });
    }

    // a way back to the choice from every page, next to the legal links in the footer
    var fbot = document.querySelector('.fbot');
    if (fbot) {
      var link = document.createElement('button');
      link.type = 'button';
      link.className = 'rlc-reopen';
      link.textContent = t.footer;
      link.addEventListener('click', function () { open(true); });
      fbot.appendChild(link);
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-cookie-settings]')) { e.preventDefault(); open(true); }
    });

    if (!read()) open(false);
  });
})();
