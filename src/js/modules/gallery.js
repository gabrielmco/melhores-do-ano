import { gsap } from 'gsap';
import { splitText } from '../splitText.js';

export function initGallery() {
  const galleryTitle = document.querySelector('#gallerySection .gallery-title');
  if (!galleryTitle) return;

  // Reveal text headers
  const split = splitText(galleryTitle, { type: 'chars' });
  const chars = split && split.chars ? split.chars : [];
  
  gsap.set('#gallerySection .gallery-overline', { opacity: 0, x: -20 });
  if (chars.length > 0) gsap.set(chars, { opacity: 0, y: 15, rotateX: -30 });
  gsap.set('#gallerySection .gallery-desc', { opacity: 0, y: 20 });
  gsap.set('#gallerySection .gallery-cta-wrapper', { opacity: 0, y: 25 });
  gsap.set('#gallerySection .footer-grid-item', { opacity: 0, y: 25 });
  
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#gallerySection',
      start: 'top 95%',
      end: 'top 20%',
      scrub: 2.5,
    }
  });
  
  tl.to('#gallerySection .gallery-overline', { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' })
    .to(chars, { opacity: 1, y: 0, rotateX: 0, stagger: 0.02, duration: 0.8, ease: 'back.out(1.2)' }, '-=0.6')
    .to('#gallerySection .gallery-desc', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
    .to('#gallerySection .gallery-cta-wrapper', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
    .to('#gallerySection .footer-grid-item', { opacity: 1, y: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out' }, '-=0.6');
}
