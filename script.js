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

  if (chaptersWrap && chapters.length) {
    function setActive(idx) {
      var color = chapters[idx].style.getPropertyValue('--chapter-color') || '#4E2E86';
      if (sensorColor) sensorColor.style.backgroundColor = color;
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
          if (sensorPos) sensorPos.classList.toggle('is-visible', entry.isIntersecting);
          if (dotsWrap) dotsWrap.classList.toggle('is-visible', entry.isIntersecting);
        });
      }, { threshold: 0.05 });
      visIO.observe(chaptersWrap);
    } else {
      setActive(0);
      if (sensorPos) sensorPos.classList.add('is-visible');
      if (dotsWrap) dotsWrap.classList.add('is-visible');
    }

    setActive(0);
  }
})();
