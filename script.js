(function () {
  'use strict';

  /* ---------------- Nav: solid on scroll ---------------- */
  var nav = document.getElementById('nav');
  var progressBar = document.getElementById('progressBar');

  /* Mandatory scroll-snap only makes sense while stepping through the
     full-screen chapters. Once the user has landed on/inside "Para o seu
     negócio" (the snap point right after the last chapter), it becomes a
     trap: that section is taller than the viewport and nothing after it
     is a snap target, so the browser keeps pulling the page back to its
     top instead of letting the user scroll into the rest of the page. */
  var snapReleaseSection = document.getElementById('clientes');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('is-scrolled', y > 40);

    if (progressBar) {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? y / max : 0;
      progressBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, pct)) + ')';
    }

    if (snapReleaseSection) {
      document.documentElement.classList.toggle('snap-released', y >= snapReleaseSection.offsetTop);
    }
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', onScroll);
  onScroll();

  /* ---------------- Mobile nav (side drawer) ---------------- */
  var navToggle = document.getElementById('navToggle');
  var navBackdrop = document.getElementById('navBackdrop');
  var navLinks = document.getElementById('navLinks');
  if (nav && navToggle) {
    function closeNav() {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    function openNav() {
      nav.classList.add('is-open');
      navToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    navToggle.addEventListener('click', function () {
      if (nav.classList.contains('is-open')) closeNav(); else openNav();
    });
    if (navBackdrop) navBackdrop.addEventListener('click', closeNav);
    if (navLinks) {
      navLinks.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeNav);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------------- Stepped scroll chapters + floating sensor ---------------- */
  var chaptersWrap = document.getElementById('chapters');
  var chapters = document.querySelectorAll('.chapter');
  var sensorPos = document.getElementById('sensorFloatPos');
  var sensorColor = document.getElementById('sensorFloatColor');
  var dotsWrap = document.getElementById('chapterDots');
  var dots = dotsWrap ? dotsWrap.querySelectorAll('.dot') : [];
  var scrollCue = document.getElementById('scrollCue');
  var skipIntro = document.getElementById('skipIntro');
  var sensorColors = ['#4E2E86', '#1E3A8C', '#72C7F0', '#A8E3BA', '#EDF29A'];

  /* Move the whole card along a scroll-driven path. Its fixed parent keeps
     ownership of centering and the exit animation after the final chapter. */
  function createSensorMotion() {
    var card = sensorPos && sensorPos.querySelector('.sensor-float');
    if (!card) return;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Small vertical offsets and a flat rotation keep the card's proportions.
    var poses = [
      [0, 0],
      [-0.8, 1.5],
      [0.4, -1.2],
      [-0.5, 1],
      [0, 0]
    ];
    var stops = [];
    var travelY = 0;
    var tilt = 1;
    var frame = 0;
    var currentPose = null;
    var lastFrameTime = 0;

    function paint(pose) {
      var angle = pose[1] * tilt;
      card.style.transform = 'translate3d(0,' + (pose[0] * travelY).toFixed(3) + 'px,0) ' +
        'rotate(' + angle.toFixed(3) + 'deg)';

      card.style.setProperty('--sensor-shadow-x', ((8 - angle) * tilt).toFixed(2) + 'px');
      card.style.setProperty('--sensor-shadow-y', ((24 - pose[0] * 2) * tilt).toFixed(2) + 'px');
    }

    function draw(now) {
      frame = 0;
      if (reducedMotion.matches) {
        paint(poses[0]);
        card.style.transform = '';
        currentPose = null;
        lastFrameTime = 0;
        return;
      }
      if (document.hidden || !stops.length) {
        lastFrameTime = 0;
        return;
      }

      var scroll = window.scrollY;
      var index = 0;
      while (index < stops.length - 2 && scroll >= stops[index + 1]) index++;
      var distance = stops[index + 1] - stops[index];
      var progress = distance > 0 ? Math.min(1, Math.max(0, (scroll - stops[index]) / distance)) : 0;
      // Match position, velocity and acceleration at the chapter boundaries.
      var eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
      var from = poses[Math.min(index, poses.length - 1)];
      var to = poses[Math.min(index + 1, poses.length - 1)];
      var targetPose = from.map(function (value, axis) {
        return value + (to[axis] - value) * eased;
      });

      // Frame-rate-independent damping softens wheel and touch input. Continue
      // only until the card settles, so nothing keeps moving while idle.
      var elapsed = lastFrameTime ? Math.min(now - lastFrameTime, 64) : 1000 / 60;
      var blend = 1 - Math.exp(-elapsed / 160);
      var settling = false;
      if (!currentPose) currentPose = targetPose.slice();
      currentPose = currentPose.map(function (value, axis) {
        var difference = targetPose[axis] - value;
        if (Math.abs(difference) < 0.0005) return targetPose[axis];
        settling = true;
        return value + difference * blend;
      });
      paint(currentPose);
      lastFrameTime = settling ? now : 0;
      if (settling) requestDraw();
    }

    function requestDraw() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    /* On mobile/tablet the card sits stacked below the hero text instead of
       beside it. Center it in the gap between the wordmark and the scroll
       cue so the space above and below the card stays equal. */
    var heroWordmark = document.querySelector('.hero__wordmark');
    function centerSensorInGap(isMobileTablet) {
      if (!isMobileTablet || !heroWordmark || !scrollCue) {
        sensorPos.style.top = '';
        sensorPos.style.bottom = '';
        return;
      }
      var textBottom = heroWordmark.getBoundingClientRect().bottom;
      var cueTop = scrollCue.getBoundingClientRect().top;
      var sensorHeight = card.getBoundingClientRect().height;
      var gap = cueTop - textBottom;
      sensorPos.style.top = (textBottom + (gap - sensorHeight) / 2) + 'px';
      sensorPos.style.bottom = 'auto';
    }

    function measure() {
      var scroll = window.scrollY;
      stops = Array.prototype.map.call(chapters, function (chapter) {
        return chapter.getBoundingClientRect().top + scroll;
      });
      var mobile = window.matchMedia('(max-width: 600px)').matches;
      var tablet = window.matchMedia('(max-width: 940px)').matches;
      travelY = mobile ? 6 : tablet ? 8 : 12;
      tilt = mobile ? 0.6 : 1;
      centerSensorInGap(tablet);
      requestDraw();
    }

    document.addEventListener('scroll', requestDraw, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('pageshow', measure);
    window.addEventListener('load', measure);
    document.addEventListener('visibilitychange', requestDraw);
    reducedMotion.addEventListener('change', requestDraw);
    if ('ResizeObserver' in window) {
      var layoutObserver = new ResizeObserver(measure);
      chapters.forEach(function (chapter) { layoutObserver.observe(chapter); });
    }
    measure();
  }

  /* A few soft particles follow wide orbits only as the page scrolls.
     Time fades their trails without changing their positions. */
  function createPhotonField() {
    var canvas = document.getElementById('chapterPhotons');
    if (!canvas || !sensorColor) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var particles = [];
    var width = 0;
    var height = 0;
    var start = 0;
    var end = 0;
    var lastScroll = window.scrollY;
    var frame = 0;
    var orbit = 0;
    var colorUntil = 0;
    var color = '';
    var lightColor = '';
    var glow = document.createElement('canvas');
    glow.width = glow.height = 64;
    var glowCtx = glow.getContext('2d');
    if (!glowCtx) return null;
    var trailLifetime = 2600;

    function requestDraw() {
      if (!frame && !reducedMotion.matches && !document.hidden) {
        frame = requestAnimationFrame(draw);
      }
    }

    function updateColor() {
      var nextColor = window.getComputedStyle(sensorColor).backgroundColor;
      if (nextColor === color) return;
      color = nextColor;
      /* A broad, translucent body keeps the sensor hue without a white point. */
      var channels = color.match(/[\d.]+/g).slice(0, 3);
      lightColor = 'rgb(' + channels.map(function (channel) {
        return Math.round(Number(channel) + (255 - Number(channel)) * 0.25);
      }).join(',') + ')';
      glowCtx.clearRect(0, 0, 64, 64);
      var halo = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      halo.addColorStop(0, lightColor.replace('rgb(', 'rgba(').replace(')', ',0.65)'));
      halo.addColorStop(0.28, lightColor.replace('rgb(', 'rgba(').replace(')', ',0.45)'));
      halo.addColorStop(0.65, color.replace('rgb(', 'rgba(').replace(')', ',0.18)'));
      halo.addColorStop(1, color.replace('rgb(', 'rgba(').replace(')', ',0)'));
      glowCtx.fillStyle = halo;
      glowCtx.fillRect(0, 0, 64, 64);
    }

    function position(particle) {
      var angle = particle.phase + orbit * particle.speed * particle.direction;
      return {
        x: width * (particle.x + Math.cos(angle) * particle.orbitWidth),
        y: height * (particle.y + Math.sin(angle) * particle.orbitHeight + Math.sin(angle * 2 + particle.phase) * 0.008)
      };
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      var bounds = chaptersWrap.getBoundingClientRect();
      start = bounds.top + window.scrollY;
      end = start + bounds.height;
      var ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      var count = width <= 600 ? 5 : 7;
      particles = [];
      for (var i = 0; i < count; i++) {
        /* Separate, shallow ellipses let the particles weave horizontally. */
        particles.push({
          x: 0.48 + (i % 3) * 0.055,
          y: 0.16 + i * 0.68 / (count - 1),
          phase: i * 2.39996323 + 0.4,
          speed: 0.8 + (i % 3) * 0.14,
          direction: i % 2 ? -1 : 1,
          orbitWidth: 0.3 + (i % 2) * 0.035,
          orbitHeight: 0.045 + (i % 3) * 0.01,
          radius: 3.2 + (i % 3) * 0.7,
          alpha: 0.65 + (i % 3) * 0.1,
          trail: []
        });
      }
      lastScroll = window.scrollY;
      requestDraw();
    }

    function draw(now) {
      frame = 0;
      var scroll = window.scrollY;
      var delta = scroll - lastScroll;
      lastScroll = scroll;
      if (reducedMotion.matches || document.hidden || scroll >= end || scroll + height <= start) {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(function (particle) { particle.trail = []; });
        return;
      }

      /* No drift or inertia: the orbit advances with scroll distance alone. */
      orbit += delta / height * 1.4;
      updateColor();
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var hasTrails = false;
      particles.forEach(function (particle) {
        var point = position(particle);
        var trail = particle.trail;
        if (delta !== 0) {
          if (Math.abs(delta) > height * 0.65) trail.length = 0;
          trail.push({ x: point.x, y: point.y, time: now });
        }
        while (trail.length && (now - trail[0].time > trailLifetime || trail.length > 180)) trail.shift();

        var alpha = particle.alpha;
        if (trail.length > 1) {
          hasTrails = true;
          var oldest = trail[0];
          var newest = trail[trail.length - 1];
          var fade = Math.pow(1 - (now - newest.time) / trailLifetime, 1.3);
          var tail = ctx.createLinearGradient(oldest.x, oldest.y, point.x, point.y);
          tail.addColorStop(0, 'transparent');
          tail.addColorStop(1, color);
          ctx.beginPath();
          ctx.moveTo(oldest.x, oldest.y);
          trail.forEach(function (sample, index) {
            var next = trail[index + 1] || point;
            ctx.quadraticCurveTo(sample.x, sample.y, (sample.x + next.x) / 2, (sample.y + next.y) / 2);
          });
          ctx.lineTo(point.x, point.y);
          ctx.strokeStyle = tail;
          ctx.globalAlpha = alpha * fade * 0.1;
          ctx.lineWidth = particle.radius * 2.4;
          ctx.stroke();
          ctx.globalAlpha = alpha * fade * 0.52;
          ctx.lineWidth = particle.radius * 0.8;
          ctx.stroke();
        }

        var bodyWidth = particle.radius * 5;
        var bodyHeight = particle.radius * 3.8;
        ctx.globalAlpha = alpha;
        ctx.drawImage(glow, point.x - bodyWidth / 2, point.y - bodyHeight / 2, bodyWidth, bodyHeight);
      });
      ctx.globalAlpha = 1;
      /* After fading and the sensor transition finish, rendering sleeps. */
      if (hasTrails || now < colorUntil) requestDraw();
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      particles.forEach(function (particle) { particle.trail = []; });
      ctx.clearRect(0, 0, width, height);
      lastScroll = window.scrollY;
      if (!reducedMotion.matches && !document.hidden) resize();
    }

    document.addEventListener('scroll', requestDraw, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('load', resize);
    window.addEventListener('pageshow', reset);
    document.addEventListener('visibilitychange', reset);
    reducedMotion.addEventListener('change', reset);
    resize();

    return {
      syncColor: function () {
        colorUntil = performance.now() + 900;
        requestDraw();
      }
    };
  }

  if (chaptersWrap && chapters.length) {
    createSensorMotion();
    var photons = createPhotonField();
    function setActive(idx) {
      var color = chapters[idx].style.getPropertyValue('--chapter-color') || '#4E2E86';
      if (sensorColor) {
        sensorColor.style.backgroundColor = sensorColors[idx] || color;
        /* The first state uses the original photographed purple sensor. */
        sensorColor.style.opacity = idx === 0 ? '0' : '1';
      }
      if (photons) photons.syncColor();
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
      if (scrollCue) scrollCue.style.opacity = idx === 0 ? '1' : '0';
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        /* Mandatory scroll-snap + scroll-snap-stop:always on each chapter
           would otherwise force the scroll to halt at every chapter in
           between instead of jumping straight to the target one. */
        var html = document.documentElement;
        var prevSnap = html.style.scrollSnapType;
        function restoreSnap() {
          html.style.scrollSnapType = prevSnap;
          html.removeEventListener('scrollend', restoreSnap);
        }
        html.style.scrollSnapType = 'none';
        if ('onscrollend' in window) {
          html.addEventListener('scrollend', restoreSnap, { once: true });
        } else {
          setTimeout(restoreSnap, 900);
        }
        chapters[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    if ('IntersectionObserver' in window) {
      var chapterIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            setActive(Array.prototype.indexOf.call(chapters, entry.target));
          }
        });
      }, { threshold: [0.5] });
      chapters.forEach(function (ch) { chapterIO.observe(ch); });

      var visIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (dotsWrap) dotsWrap.classList.toggle('is-visible', entry.isIntersecting);
          if (skipIntro) skipIntro.classList.toggle('is-visible', entry.isIntersecting);
          if (sensorPos) sensorPos.classList.add('is-visible');
        });
      }, { threshold: 0.05 });
      visIO.observe(chaptersWrap);

      /* Fade the sensor in place as the business section arrives. */
      var clientesSection = snapReleaseSection;
      if (clientesSection && sensorPos) {
        var releaseIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              sensorPos.classList.add('is-leaving');
            } else if (entry.boundingClientRect.top >= 0) {
              /* Scrolled back above "Para o seu negócio": bring it back. */
              sensorPos.classList.remove('is-leaving');
            }
          });
        }, { threshold: 0.01 });
        releaseIO.observe(clientesSection);
      }
    } else {
      setActive(0);
      if (sensorPos) sensorPos.classList.add('is-visible');
      if (dotsWrap) dotsWrap.classList.add('is-visible');
    }

    setActive(0);

    if (skipIntro) {
      skipIntro.addEventListener('click', function () {
        var target = chapters[chapters.length - 1];
        var html = document.documentElement;
        var prevSnap = html.style.scrollSnapType;
        var startY = window.pageYOffset;
        var targetY = target.getBoundingClientRect().top + startY;
        var distance = targetY - startY;
        var duration = 550;
        var startTime = null;

        function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

        function step(timestamp) {
          if (startTime === null) startTime = timestamp;
          var progress = Math.min((timestamp - startTime) / duration, 1);
          window.scrollTo(0, startY + distance * easeInOutQuad(progress));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            html.style.scrollSnapType = prevSnap;
          }
        }

        html.style.scrollSnapType = 'none';
        requestAnimationFrame(step);
      });
    }
  }

  /* ---------------- Formulário de contato (Web3Forms) ---------------- */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    var contactStatus = document.getElementById('contactFormStatus');
    var contactSubmit = contactForm.querySelector('button[type="submit"]');
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      contactSubmit.disabled = true;
      contactStatus.textContent = 'Enviando...';
      contactStatus.className = 'contact-form__status';

      fetch(contactForm.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(contactForm)
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          contactSubmit.disabled = false;
          if (data.success) {
            contactStatus.textContent = 'Mensagem enviada! Em breve entraremos em contato.';
            contactStatus.className = 'contact-form__status is-success';
            contactForm.reset();
          } else {
            contactStatus.textContent = 'Não foi possível enviar. Tente novamente ou escreva para contato@biotechsafe.com.br.';
            contactStatus.className = 'contact-form__status is-error';
          }
        })
        .catch(function () {
          contactSubmit.disabled = false;
          contactStatus.textContent = 'Não foi possível enviar. Tente novamente ou escreva para contato@biotechsafe.com.br.';
          contactStatus.className = 'contact-form__status is-error';
        });
    });
  }

  /* Mesmas partículas da página inicial (halo suave + rastro, nas cores do
     sensor), mas guiadas pelo tempo em vez do scroll. Voam atrás do card do
     simulador entre start() e stop(); depois disso somem e o desenho dorme. */
  function createCalcPhotons() {
    var canvas = document.getElementById('calcPhotons');
    var ctx = canvas && canvas.getContext('2d');
    var noop = { start: function () {}, stop: function () {} };
    if (!ctx) return noop;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var TRAIL_MS = 2200;
    var FADE_IN_MS = 1200;
    var FADE_OUT_MS = 800;

    /* Um halo pré-renderizado por cor, igual ao da página inicial. */
    var sprites = sensorColors.map(function (hex) {
      var c = [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); });
      /* O fundo aqui é bem escuro: puxa as cores para o claro para o roxo e o azul não sumirem. */
      var light = c.map(function (v) { return Math.round(v + (255 - v) * 0.55); });
      c = c.map(function (v) { return Math.round(v + (255 - v) * 0.3); });
      var rgba = function (ch, a) { return 'rgba(' + ch.join(',') + ',' + a + ')'; };
      var sprite = document.createElement('canvas');
      sprite.width = sprite.height = 64;
      var sctx = sprite.getContext('2d');
      var halo = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      halo.addColorStop(0, rgba(light, 0.65));
      halo.addColorStop(0.28, rgba(light, 0.45));
      halo.addColorStop(0.65, rgba(c, 0.18));
      halo.addColorStop(1, rgba(c, 0));
      sctx.fillStyle = halo;
      sctx.fillRect(0, 0, 64, 64);
      return { image: sprite, solid: rgba(c, 1), clear: rgba(c, 0) };
    });

    var particles = [];
    var width = 0;
    var height = 0;
    var running = false;
    var visible = true;
    var frame = 0;
    var startedAt = 0;
    var stoppedAt = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      var ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function build() {
      var count = width <= 600 ? 6 : 9;
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          /* Elipses e oitos largos: cruzam por trás do card e reaparecem nas laterais. */
          ax: [0.46, 0.41, 0.36][i % 3] + (i % 2) * 0.02,
          ay: [0.46, 0.4, 0.3][i % 3],
          fy: i % 2 ? 2 : 1,
          phase: i * 2.39996323 + 0.4,
          speed: (0.3 + (i % 3) * 0.06) * (i % 2 ? -1 : 1),
          radius: 4.4 + (i % 3) * 0.9,
          alpha: 0.75 + (i % 3) * 0.1,
          sprite: sprites[i % sprites.length],
          trail: []
        });
      }
    }

    function requestDraw() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function draw(now) {
      frame = 0;
      var level = running
        ? Math.min(1, (now - startedAt) / FADE_IN_MS)
        : Math.max(0, 1 - (now - stoppedAt) / FADE_OUT_MS);
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var hasTrails = false;
      particles.forEach(function (particle) {
        var angle = particle.phase + (now - startedAt) / 1000 * particle.speed;
        var point = {
          x: width * (0.5 + Math.cos(angle) * particle.ax),
          y: height * (0.5 + Math.sin(angle * particle.fy) * particle.ay)
        };
        var trail = particle.trail;
        if (running) trail.push({ x: point.x, y: point.y, time: now });
        while (trail.length && (now - trail[0].time > TRAIL_MS || trail.length > 180)) trail.shift();

        if (trail.length > 1) {
          hasTrails = true;
          var oldest = trail[0];
          var newest = trail[trail.length - 1];
          var fade = Math.pow(1 - (now - newest.time) / TRAIL_MS, 1.3);
          var tail = ctx.createLinearGradient(oldest.x, oldest.y, newest.x, newest.y);
          tail.addColorStop(0, particle.sprite.clear);
          tail.addColorStop(1, particle.sprite.solid);
          ctx.beginPath();
          ctx.moveTo(oldest.x, oldest.y);
          trail.forEach(function (sample, index) {
            var next = trail[index + 1] || newest;
            ctx.quadraticCurveTo(sample.x, sample.y, (sample.x + next.x) / 2, (sample.y + next.y) / 2);
          });
          ctx.lineTo(newest.x, newest.y);
          ctx.strokeStyle = tail;
          ctx.globalAlpha = particle.alpha * fade * level * 0.16;
          ctx.lineWidth = particle.radius * 2.4;
          ctx.stroke();
          ctx.globalAlpha = particle.alpha * fade * level * 0.75;
          ctx.lineWidth = particle.radius * 0.8;
          ctx.stroke();
        }

        if (level > 0) {
          ctx.globalAlpha = particle.alpha * level;
          ctx.drawImage(particle.sprite.image, point.x - particle.radius * 2.5, point.y - particle.radius * 1.9, particle.radius * 5, particle.radius * 3.8);
        }
      });
      ctx.globalAlpha = 1;
      if (running || level > 0 || hasTrails) requestDraw();
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && running) requestDraw();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { if (running) requestDraw(); });
    window.addEventListener('resize', function () { if (running) resize(); }, { passive: true });

    return {
      start: function () {
        if (reducedMotion.matches) return;
        resize();
        build();
        running = true;
        startedAt = performance.now();
        requestDraw();
      },
      stop: function () {
        if (!running) return;
        running = false;
        stoppedAt = performance.now();
        requestDraw();
      }
    };
  }

  /* ---------------- Simulador de economia (calculadora) ---------------- */
  var calcReais = document.getElementById('calcReais');
  var calcKg = document.getElementById('calcKg');
  var calcPremium = document.getElementById('calcPremium');
  var calcMeses = document.getElementById('calcMeses');

  if (calcReais && calcKg && calcPremium && calcMeses) {
    var calculator = document.getElementById('calculator');
    var calcForm = document.getElementById('calcForm');
    var calcHint = document.getElementById('calcHint');
    var calcSteps = document.querySelectorAll('#calcSteps li');
    var calcProgress = document.getElementById('calcProgress');
    var calcResultsPanel = document.getElementById('calcResults');
    var calcPremiumValue = document.getElementById('calcPremiumValue');
    var calcMesesValue = document.getElementById('calcMesesValue');
    var calcResultMeses = document.getElementById('calcResultMeses');
    var calcResultTotal = document.getElementById('calcResultTotal');
    var calcResultMensal = document.getElementById('calcResultMensal');
    var calcResultKg = document.getElementById('calcResultKg');
    var calcResultHoras = document.getElementById('calcResultHoras');
    var calcResultDevolucoes = document.getElementById('calcResultDevolucoes');
    var calcHoras = document.getElementById('calcHoras');
    var calcValorHora = document.getElementById('calcValorHora');
    var calcDevolucoes = document.getElementById('calcDevolucoes');
    var calcResultNote = document.getElementById('calcResultNote');
    var calcResultPremiumPct = document.getElementById('calcResultPremiumPct');
    var calcReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var calcPhotons = createCalcPhotons();

    /* Premissas do produto: reduz 80% do desperdício mensal, e a carne
       premium custa em média 3x mais por quilo do que a convencional. */
    var REDUCAO_DESPERDICIO = 0.8;
    var MULTIPLICADOR_PREMIUM = 3;
    /* Premissas dos campos opcionais (ajustáveis): a leitura visual poupa
       metade do tempo de conferência e evita metade das devoluções. */
    var REDUCAO_TEMPO_CONFERENCIA = 0.5;
    var REDUCAO_DEVOLUCOES = 0.5;
    var SEMANAS_POR_MES = 52 / 12;

    /* Suspense: cada etapa fica na tela por CALC_STEP_MS antes do resultado. */
    var CALC_STEP_MS = 650;
    var CALC_COUNT_MS = 1800;

    var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    var kgFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

    /* 12 meses vira "1 ano", 13 vira "1 ano e 1 mês", 24 vira "2 anos"... */
    function calcPeriodo(m) {
      var anos = Math.floor(m / 12);
      var meses = m % 12;
      var a = anos ? anos + (anos === 1 ? ' ano' : ' anos') : '';
      var r = meses ? meses + (meses === 1 ? ' mês' : ' meses') : '';
      return a && r ? a + ' e ' + r : a || r;
    }

    /* Reduz o font-size de um número quando ele fica largo demais para o
       espaço disponível, garantindo que ele sempre apareça inteiro.
       referenceEl é o elemento cuja largura define o espaço disponível
       (o container, por padrão; o próprio elemento, no caso de inputs,
       já que sua largura não muda com o font-size). */
    function calcFitNumber(el, referenceEl) {
      referenceEl = referenceEl || el.parentElement;
      el.style.fontSize = '';
      var available = referenceEl.clientWidth;
      var needed = el.scrollWidth;
      if (available > 0 && needed > available) {
        var baseSize = parseFloat(window.getComputedStyle(el).fontSize);
        var newSize = (baseSize * available / needed) * 0.96;
        el.style.fontSize = newSize + 'px';
      }
    }

    function calcFitInputs() {
      [calcReais, calcKg, calcHoras, calcValorHora, calcDevolucoes].forEach(function (input) {
        calcFitNumber(input, input);
      });
    }

    function calcFitAllResults() {
      calcFitInputs();
      calcFitNumber(calcResultTotal);
      calcFitNumber(calcResultMensal);
      calcFitNumber(calcResultKg);
      calcFitNumber(calcResultHoras);
      calcFitNumber(calcResultDevolucoes);
      calcFitNumber(calcResultPremiumPct);
    }

    function calcFillRange(input) {
      var min = Number(input.min) || 0;
      var max = Number(input.max) || 100;
      var pct = ((Number(input.value) - min) / (max - min)) * 100;
      input.style.setProperty('--fill', pct + '%');
    }

    function calcLerEntradas() {
      return {
        reais: Math.max(0, Number(calcReais.value) || 0),
        kg: Math.max(0, Number(calcKg.value) || 0),
        horas: Math.max(0, Number(calcHoras.value) || 0),
        valorHora: Math.max(0, Number(calcValorHora.value) || 0),
        devolucoes: Math.max(0, Number(calcDevolucoes.value) || 0),
        diferenciacao: Number((document.querySelector('input[name="calcDiferenciacao"]:checked') || {}).value) || 0,
        pctPremium: Math.min(100, Math.max(0, Number(calcPremium.value) || 0)),
        meses: Math.max(1, Number(calcMeses.value) || 1)
      };
    }

    /* Só atualiza o que a pessoa vê enquanto preenche; o resultado
       aparece apenas depois de clicar em Calcular. */
    function calcAtualizarEntradas() {
      var e = calcLerEntradas();
      calcPremiumValue.textContent = e.pctPremium + '%';
      calcMesesValue.textContent = calcPeriodo(e.meses);
      calcFillRange(calcPremium);
      calcFillRange(calcMeses);
      calcFitInputs();
      calcHint.textContent = '';
    }

    function calcular(e) {
      /* Usa o valor total perdido (R$) e o total em kg, junto com o % de
         carne premium, para descobrir o preço implícito do kg convencional
         (já que o premium custa MULTIPLICADOR_PREMIUM vezes mais), e assim
         separar quanto do prejuízo mensal vem de carne premium. */
      var kgPremium = e.kg * (e.pctPremium / 100);
      var kgConvencional = e.kg - kgPremium;
      var denom = (MULTIPLICADOR_PREMIUM * kgPremium) + kgConvencional;
      var precoConvencional = denom > 0 ? e.reais / denom : 0;
      var valorPremiumMensal = kgPremium * precoConvencional * MULTIPLICADOR_PREMIUM;

      var economiaPerdasMensal = e.reais * REDUCAO_DESPERDICIO;
      var economiaKgMensal = e.kg * REDUCAO_DESPERDICIO;
      var economiaPremiumMensal = valorPremiumMensal * REDUCAO_DESPERDICIO;

      var horasLiberadasMensal = e.horas * SEMANAS_POR_MES * REDUCAO_TEMPO_CONFERENCIA;
      var economiaTempoMensal = horasLiberadasMensal * e.valorHora;
      var economiaDevolucoesMensal = e.devolucoes * REDUCAO_DEVOLUCOES;

      var economiaMensal = economiaPerdasMensal + economiaTempoMensal + economiaDevolucoesMensal;

      return {
        meses: e.meses,
        total: economiaMensal * e.meses,
        mensal: economiaMensal,
        kg: economiaKgMensal * e.meses,
        horas: horasLiberadasMensal * e.meses,
        devolucoes: economiaDevolucoesMensal * e.meses,
        diferenciacao: e.diferenciacao,
        premiumPct: economiaMensal > 0 ? (economiaPremiumMensal / economiaMensal) * 100 : 0
      };
    }

    /* Conta de 0 até o valor final, desacelerando no fim. */
    function calcContar(el, ate, formato) {
      var inicio = performance.now();
      function passo(agora) {
        var t = Math.min(1, (agora - inicio) / CALC_COUNT_MS);
        el.textContent = formato(ate * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(passo);
      }
      requestAnimationFrame(passo);
    }

    function calcMostrarResultado(r) {
      var fmtTotal = function (v) { return brl.format(v); };
      var fmtKg = function (v) { return kgFmt.format(v) + ' kg'; };
      var fmtHoras = function (v) { return kgFmt.format(v) + ' h'; };
      var fmtPct = function (v) { return Math.round(v) + '%'; };

      calculator.dataset.state = 'result';
      calcResultMeses.textContent = calcPeriodo(r.meses);

      /* Mede com o número final, para o texto caber durante toda a contagem. */
      calcResultTotal.textContent = fmtTotal(r.total);
      calcResultMensal.textContent = fmtTotal(r.mensal);
      calcResultKg.textContent = fmtKg(r.kg);
      calcResultHoras.textContent = fmtHoras(r.horas);
      calcResultDevolucoes.textContent = fmtTotal(r.devolucoes);
      /* A diferenciação é uma percepção, não vira número: só gera uma frase. */
      calcResultNote.hidden = !r.diferenciacao;
      calcResultNote.textContent = !r.diferenciacao ? '' : r.diferenciacao <= 2
        ? 'Você se vê pouco diferenciado em relação aos similares da região. O sensor pode ser um atributo visível que destaca o seu negócio.'
        : r.diferenciacao === 3
          ? 'Você se vê na média entre os similares da região. A leitura por cor pode ajudar a se destacar com transparência e confiança.'
          : 'Você já se vê como um negócio diferenciado na região. O sensor reforça a transparência e a confiança que sustentam essa posição.';
      calcResultHoras.closest('.calculator__result-card').hidden = !(r.horas > 0);
      calcResultDevolucoes.closest('.calculator__result-card').hidden = !(r.devolucoes > 0);
      calcResultPremiumPct.textContent = fmtPct(r.premiumPct);
      calcFitAllResults();

      if (!calcReduceMotion) {
        calcContar(calcResultTotal, r.total, fmtTotal);
        calcContar(calcResultMensal, r.mensal, fmtTotal);
        calcContar(calcResultKg, r.kg, fmtKg);
        calcContar(calcResultHoras, r.horas, fmtHoras);
        calcContar(calcResultDevolucoes, r.devolucoes, fmtTotal);
        calcContar(calcResultPremiumPct, r.premiumPct, fmtPct);
      }
      setTimeout(function () { calcResultsPanel.focus({ preventScroll: true }); }, calcReduceMotion ? 0 : CALC_COUNT_MS);
    }

    /* Passo 1 (obrigatório) para o passo 2 (opcional). */
    function calcProximo() {
      var e = calcLerEntradas();
      if (e.reais <= 0 || e.kg <= 0) {
        calcHint.textContent = 'Informe as perdas em reais e em quilos para continuar.';
        (e.reais <= 0 ? calcReais : calcKg).focus();
        return;
      }
      calculator.dataset.state = 'extras';
      calcFitInputs();
      calcHoras.focus({ preventScroll: true });
    }

    function calcVoltar() {
      calculator.dataset.state = 'input';
      calcFitInputs();
      calcReais.focus({ preventScroll: true });
    }

    function calcIniciar() {
      var e = calcLerEntradas();
      var r = calcular(e);
      calcPhotons.start();
      if (calcReduceMotion) { calcMostrarResultado(r); return; }

      /* Etapas com os números da própria pessoa, para parecer um cálculo feito na hora. */
      var textos = [
        'Lendo suas perdas: ' + brl.format(e.reais) + ' e ' + kgFmt.format(e.kg) + ' kg por mês',
        'Separando a parcela de carne premium (' + e.pctPremium + '%)',
        (e.horas > 0 || e.devolucoes > 0)
          ? 'Somando ' + kgFmt.format(e.horas) + ' h semanais de conferência e ' + brl.format(e.devolucoes) + ' em devoluções'
          : 'Aplicando a leitura individual de cada peça',
        'Projetando ' + calcPeriodo(e.meses) + ' de economia'
      ];
      var total = CALC_STEP_MS * calcSteps.length;
      calcSteps.forEach(function (li, i) {
        li.textContent = textos[i];
        li.className = '';
        setTimeout(function () { li.className = 'is-active'; }, i * CALC_STEP_MS);
        setTimeout(function () { li.className = 'is-done'; }, (i + 1) * CALC_STEP_MS);
      });

      calculator.style.minHeight = calculator.offsetHeight + 'px';
      calcProgress.style.transition = 'none';
      calcProgress.style.width = '0';
      calculator.dataset.state = 'loading';
      void calcProgress.offsetWidth;
      calcProgress.style.transition = '';
      calcProgress.style.setProperty('--calc-dur', total + 'ms');
      calcProgress.style.width = '100%';

      setTimeout(function () { calcMostrarResultado(r); }, total + 250);
    }

    /* Enter ou o botão avançam no passo 1 e calculam no passo 2. */
    calcForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (calculator.dataset.state === 'input') calcProximo();
      else calcIniciar();
    });
    document.getElementById('calcBack').addEventListener('click', calcVoltar);

    document.getElementById('calcReset').addEventListener('click', function () {
      calcPhotons.stop();
      calculator.style.minHeight = '';
      calculator.dataset.state = 'input';
      calcFitInputs();
      calcReais.focus({ preventScroll: true });
    });

    [calcReais, calcKg, calcHoras, calcValorHora, calcDevolucoes, calcPremium, calcMeses].forEach(function (el) {
      el.addEventListener('input', calcAtualizarEntradas);
    });

    var calcResizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(calcResizeTimeout);
      calcResizeTimeout = setTimeout(calcFitAllResults, 120);
    });

    /* A fonte Sora carrega de forma assíncrona (font-display: swap); a
       primeira medição pode acontecer com a fonte de fallback, então
       remedimos assim que a fonte real estiver pronta. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(calcFitAllResults);
    }

    calcAtualizarEntradas();
  }
})();
