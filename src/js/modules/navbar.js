import { lenis } from './smoothScroll.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (!navbar) return;

  const HERO_TRIGGER = 80;   // px scroll depth before navbar goes solid
  const HIDE_TRIGGER = 200;  // px scroll depth before navbar hides on downscroll

  let lastScrollY = 0;
  let navbarVisible = true;

  function updateNavbar(currentY) {
    const scrollingDown = currentY > lastScrollY;
    const delta = Math.abs(currentY - lastScrollY);

    // 1. Transparent at top vs solid on scroll
    if (currentY > HERO_TRIGGER) {
      navbar.classList.add('navbar-solid');
    } else {
      navbar.classList.remove('navbar-solid');
      navbar.classList.remove('navbar-hidden');
      navbarVisible = true;
      lastScrollY = currentY;
      return;
    }

    // 2. Ignore tiny scroll deltas to avoid jittering
    if (delta < 4) {
      lastScrollY = currentY;
      return;
    }

    // 3. Hide on down-scroll, show on up-scroll
    if (scrollingDown && currentY > HIDE_TRIGGER) {
      if (navbarVisible) {
        navbar.classList.add('navbar-hidden');
        navbarVisible = false;
      }
    } else if (!scrollingDown) {
      if (!navbarVisible) {
        navbar.classList.remove('navbar-hidden');
        navbarVisible = true;
      }
    }

    lastScrollY = currentY;
  }

  // Bind scroll event to Lenis
  lenis.on('scroll', (e) => {
    updateNavbar(e.scroll);
  });

  // Scroll Spy: Highlight active nav link on scroll using ScrollTrigger
  const sections = ['heroSection', 'about', 'gallerySection', 'methodologySection'];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    ScrollTrigger.create({
      trigger: el,
      start: 'top 45%', // activates when the top of the section reaches 45% of viewport height
      end: 'bottom 45%', // deactivates when the bottom leaves 45% of viewport height
      onToggle: (self) => {
        if (self.isActive) {
          navLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      }
    });
  });

  // Mobile navigation drawer toggle
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
  }
}
