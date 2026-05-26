/* ============================================================
   StreamFlow – Navigation JavaScript
   ============================================================ */

(function () {
  'use strict';

  const header       = document.querySelector('.header');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu   = document.getElementById('mobileMenu');
  const mobileLinks  = document.querySelectorAll('.mobile-menu__link, .mobile-menu__actions .btn');

  if (!header || !hamburgerBtn || !mobileMenu) return;

  /* ===== Scroll: add background to nav ===== */
  function onScroll() {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run on load

  /* ===== Hamburger toggle ===== */
  function openMenu() {
    mobileMenu.classList.add('open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    mobileMenu.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    // Move focus to first link
    const firstLink = mobileMenu.querySelector('.mobile-menu__link');
    if (firstLink) firstLink.focus();
  }

  function closeMenu() {
    mobileMenu.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    hamburgerBtn.focus();
  }

  function toggleMenu() {
    if (mobileMenu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  hamburgerBtn.addEventListener('click', toggleMenu);

  /* Close menu when a link is clicked */
  mobileLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      closeMenu();
    });
  });

  /* Close on Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      closeMenu();
    }
  });

  /* Close when clicking outside */
  document.addEventListener('click', function (e) {
    if (
      mobileMenu.classList.contains('open') &&
      !mobileMenu.contains(e.target) &&
      !hamburgerBtn.contains(e.target)
    ) {
      closeMenu();
    }
  });

  /* ===== Active nav link highlight on scroll ===== */
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav__link');

  function highlightNav() {
    let current = '';
    sections.forEach(function (section) {
      const sectionTop = section.offsetTop - 100;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(function (link) {
      link.classList.remove('nav__link--active');
      const href = link.getAttribute('href');
      if (href === '#' + current) {
        link.classList.add('nav__link--active');
      }
    });
  }

  window.addEventListener('scroll', highlightNav, { passive: true });

})();
