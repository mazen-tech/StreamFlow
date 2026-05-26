/* ============================================================
   StreamFlow – FAQ Accordion JavaScript
   ============================================================ */

(function () {
  'use strict';

  const faqItems = document.querySelectorAll('.faq__item');

  if (!faqItems.length) return;

  faqItems.forEach(function (item) {
    const question = item.querySelector('.faq__question');
    const answer   = item.querySelector('.faq__answer');

    if (!question || !answer) return;

    question.addEventListener('click', function () {
      const isOpen = question.getAttribute('aria-expanded') === 'true';

      // Close all other items (accordion behavior)
      faqItems.forEach(function (otherItem) {
        const otherQ = otherItem.querySelector('.faq__question');
        const otherA = otherItem.querySelector('.faq__answer');
        if (otherQ && otherA && otherItem !== item) {
          otherQ.setAttribute('aria-expanded', 'false');
          otherA.hidden = true;
        }
      });

      // Toggle current
      if (isOpen) {
        question.setAttribute('aria-expanded', 'false');
        answer.hidden = true;
      } else {
        question.setAttribute('aria-expanded', 'true');
        answer.hidden = false;
      }
    });

    /* Keyboard: allow Enter and Space to toggle */
    question.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        question.click();
      }
    });
  });

})();
