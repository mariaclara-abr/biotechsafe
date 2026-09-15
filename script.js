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

    function measure() {
      var scroll = window.scrollY;
      stops = Array.prototype.map.call(chapters, function (chapter) {
        return chapter.getBoundingClientRect().top + scroll;
      });
      var mobile = window.matchMedia('(max-width: 600px)').matches;
      var tablet = window.matchMedia('(max-width: 940px)').matches;
      travelY = mobile ? 6 : tablet ? 8 : 12;
      tilt = mobile ? 0.6 : 1;
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

  /* ---------------- Simulador de economia (calculadora) ---------------- */
  var calcReais = document.getElementById('calcReais');
  var calcKg = document.getElementById('calcKg');
  var calcPremium = document.getElementById('calcPremium');
  var calcMeses = document.getElementById('calcMeses');

  if (calcReais && calcKg && calcPremium && calcMeses) {
    var calcPremiumValue = document.getElementById('calcPremiumValue');
    var calcMesesValue = document.getElementById('calcMesesValue');
    var calcResultMeses = document.getElementById('calcResultMeses');
    var calcResultTotal = document.getElementById('calcResultTotal');
    var calcResultMensal = document.getElementById('calcResultMensal');
    var calcResultKg = document.getElementById('calcResultKg');
    var calcResultPremiumPct = document.getElementById('calcResultPremiumPct');

    /* Premissas do produto: reduz 80% do desperdício mensal, e a carne
       premium custa em média 3x mais por quilo do que a convencional. */
    var REDUCAO_DESPERDICIO = 0.8;
    var MULTIPLICADOR_PREMIUM = 3;

    var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    var kgFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

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

    function calcFitAllResults() {
      calcFitNumber(calcReais, calcReais);
      calcFitNumber(calcKg, calcKg);
      calcFitNumber(calcResultTotal);
      calcFitNumber(calcResultMensal);
      calcFitNumber(calcResultKg);
      calcFitNumber(calcResultPremiumPct);
    }

    function calcFillRange(input) {
      var min = Number(input.min) || 0;
      var max = Number(input.max) || 100;
      var pct = ((Number(input.value) - min) / (max - min)) * 100;
      input.style.setProperty('--fill', pct + '%');
    }

    function calcular() {
      var reais = Math.max(0, Number(calcReais.value) || 0);
      var kg = Math.max(0, Number(calcKg.value) || 0);
      var pctPremium = Math.min(100, Math.max(0, Number(calcPremium.value) || 0));
      var meses = Math.max(1, Number(calcMeses.value) || 1);

      calcPremiumValue.textContent = pctPremium + '%';
      calcMesesValue.textContent = meses + (meses === 1 ? ' mês' : ' meses');
      calcResultMeses.textContent = meses;

      /* Usa o valor total perdido (R$) e o total em kg, junto com o % de
         carne premium, para descobrir o preço implícito do kg convencional
         (já que o premium custa MULTIPLICADOR_PREMIUM vezes mais), e assim
         separar quanto do prejuízo mensal vem de carne premium. */
      var kgPremium = kg * (pctPremium / 100);
      var kgConvencional = kg - kgPremium;
      var denom = (MULTIPLICADOR_PREMIUM * kgPremium) + kgConvencional;
      var precoConvencional = denom > 0 ? reais / denom : 0;
      var valorPremiumMensal = kgPremium * precoConvencional * MULTIPLICADOR_PREMIUM;

      var economiaMensal = reais * REDUCAO_DESPERDICIO;
      var economiaKgMensal = kg * REDUCAO_DESPERDICIO;
      var economiaPremiumMensal = valorPremiumMensal * REDUCAO_DESPERDICIO;

      var economiaTotal = economiaMensal * meses;
      var economiaKgTotal = economiaKgMensal * meses;
      var pctEconomiaPremium = economiaMensal > 0 ? (economiaPremiumMensal / economiaMensal) * 100 : 0;

      calcResultTotal.textContent = brl.format(economiaTotal);
      calcResultMensal.textContent = brl.format(economiaMensal);
      calcResultKg.textContent = kgFmt.format(economiaKgTotal) + ' kg';
      calcResultPremiumPct.textContent = Math.round(pctEconomiaPremium) + '%';

      calcFillRange(calcPremium);
      calcFillRange(calcMeses);
      calcFitAllResults();
    }

    [calcReais, calcKg, calcPremium, calcMeses].forEach(function (el) {
      el.addEventListener('input', calcular);
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

    calcular();
  }

  /* ---------------- Negócio: prioriza o tipo escolhido na home ---------------- */
  var detalhesGrid = document.getElementById('detalhesGrid');
  if (detalhesGrid) {
    var tipo = new URLSearchParams(window.location.search).get('tipo');
    if (tipo === 'acougue' || tipo === 'restaurante') {
      var priorityCard = detalhesGrid.querySelector('[data-negocio="' + tipo + '"]');
      if (priorityCard) {
        detalhesGrid.insertBefore(priorityCard, detalhesGrid.firstChild);
        priorityCard.classList.add('is-priority');
      }
    }
  }
})();
