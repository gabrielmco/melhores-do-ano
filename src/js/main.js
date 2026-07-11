import { lenis } from './modules/smoothScroll.js';
import { initNavbar } from './modules/navbar.js';
import { initHero } from './modules/hero.js';
import { initAbout } from './modules/about.js';
import { initGallery } from './modules/gallery.js';
import { initMethodology } from './modules/methodology.js';
import { initCTA } from './modules/cta.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

function initCommercialContactLinks() {
  const contactUrl = String(import.meta.env.VITE_COMMERCIAL_CONTACT_URL || '').trim();
  if (!contactUrl) return;

  document.querySelectorAll('[data-commercial-contact]').forEach((link) => {
    link.setAttribute('href', contactUrl);
  });
}

function initAll() {
  initCommercialContactLinks();
  initNavbar();
  initHero();
  initAbout();
  initGallery();
  initMethodology();
  initCTA();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}

// Global ScrollTrigger Refresh on Page Load (gives page elements time to render layouts)
window.addEventListener('load', () => {
  setTimeout(() => {
    ScrollTrigger.refresh();
  }, 200);
});
