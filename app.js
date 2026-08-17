/* ============================================================
   ADS · Agência Digital & Sites
   Hero com rolagem que controla o vídeo + interações da página
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  var hero = $('#topo');
  var video = $('#hero');
  var still = $('#still');
  var loader = $('#loader');
  var ring = $('#ring');
  var loadTxt = $('#loadTxt');
  var settle = $('#settle');
  var settleBg = $('#settleBg');
  var cue = $('#cue');
  var rail = $('#rail');
  var railFill = $('#railFill');
  var nav = $('#nav');
  var fab = $('#fab');
  var bands = $$('.band');

  var RING = 126;
  var ZAP = '5535988284531';
  var SOURCES = [];
  var srcIndex = 0;

  var DUR = 0, shown = 0, target = 0;
  var busy = false, pending = null, raf = 0;
  var videoMode = false;

  /* ---------------------------------------------------------
     1. Os cinco portões: quando o vídeo NÃO roda
     --------------------------------------------------------- */
  function wantsVideo() {
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      if (window.innerWidth < 900 || window.innerHeight < 520) return false;
      if (matchMedia('(pointer: coarse)').matches) return false;
      var c = navigator.connection || {};
      if (c.saveData) return false;
      if (/(^|-)(2g|slow-2g)$/.test(c.effectiveType || '')) return false;
      if (!window.fetch || !window.Blob || !window.URL || !URL.createObjectURL) return false;

      /* qual formato este navegador toca de verdade */
      var v = document.createElement('video');
      if (!v.canPlayType) return false;
      SOURCES = [];
      if (v.canPlayType('video/mp4; codecs="avc1.640028"') ||
          v.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
        SOURCES.push({ url: 'assets/hero.mp4', type: 'video/mp4' });
      }
      if (v.canPlayType('video/webm; codecs="vp9"')) {
        SOURCES.push({ url: 'assets/hero.webm', type: 'video/webm' });
      }
      if (!SOURCES.length && v.canPlayType('video/mp4')) {
        SOURCES.push({ url: 'assets/hero.mp4', type: 'video/mp4' });
      }
      return SOURCES.length > 0;
    } catch (e) { return false; }
  }

  function hideLoader() {
    loader.classList.add('gone');
    setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 900);
  }

  function goStatic() {
    videoMode = false;
    hero.classList.add('static');
    still.classList.add('on');
    settle.classList.add('on');
    if (video && video.parentNode) { video.removeAttribute('src'); video.load && video.load(); }
    hideLoader();
    chrome();
  }

  function setProgress(f) {
    ring.style.strokeDashoffset = String(RING - RING * clamp(f, 0, 1));
    loadTxt.textContent = f < 1 ? Math.round(f * 100) + '%' : 'Pronto';
  }

  /* ---------------------------------------------------------
     2. Baixar o vídeo mostrando o progresso de verdade
     --------------------------------------------------------- */
  function loadVideo() {
    var died = false;
    var src = SOURCES[srcIndex];
    if (!src) { goStatic(); return; }
    var bail = setTimeout(function () { died = true; nextSource(); }, 20000);

    function nextSource() {
      clearTimeout(bail);
      srcIndex++;
      if (srcIndex < SOURCES.length) { died = false; setProgress(0.04); loadVideo(); }
      else goStatic();
    }

    /* dois cliques no arquivo: o navegador bloqueia o fetch, mas o vídeo
       carrega direto. sem barra de progresso, e funciona igual. */
    if (location.protocol === 'file:') {
      clearTimeout(bail);
      setProgress(0.5);
      attach(src.url, true);
      return;
    }

    function attach(url, direct) {
      var done = false;
      var ok = function () {
        if (done) return; done = true;
        video.removeEventListener('loadedmetadata', ok);
        video.removeEventListener('error', bad);
        clearTimeout(bail);
        DUR = video.duration || 18.1;
        videoMode = true;
        video.currentTime = 0;
        video.classList.add('on');
        still.classList.remove('on');
        setTimeout(hideLoader, 260);
        kick();
      };
      var bad = function () {
        if (done) return; done = true;
        video.removeEventListener('loadedmetadata', ok);
        video.removeEventListener('error', bad);
        nextSource();
      };
      video.addEventListener('loadedmetadata', ok);
      video.addEventListener('error', bad);
      video.preload = 'auto';
      video.src = url;
      video.load();
      if (direct) setTimeout(function () { if (!done) bad(); }, 15000);
    }

    fetch(src.url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        var total = parseInt(res.headers.get('content-length') || '0', 10);
        if (!res.body || !res.body.getReader || !total) return res.blob();
        var reader = res.body.getReader();
        var chunks = [], got = 0;
        return (function pump() {
          return reader.read().then(function (r) {
            if (r.done) return new Blob(chunks, { type: src.type });
            chunks.push(r.value);
            got += r.value.length;
            setProgress(got / total);
            return pump();
          });
        })();
      })
      .then(function (blob) {
        if (died) return;
        setProgress(1);
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(blob);
          var ok = function () {
            video.removeEventListener('loadedmetadata', ok);
            video.removeEventListener('error', bad);
            resolve();
          };
          var bad = function () {
            video.removeEventListener('loadedmetadata', ok);
            video.removeEventListener('error', bad);
            reject(new Error('decode'));
          };
          video.addEventListener('loadedmetadata', ok);
          video.addEventListener('error', bad);
          video.preload = 'auto';
          video.src = url;
          video.load();
        });
      })
      .then(function () {
        if (died) return;
        clearTimeout(bail);
        DUR = video.duration || 18.1;
        videoMode = true;
        video.currentTime = 0;
        video.classList.add('on');
        still.classList.remove('on');
        setTimeout(hideLoader, 260);
        kick();
      })
      .catch(function () {
        if (died) return;
        nextSource();
      });
  }

  /* ---------------------------------------------------------
     3. Motor de rolagem: um seek por vez, laço que descansa
     --------------------------------------------------------- */
  function heroProgress() {
    var total = hero.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / total, 0, 1);
  }

  function seek(t) {
    if (busy) { pending = t; return; }
    if (Math.abs(video.currentTime - t) < 0.018) return;
    busy = true;
    try { video.currentTime = t; }
    catch (e) { busy = false; }
  }

  if (video) {
    video.addEventListener('seeked', function () {
      busy = false;
      if (pending !== null) { var t = pending; pending = null; seek(t); }
    });
    video.addEventListener('error', function () { if (videoMode) goStatic(); });
  }

  var lastBand = -2, lastSettle = -1, lastRail = -1, lastCue = null, lastRailHide = null;
  var RANGES = [[0.045, 0.200], [0.300, 0.440], [0.600, 0.700], [0.730, 0.825]];

  function paint(p) {
    var idx = -1, i;
    for (i = 0; i < RANGES.length; i++) {
      if (p >= RANGES[i][0] && p < RANGES[i][1]) { idx = i; break; }
    }
    if (idx !== lastBand) {
      for (i = 0; i < bands.length; i++) bands[i].classList.toggle('on', i === idx);
      lastBand = idx;
    }

    var s = clamp((p - 0.845) / 0.115, 0, 1);
    var sr = Math.round(s * 100);
    if (sr !== lastSettle) {
      settleBg.style.opacity = (s * 0.96).toFixed(3);
      settle.classList.toggle('on', s > 0.4);
      lastSettle = sr;
    }

    var r = Math.round(p * 1000) / 10;
    if (r !== lastRail) { railFill.style.height = r + '%'; lastRail = r; }

    var hc = p > 0.035;
    if (hc !== lastCue) { cue.classList.toggle('hide', hc); lastCue = hc; }
    var hr = p > 0.965 || p < 0.02;
    if (hr !== lastRailHide) { rail.classList.toggle('hide', hr); lastRailHide = hr; }
  }

  function frame() {
    raf = 0;
    var p = heroProgress();
    paint(p);
    if (videoMode && DUR) {
      target = p * DUR;
      var d = target - shown;
      shown += d * 0.17;
      if (Math.abs(d) < 0.008) shown = target;
      seek(shown);
      if (Math.abs(target - shown) > 0.008) raf = requestAnimationFrame(frame);
    }
  }

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  /* ---------------------------------------------------------
     4. Nav, botão flutuante, linha lateral, revelações
     --------------------------------------------------------- */
  function chrome() {
    var past = hero.getBoundingClientRect().bottom < window.innerHeight * 0.62;
    nav.classList.toggle('on', past);
    fab.classList.toggle('on', past);
  }

  var spines = $$('.spine');
  function drawSpines() {
    for (var i = 0; i < spines.length; i++) {
      var sec = spines[i].parentNode;
      var b = sec.getBoundingClientRect();
      var p = clamp((window.innerHeight * 0.86 - b.top) / (b.height * 0.86), 0, 1);
      var fill = spines[i].firstElementChild;
      if (fill) fill.style.height = (p * 100).toFixed(1) + '%';
    }
  }

  var ticking = false;
  function onScroll() {
    kick();
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      chrome();
      drawSpines();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { lastRail = -1; onScroll(); }, { passive: true });

  if ('IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) {
        if (es[i].isIntersecting) { es[i].target.classList.add('in'); rio.unobserve(es[i].target); }
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });
    $$('.rv, .step').forEach(function (el) { rio.observe(el); });
  } else {
    $$('.rv, .step').forEach(function (el) { el.classList.add('in'); });
  }

  /* stagger inside groups */
  $$('.pain, .steps, .plans, .work-list, .shield').forEach(function (g) {
    var kids = $$('.rv, .step', g);
    kids.forEach(function (k, i) { k.style.transitionDelay = (i * 85) + 'ms'; });
  });

  /* ---------------------------------------------------------
     5. Dúvidas
     --------------------------------------------------------- */
  $$('.faq-i').forEach(function (item) {
    var btn = $('.faq-q', item);
    var pane = $('.faq-a', item);
    btn.addEventListener('click', function () {
      var open = item.classList.contains('open');
      $$('.faq-i.open').forEach(function (o) {
        if (o !== item) {
          o.classList.remove('open');
          $('.faq-q', o).setAttribute('aria-expanded', 'false');
          $('.faq-a', o).style.height = '0px';
        }
      });
      if (open) {
        item.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        pane.style.height = '0px';
      } else {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        pane.style.height = pane.scrollHeight + 'px';
      }
    });
  });
  window.addEventListener('resize', function () {
    $$('.faq-i.open .faq-a').forEach(function (p) { p.style.height = p.scrollHeight + 'px'; });
  }, { passive: true });


  /* ---------------------------------------------------------
     6. Formulário: monta a mensagem e abre o WhatsApp
     --------------------------------------------------------- */
  var form = $('#form'), err = $('#err'), hp = $('#hp');
  var opened = Date.now();

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';

      /* antispam: campo escondido + tempo mínimo de preenchimento */
      if (hp && hp.value) return;
      if (Date.now() - opened < 2500) { err.textContent = 'Confere os dados e tenta de novo.'; return; }

      var nome = $('#fn').value.trim();
      var neg = $('#fb').value.trim();
      var zap = $('#fw').value.trim();
      var oque = $('#fq').value;

      if (nome.length < 2) { err.textContent = 'Escreve seu nome, por favor.'; $('#fn').focus(); return; }
      if (neg.length < 2) { err.textContent = 'Diz qual é o seu negócio.'; $('#fb').focus(); return; }
      if (zap.replace(/\D/g, '').length < 10) { err.textContent = 'O WhatsApp precisa do DDD.'; $('#fw').focus(); return; }

      var msg = 'Olá! Vim pelo site da ADS.\n\n' +
        'Nome: ' + nome + '\n' +
        'Negócio: ' + neg + '\n' +
        'WhatsApp: ' + zap + '\n' +
        'Preciso de: ' + oque;

      window.open('https://wa.me/' + ZAP + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
    });
  }

  /* ---------------------------------------------------------
     7. Ano do rodapé + arranque
     --------------------------------------------------------- */
  var ano = $('#ano');
  if (ano) ano.textContent = new Date().getFullYear();

  chrome();
  drawSpines();

  if (wantsVideo()) {
    setProgress(0.04);
    loadVideo();
  } else {
    goStatic();
  }

  /* teclado: setas movem o topo sem travar */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      $$('.faq-i.open').forEach(function (o) {
        o.classList.remove('open');
        $('.faq-q', o).setAttribute('aria-expanded', 'false');
        $('.faq-a', o).style.height = '0px';
      });
    }
  });
})();
