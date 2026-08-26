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

  if (chaptersWrap && chapters.length) {
    function setActive(idx) {
      var color = chapters[idx].style.getPropertyValue('--chapter-color') || '#4E2E86';
      if (sensorColor) {
        sensorColor.style.backgroundColor = sensorColors[idx] || color;
        /* The first state uses the original photographed purple sensor. */
        sensorColor.style.opacity = idx === 0 ? '0' : '1';
      }
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

      /* As soon as "Para o seu negócio" starts arriving, animate the sensor
         upward with the final chapter instead of making it abruptly vanish. */
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
