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
