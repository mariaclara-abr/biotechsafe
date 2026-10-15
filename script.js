(function () {
  'use strict';

  /* ---------------- Nav: solid on scroll ---------------- */
  var nav = document.getElementById('nav');
  var progressBar = document.getElementById('progressBar');

  /* Mandatory scroll-snap only makes sense while stepping through the
     full-screen chapters. Once the user has landed on the snap point right
     after the last chapter (#clientes, where the zoom into the sensor ends
     on the cards screen), it becomes a trap: nothing after it is a snap
     target, so the browser keeps pulling the page back to it instead of
     letting the user scroll into the rest of the page. */
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
      /* The 2px margin absorbs fractional scroll offsets on high-DPI screens. */
      var releaseY = snapReleaseSection.getBoundingClientRect().top + y;
      document.documentElement.classList.toggle('snap-released', y >= releaseY - 2);
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

  /* Magnetic-field ribbons: sheets of fine lines that twist, so the folds glow
     where the lines bunch up. They flow only as the page scrolls and take the
     sensor's colour, so nothing moves while the page is idle. */
  function createWaveField() {
    var canvas = document.getElementById('chapterWaves');
    if (!canvas || !sensorColor) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var width = 0;
    var height = 0;
    var start = 0;
    var end = 0;
    var lastScroll = window.scrollY;
    var frame = 0;
    var flow = 0;
    var colorUntil = 0;
    var color = '';
    var tones = [];
    var rim = 7;
    var glow = '';
    var step = 8;
    var count = 0;
    var shown = 3;
    var fit = 1;
    var gaps = [];
    var shades = [];
    var mid = [];
    var half = [];
    /* Each wave is [amplitude, cycles across the width, phase, speed]; speed is
       radians per screen scrolled. A ribbon is its height, two swells that bend
       it, and a twist that sets its thickness (it folds where that crosses 0). */
    var ribbons = [
      { y: 0.52, a: [0.15, 1.25, 0.6, 2.0], b: [0.05, 2.6, 1.7, -1.5], t: [0.17, 1.1, 1.9, 1.6] },
      { y: 0.56, a: [0.12, 1.7, 2.4, -2.4], b: [0.06, 3.1, 0.2, 1.9], t: [0.12, 1.6, 3.7, -1.9] },
      { y: 0.5, a: [0.1, 2.2, 4.0, 2.8], b: [0.04, 0.9, 3.3, -1.1], t: [0.09, 2.1, 6.0, 2.3] }
    ];

    function requestDraw() {
      if (!frame && !reducedMotion.matches && !document.hidden) {
        frame = requestAnimationFrame(draw);
      }
    }

    function updateColor() {
      var next = window.getComputedStyle(sensorColor).backgroundColor;
      if (next === color) return;
      color = next;
      /* Dark sensor colours are brought up to full brightness so they still glow
         on the night background; the rims get lighter and stronger. */
      var channels = color.match(/[\d.]+/g).slice(0, 3).map(Number);
      var boost = 235 / (Math.max.apply(null, channels) || 1);
      tones = [];
      for (var i = 0; i <= rim; i++) {
        var lift = 0.35 * i / rim;
        tones.push('rgba(' + channels.map(function (channel) {
          var base = Math.min(255, channel * boost);
          return Math.round(base + (255 - base) * lift);
        }).join(',') + ',' + (0.14 + 0.42 * i / rim).toFixed(2) + ')');
      }
      /* Rim lines also get a wide, faint pass; they overlap, so it reads as a glow. */
      glow = tones[rim].replace(/,[\d.]+\)$/, ',0.07)');
    }

    function sway(wave, u) {
      return wave[0] * fit * Math.sin(Math.PI * 2 * wave[1] * fit * u + wave[2] + flow * wave[3]);
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
      step = Math.max(6, width / 180);
      count = Math.ceil(width / step) + 3;
      shown = width <= 600 ? 2 : 3;
      /* On tall, narrow screens, shrink amplitude and cycles so the slope stays gentle. */
      fit = Math.sqrt(Math.min(1, width / height / 1.6));
      var lines = width <= 600 ? 36 : 64;
      gaps = [];
      shades = [];
      for (var i = 0; i < lines; i++) {
        /* Sine spacing packs the lines at the ribbon edges, which brightens the rims. */
        var gap = Math.sin((i / (lines - 1) - 0.5) * Math.PI);
        gaps.push(gap);
        shades.push(Math.round(Math.pow(Math.abs(gap), 3) * rim));
      }
      lastScroll = window.scrollY;
      requestDraw();
    }

    function draw(now) {
      frame = 0;
      var scroll = window.scrollY;
      var delta = scroll - lastScroll;
      lastScroll = scroll;
      ctx.clearRect(0, 0, width, height);
      if (reducedMotion.matches || document.hidden || scroll >= end || scroll + height <= start) return;

      /* No drift or inertia: the flow advances with scroll distance alone. */
      flow += delta / height;
      updateColor();
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      for (var r = 0; r < shown; r++) {
        var ribbon = ribbons[r];
        for (var i = 0; i < count; i++) {
          var u = (i - 1) * step / width;
          mid[i] = (ribbon.y + sway(ribbon.a, u) + sway(ribbon.b, u)) * height;
          half[i] = sway(ribbon.t, u) * height;
        }
        /* One stroke per line so overlapping lines build up toward the rim colour. */
        for (var j = 0; j < gaps.length; j++) {
          ctx.beginPath();
          ctx.moveTo(-step, mid[0] + half[0] * gaps[j]);
          for (var k = 1; k < count; k++) ctx.lineTo((k - 1) * step, mid[k] + half[k] * gaps[j]);
          if (shades[j] === rim) {
            ctx.lineWidth = 5;
            ctx.strokeStyle = glow;
            ctx.stroke();
            ctx.lineWidth = 1;
          }
          ctx.strokeStyle = tones[shades[j]];
          ctx.stroke();
        }
      }
      /* Keep rendering only while the sensor colour is still blending. */
      if (now < colorUntil) requestDraw();
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
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

  /* Zoom into the sensor when the last chapter ends. The camera dives toward
     the row of swatches on the card, five of them (same colors, same order)
     become the home cards, and the rest of the label fades into the dark. It is
     a pure function of scroll progress over the runway that ends at #clientes,
     eased with the same damping as the sensor so wheel and touch steps stay
     smooth. Under reduced motion the static layout is kept. */
  function createSensorZoom() {
    var home = document.getElementById('homeLower');
    var stage = document.getElementById('zoomStage');
    var runway = document.getElementById('zoomRunway');
    var anchor = snapReleaseSection;
    var zoom = document.getElementById('sensorZoom');
    var sensor = sensorPos && sensorPos.querySelector('.sensor-float');
    if (!home || !stage || !runway || !anchor || !zoom || !sensor) return null;

    var cards = Array.prototype.slice.call(stage.querySelectorAll('.home-pathway'));
    var business = stage.querySelector('.home-business');
    var curtain = document.getElementById('zoomCurtain');
    var root = document.documentElement;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var edge = document.getElementById('zoomEdge');

    /* Swatch centers in sensor-card.webp (675x900 px) and their flat colors, one
       per card in order: purple, blue, teal, green, yellow. A card starts in its
       swatch's color to take over from the photo unnoticed, then settles into its
       site color. The image also has plum, navy and lime swatches, which just
       fade out. Re-measure all of this if the image changes. */
    var SWATCHES = [
      [179, 639, '#483486'],
      [295.5, 639.5, '#0385C0'],
      [354.5, 639.5, '#31AEB6'],
      [414, 639, '#59BA93'],
      [553.5, 639, '#D7C404']
    ];
    var IMAGE_WIDTH = 675;
    var SWATCH_SIZE = 44;
    var DIVE = 0.43;      // share of the progress the camera spends zooming in
    var STAGGER = 0.012;  // left to right delay between cards
    var LEAD = 1.8;       // how far the zoom runs ahead of the scroll at the start

    var SPRING = 10;      // stiffness of the follow spring, in radians per second
    var DIVE_SPEED = 1;   // fastest the zoom may advance during the dive, in progress per second
    var MAX_SPEED = 0.85; // and while the cards form, a calmer pace
    var FORMED = 0.92;    // every stage already sits at its end value from here on
    var FULL_RATE = 4.5;  // zoom speed (ln of the scale per second) where the speed effect peaks

    var active = false;
    var formed = false;
    var rest, squares, focus, finals, maxScale, viewW, viewH, startY, endY;
    var target = 0;
    var shown = 0;
    var speed = 0;
    var frame = 0;
    var lastTime = 0;
    var energy = 0;       // strength of the edge effect, 0 to 1
    var lastLn = NaN;
    var edgeOn = false;
    var viewHeight = 0;
    var blurMax = 0;
    var blurSlow = 0;     // slow frames in a row while the effect was strong
    var blurOff = false;  // the blur proved too slow here, so it stays off

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
    function smoother(x) { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); }

    /* Back to the plain stylesheet state: used once the cards are formed and
       when reduced motion switches the effect off. */
    function clear() {
      zoom.style.visibility = 'hidden';
      zoom.style.willChange = '';
      if (curtain) curtain.style.opacity = '';
      energy = 0;
      lastLn = NaN;
      drawEdges(0, 0, 0);
      cards.forEach(function (card) {
        card.style.translate = '';
        card.style.scale = '';
        card.style.opacity = '';
        card.style.removeProperty('--fill');
        card.style.removeProperty('--tint');
        card.style.removeProperty('--label');
      });
      if (business) {
        business.style.opacity = '';
        business.style.transform = '';
        business.style.removeProperty('--business-zoom');
      }
    }

    /* Edge effect: the sides blur and darken while the middle around the swatch
       row (cx, cy) stays clear. The clear middle closes in as the zoom speeds up
       (level goes to 1) and opens again as it brakes. */
    function drawEdges(level, cx, cy) {
      if (!edge) return;
      if (level === 0) {
        if (edgeOn) {
          edge.style.visibility = 'hidden';
          edgeOn = false;
        }
        return;
      }
      if (!edgeOn) {
        edge.style.visibility = 'visible';
        edgeOn = true;
      }
      var far = Math.hypot(Math.max(cx, viewW - cx), Math.max(cy, viewHeight - cy)) * 1.05;
      edge.style.setProperty('--zoom-x', cx.toFixed(1) + 'px');
      edge.style.setProperty('--zoom-y', cy.toFixed(1) + 'px');
      edge.style.setProperty('--zoom-clear', (far * (0.82 - 0.55 * level) * 0.8).toFixed(1) + 'px');
      edge.style.setProperty('--zoom-shade', (0.45 * level).toFixed(3));
      edge.style.setProperty('--zoom-blur', (blurMax * level).toFixed(2) + 'px');
    }

    /* v is the zoom's own progress (see readTarget), dt the seconds since the
       last frame (0 when only re-measuring). */
    function paint(v, dt) {
      dt = dt || 0;
      root.classList.toggle('is-diving', v > 0.04);
      if (v >= FORMED) {
        if (!formed) {
          clear();
          home.classList.add('is-formed');
          formed = true;
        }
        return;
      }
      if (formed) {
        home.classList.remove('is-formed');
        formed = false;
      }

      /* Camera: exponential zoom, so it feels constant, while the swatch row
         glides to the middle of the screen. It only eases out, so it bursts away
         at once and brakes into the cards, which start leaving before it stops.
         Local points land at rest + translate + scale * point (the wrapper
         scales from its corner). */
      var dive = 1 - clamp01(v / DIVE);
      var u = 1 - dive * dive;
      var s = Math.pow(maxScale, u);
      var fx = rest.x + focus.x + (viewW / 2 - rest.x - focus.x) * u;
      var fy = rest.y + focus.y + (viewH / 2 - rest.y - focus.y) * u;
      var tx = fx - rest.x - s * focus.x;
      var ty = fy - rest.y - s * focus.y;
      /* Exposure of the label: it dims as the camera dives, so only the swatches
         stay lit, and is gone once the cards have left. It fades over the curtain,
         which is already black by then, so nothing shows through. */
      var paper = (1 - 0.7 * smooth((v - 0.01) / 0.2)) * (1 - smooth((v - 0.28) / 0.16));

      /* The speed effect follows how fast the zoom really is: it attacks almost
         at once and lingers a little while the camera brakes. */
      var ln = Math.log(s);
      var rate = dt > 0 && lastLn === lastLn ? Math.abs(ln - lastLn) / dt : 0;
      lastLn = ln;
      var level = clamp01(rate / FULL_RATE);
      energy += (level - energy) * (1 - Math.exp(-dt * (level > energy ? 45 : 10)));
      if (energy < 0.01) energy = 0;
      drawEdges(energy, fx, fy);

      if (curtain) curtain.style.opacity = smooth(v / 0.13).toFixed(3);
      zoom.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';
      zoom.style.opacity = paper.toFixed(3);
      zoom.style.visibility = paper > 0.002 ? '' : 'hidden';
      zoom.style.willChange = 'transform, opacity';
      /* Heavy blurs and filters are not worth scaling several times over. */
      sensor.style.setProperty('--sensor-shadow-opacity', (0.44 * (1 - smooth(v / 0.1))).toFixed(3));
      sensor.style.filter = s > 1.2 ? 'none' : '';

      /* Each card starts exactly on its swatch, so it can take over from the
         photo's soft squares, then eases to its grid slot. */
      var appear = smooth((v - 0.03) / 0.09).toFixed(3);
      cards.forEach(function (card, i) {
        var q = squares[i];
        var slot = finals[i];
        var delay = i * STAGGER;
        var m = smoother((v - 0.2 - delay) / 0.56);
        var cx = rest.x + tx + s * q.x;
        var cy = rest.y + ty + s * q.y;
        var size = s * q.size;
        card.style.translate = (cx + (slot.x - cx) * m - slot.x).toFixed(2) + 'px ' + (cy + (slot.y - cy) * m - slot.y).toFixed(2) + 'px';
        card.style.scale = ((size + (slot.size - size) * m) / slot.size).toFixed(4);
        card.style.opacity = appear;
        card.style.setProperty('--tint', smooth((v - 0.2 - delay) / 0.3).toFixed(3));
        card.style.setProperty('--fill', (1 - smooth((v - 0.5 - delay) / 0.22)).toFixed(3));
        card.style.setProperty('--label', smooth((v - 0.7 - delay / 2) / 0.14).toFixed(3));
      });

      if (business) {
        var b = smooth((v - 0.44) / 0.46);
        business.style.opacity = b.toFixed(3);
        business.style.transform = 'translate3d(0,' + ((1 - b) * 36).toFixed(2) + 'px,0)';
        business.style.setProperty('--business-zoom', (1 + 0.14 * (1 - b)).toFixed(4));
      }
    }

    /* The target is the zoom's own progress, not the scroll's: the first stretch
       of scroll does most of the zooming, so it starts the instant the page moves. */
    function readTarget() {
      var distance = endY - startY;
      var scrolled = distance > 1 ? clamp01((window.scrollY - startY) / distance) : 1;
      target = 1 - Math.pow(1 - scrolled, LEAD);
    }

    function requestFrame() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    function draw(now) {
      frame = 0;
      if (!active || document.hidden) {
        lastTime = 0;
        return;
      }
      /* Critically damped spring (exact step): unlike a plain exponential ease
         it starts from rest, so the browser's abrupt fling or snap start turns
         into a soft ramp instead of a lurch. */
      var elapsed = lastTime ? Math.min(now - lastTime, 100) / 1000 : 1 / 60;
      var offset = shown - target;
      var carry = speed + SPRING * offset;
      var decay = Math.exp(-SPRING * elapsed);
      speed = (speed - SPRING * carry * elapsed) * decay;
      offset = (offset + carry * elapsed) * decay;
      /* Cap the cruising speed: a hard fling then plays at the designed pace,
         while slow drags still track the scroll one to one. The cap eases from
         the dive's pace to the calmer one as the camera brakes. */
      var cap = MAX_SPEED + (DIVE_SPEED - MAX_SPEED) * (1 - smooth((shown - 0.22) / 0.18));
      var step = target + offset - shown;
      if (Math.abs(step) > cap * elapsed) {
        step = step < 0 ? -cap * elapsed : cap * elapsed;
        offset = shown + step - target;
        speed = step / elapsed;
      }
      if (Math.abs(offset) < 0.0004 && Math.abs(speed) < 0.004) {
        offset = 0;
        speed = 0;
      }
      shown = target + offset;
      /* The blur is the costly part of the edge effect: if frames turn slow
         while it is strong, give it up for good and keep the shade. */
      if (blurMax && energy > 0.2) {
        blurSlow = elapsed > 0.026 ? blurSlow + 1 : 0;
        if (blurSlow >= 4) {
          blurMax = 0;
          blurOff = true;
          edge.classList.add('is-flat');
        }
      }
      paint(shown, elapsed);
      var moving = offset !== 0 || speed !== 0 || energy > 0;
      lastTime = moving ? now : 0;
      if (moving) requestFrame();
    }

    function onScrollZoom() {
      if (!active) return;
      readTarget();
      if (target !== shown) requestFrame();
    }

    /* jump: restart from the current scroll position instead of letting the
       spring carry on. Resize events also fire all the time on phones (the
       address bar collapsing), so those must not interrupt a running zoom. */
    function measure(jump) {
      if (!active) return;
      var box = sensorPos.getBoundingClientRect();
      var k = sensor.offsetWidth / IMAGE_WIDTH;
      viewW = root.clientWidth;
      viewH = Math.min(window.innerHeight, stage.offsetHeight);
      rest = { x: box.left, y: box.top };
      squares = SWATCHES.map(function (c, i) {
        if (cards[i]) cards[i].style.setProperty('--swatch', c[2]);
        return { x: c[0] * k, y: c[1] * k, size: SWATCH_SIZE * k };
      });
      focus = {
        x: squares.reduce(function (sum, q) { return sum + q.x; }, 0) / squares.length,
        y: squares[0].y
      };
      /* Zoom until the five swatches span most of the screen width. */
      var span = (SWATCHES[SWATCHES.length - 1][0] - SWATCHES[0][0] + SWATCH_SIZE) * k;
      maxScale = Math.min(6, Math.max(2, (viewW > 700 ? 0.7 : 0.92) * viewW / span));
      /* offset* ignores the transforms the card is wearing, so no reset needed. */
      finals = cards.map(function (card) {
        return {
          x: card.offsetLeft + card.offsetWidth / 2,
          y: card.offsetTop + card.offsetHeight / 2,
          size: card.offsetWidth
        };
      });
      /* The zoom ends with the stage's top edge at the viewport top. */
      anchor.style.top = (runway.offsetHeight - stage.offsetHeight) + 'px';
      var y = window.scrollY;
      startY = home.getBoundingClientRect().top + y;
      endY = anchor.getBoundingClientRect().top + y;
      /* Phones skip the blur, which is the costly part of the edge effect. */
      viewHeight = window.innerHeight;
      blurMax = edge && !blurOff && viewW > 700 && window.CSS && CSS.supports &&
        (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')) ? 7 : 0;
      if (edge) edge.classList.toggle('is-flat', !blurMax);
      readTarget();
      if (jump === true) {
        shown = target;
        speed = 0;
      }
      paint(shown, 0);
      if (shown !== target || speed !== 0) requestFrame();
    }

    function restart() { measure(true); }
    function remeasure() { measure(false); }

    function sync() {
      active = !reducedMotion.matches;
      root.classList.toggle('zoom-ready', active);
      if (active) {
        sensorPos.classList.remove('is-leaving');
        restart();
        return;
      }
      clear();
      zoom.style.transform = '';
      zoom.style.opacity = '';
      zoom.style.visibility = '';
      sensor.style.removeProperty('--sensor-shadow-opacity');
      sensor.style.filter = '';
      anchor.style.top = '';
      home.classList.remove('is-formed');
      root.classList.remove('is-diving');
      formed = false;
    }

    /* Keyboard users tabbing into the cards play the zoom instead of landing
       on cards that are still tiny or invisible. */
    stage.addEventListener('focusin', function () {
      if (active && window.scrollY < endY - 2) window.scrollTo(0, endY);
    });

    document.addEventListener('scroll', onScrollZoom, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    window.addEventListener('pageshow', restart);
    window.addEventListener('load', restart);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) onScrollZoom(); });
    reducedMotion.addEventListener('change', sync);
    if ('ResizeObserver' in window) {
      var zoomObserver = new ResizeObserver(remeasure);
      zoomObserver.observe(stage);
      chapters.forEach(function (chapter) { zoomObserver.observe(chapter); });
    }
    sync();

    return { active: function () { return active; } };
  }

  if (chaptersWrap && chapters.length) {
    createSensorMotion();
    var zoomEngine = createSensorZoom();
    var waves = createWaveField();
    function setActive(idx) {
      var color = chapters[idx].style.getPropertyValue('--chapter-color') || '#4E2E86';
      if (sensorColor) {
        sensorColor.style.backgroundColor = sensorColors[idx] || color;
        /* The first state uses the original photographed purple sensor. */
        sensorColor.style.opacity = idx === 0 ? '0' : '1';
      }
      if (waves) waves.syncColor();
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

      /* Reduced motion only: fade the sensor in place as the cards arrive.
         Otherwise the zoom into the sensor owns its exit. */
      var cardsStage = document.getElementById('zoomStage');
      if (cardsStage && sensorPos) {
        var releaseIO = new IntersectionObserver(function (entries) {
          if (zoomEngine && zoomEngine.active()) return;
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              sensorPos.classList.add('is-leaving');
            } else if (entry.boundingClientRect.top >= 0) {
              /* Scrolled back above the cards: bring it back. */
              sensorPos.classList.remove('is-leaving');
            }
          });
        }, { threshold: 0.01 });
        releaseIO.observe(cardsStage);
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
    /* Premissas dos campos opcionais: 65% das devoluções e reclamações do
       período são evitadas (dado da equipe); a leitura visual poupa metade
       do tempo de conferência (estimativa, ajustável). */
    var REDUCAO_DEVOLUCOES = 0.65;
    var REDUCAO_TEMPO_CONFERENCIA = 0.5;
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

    /* Escreve a frase e deixa a palavra "destacar" colorida (só textos fixos daqui). */
    function calcMostrarNota(texto) {
      var partes = texto.split('destacar');
      calcResultNote.textContent = partes[0];
      if (partes.length > 1) {
        var destaque = document.createElement('span');
        destaque.className = 'calculator__highlight';
        destaque.textContent = 'destacar';
        calcResultNote.appendChild(destaque);
        calcResultNote.appendChild(document.createTextNode(partes.slice(1).join('destacar')));
      }
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
      calcMostrarNota(!r.diferenciacao ? '' : r.diferenciacao <= 2
        ? 'Você se vê pouco diferenciado em relação aos similares da região. O sensor pode ser um atributo visível para destacar o seu negócio.'
        : r.diferenciacao === 3
          ? 'Você se vê na média entre os similares da região. A leitura por cor pode ajudar a se destacar com transparência e confiança.'
          : 'Você já se vê como um negócio diferenciado na região. O sensor reforça a transparência e a confiança que sustentam essa posição.');
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
  /* ---------------- Sobre: linha do tempo (explosão, raios e sensor) ---------------- */
  var tlField = document.getElementById('timelineField');
  if (tlField) {
    var tlRays = tlField.querySelector('.timeline-field__rays');
    var tlBurst = tlField.querySelector('.timeline-field__burst');
    var tlItems = tlField.querySelectorAll('.timeline__item');
    var tlStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var tlSpan = 0;
    var tlTicking = false;

    // Campo de linhas entre a explosão (topo) e o sensor (base), em pixels reais.
    function tlBuildRays() {
      var w = tlRays.clientWidth;
      var h = tlRays.clientHeight;
      if (!w || !h) return;
      tlSpan = h;
      var stops = ['purple', 'blue', 'teal', 'green', 'yellow'].map(function (c, i) {
        return '<stop offset="' + i / 4 + '" style="stop-color:var(--c-' + c + ')"/>';
      }).join('');
      var out = '<defs><linearGradient id="tlRayGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="' + h + '">' + stops + '</linearGradient></defs>';
      var sides = 16;
      for (var i = 0; i < sides * 2; i++) {
        var side = i % 2 ? 1 : -1;
        var k = (Math.floor(i / 2) + 1) / sides;
        var reach = k * w * 0.62;
        var c1 = (w / 2 + side * reach).toFixed(0) + ' ' + (h * 0.08 * Math.sin(i * 2.3)).toFixed(0);
        var c2 = (w / 2 + side * reach * (0.7 + 0.5 * Math.abs(Math.sin(i)))).toFixed(0) + ' ' + (h * (0.9 + 0.1 * Math.cos(i * 1.7))).toFixed(0);
        var d = 'M' + w / 2 + ' 0C' + c1 + ' ' + c2 + ' ' + w / 2 + ' ' + h;
        var o = 0.85 - 0.55 * k;
        // um traço fino e outro largo e fraco por baixo, para dar brilho sem filtro
        out += '<path pathLength="1" d="' + d + '" stroke-width="5" style="opacity:' + (o * 0.16).toFixed(2) + '"/>' +
          '<path pathLength="1" d="' + d + '" stroke-width="' + (0.8 + 0.8 * Math.abs(Math.sin(i * 1.3))).toFixed(1) + '" style="opacity:' + o.toFixed(2) + '"/>';
      }
      tlRays.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      tlRays.innerHTML = out;
    }

    // Estrela de raios curtos que "explode" a partir do início da linha.
    function tlBuildBurst() {
      var lines = '';
      var colors = ['#fff', 'var(--c-blue)', '#fff', 'var(--c-teal)'];
      for (var i = 0; i < 56; i++) {
        var a = (i / 56) * Math.PI * 2 + Math.sin(i * 3.1) * 0.05;
        var r2 = 32 + 68 * Math.abs(Math.sin(i * 1.7)) * Math.abs(Math.cos(i * 0.6));
        lines += '<line x1="' + (100 + Math.cos(a) * 8).toFixed(1) + '" y1="' + (100 + Math.sin(a) * 8).toFixed(1) +
          '" x2="' + (100 + Math.cos(a) * r2).toFixed(1) + '" y2="' + (100 + Math.sin(a) * r2).toFixed(1) +
          '" style="stroke:' + colors[i % 4] + ';opacity:' + (0.35 + 0.5 * Math.abs(Math.sin(i * 2.9))).toFixed(2) + '"/>';
      }
      tlBurst.innerHTML = '<svg viewBox="0 0 200 200">' + lines + '</svg>';
    }

    // Progresso: a ponta do raio fica a 60% da altura da tela.
    function tlUpdate() {
      tlTicking = false;
      var r = tlField.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = tlSpan ? Math.min(1, Math.max(0, (vh * 0.6 - r.top) / tlSpan)) : 1;
      var head = p * tlSpan;
      tlItems.forEach(function (item) {
        if (!item.classList.contains('is-lit') && item.getBoundingClientRect().top - r.top + 12 <= head) {
          item.classList.add('is-lit');
        }
      });
      tlField.style.setProperty('--p', p.toFixed(4));
      if (r.top < vh * 0.8) tlField.classList.add('is-burst');
      if (p >= 0.995) tlField.classList.add('is-unlocked');
    }

    function tlRequest() {
      if (!tlTicking) {
        tlTicking = true;
        requestAnimationFrame(tlUpdate);
      }
    }

    tlBuildBurst();
    tlBuildRays();
    if (tlStill) {
      // Sem movimento: tudo já aparece desenhado e o sensor fica à mostra.
      tlField.classList.add('is-burst', 'is-unlocked');
    } else {
      tlField.classList.add('is-live');
      tlUpdate();
      window.addEventListener('scroll', tlRequest, { passive: true });
      var tlResize;
      window.addEventListener('resize', function () {
        clearTimeout(tlResize);
        tlResize = setTimeout(function () { tlBuildRays(); tlRequest(); }, 120);
      });
    }
  }
})();
