/* ============================================================
   StreamFlow – Scroll Animations (Intersection Observer)
   ============================================================ */

(function () {
  'use strict';

  /* Respect prefers-reduced-motion */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  /* Elements to animate on scroll */
  const animTargets = document.querySelectorAll(
    '.card, .category-card, .pricing-card, .stats__item, .faq__item, .promo__text, .promo__devices'
  );

  if (!animTargets.length) return;

  /* Add initial hidden state */
  animTargets.forEach(function (el, i) {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    // Stagger delay based on position within parent
    const siblings = Array.from(el.parentElement.children);
    const index    = siblings.indexOf(el);
    el.style.transitionDelay = (index * 0.07) + 's';
  });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target); // animate once
        }
      });
    },
    {
      threshold:  0.1,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  animTargets.forEach(function (el) {
    observer.observe(el);
  });

})();
