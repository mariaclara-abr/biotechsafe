(function () {
  'use strict';

  /* ---------------- Nav: solid on scroll ---------------- */
  var nav = document.getElementById('nav');
  var progressBar = document.getElementById('progressBar');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('is-scrolled', y > 40);

    if (progressBar) {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? y / max : 0;
      progressBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, pct)) + ')';
    }
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', onScroll);
  onScroll();

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
          if (sensorPos) sensorPos.classList.add('is-visible');
        });
      }, { threshold: 0.05 });
      visIO.observe(chaptersWrap);

      /* As soon as "Para o seu negócio" starts arriving, release the sensor
         and send it rising off the top of the page, so it's fully clear of
         the section's photo by the time the scroll snap settles there. */
      var clientesSection = document.getElementById('clientes');
      if (clientesSection && sensorPos) {
        var releaseIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var finalTop = window.scrollY - window.innerHeight * 0.6;
              if (!sensorPos.classList.contains('is-released')) {
                var startTop = window.scrollY + window.innerHeight * 0.5;
                sensorPos.style.top = startTop + 'px';
                sensorPos.classList.add('is-released');
                requestAnimationFrame(function () {
                  requestAnimationFrame(function () {
                    sensorPos.style.top = finalTop + 'px';
                  });
                });
              } else {
                /* Safety net: guarantee it's fully clear once settled here,
                   even if the rise above hasn't finished yet. */
                sensorPos.style.top = finalTop + 'px';
              }
            } else if (entry.boundingClientRect.top >= 0) {
              /* Scrolled back above "Para o seu negócio": pin it again. */
              sensorPos.classList.remove('is-released');
              sensorPos.style.top = '';
            }
          });
        }, { threshold: [0.01, 0.4] });
        releaseIO.observe(clientesSection);
      }
    } else {
      setActive(0);
      if (sensorPos) sensorPos.classList.add('is-visible');
      if (dotsWrap) dotsWrap.classList.add('is-visible');
    }

    setActive(0);
  }

  /* ---------------- Clientes: açougue / restaurante (selecionável) ---------------- */
  var clientesGrid = document.getElementById('clientesGrid');
  var clientesCards = clientesGrid ? clientesGrid.querySelectorAll('.clientes__card') : [];
  var clientesCtaTitle = document.getElementById('clientesCtaTitle');
  var clientesCtaLink = document.getElementById('clientesCtaLink');
  var clientesCtaDefaultTitle = clientesCtaTitle ? clientesCtaTitle.textContent : '';

  if (clientesCards.length) {
    function selectCliente(card) {
      var isSame = card.getAttribute('aria-checked') === 'true';
      clientesCards.forEach(function (c) { c.setAttribute('aria-checked', 'false'); });

      if (isSame) {
        if (clientesCtaTitle) clientesCtaTitle.textContent = clientesCtaDefaultTitle;
        if (clientesCtaLink) {
          clientesCtaLink.href = 'mailto:contato@biotechsafe.com.br?subject=Quero%20a%20BioTechSafe';
        }
        return;
      }

      card.setAttribute('aria-checked', 'true');
      var negocio = card.getAttribute('data-negocio');
      if (clientesCtaTitle) {
        clientesCtaTitle.textContent = 'Quer a BioTechSafe no seu ' + negocio + '?';
      }
      if (clientesCtaLink) {
        clientesCtaLink.href = 'mailto:contato@biotechsafe.com.br?subject=Quero%20a%20BioTechSafe%20no%20meu%20' + encodeURIComponent(negocio);
      }
    }

    clientesCards.forEach(function (card) {
      card.addEventListener('click', function () { selectCliente(card); });
    });
  }
})();
