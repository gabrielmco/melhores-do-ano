import { gsap } from 'gsap';
import { splitText } from '../splitText.js';

export function initAccessPanels() {
  const title = document.querySelector('#accessPanels .access-hub-title');
  if (!title) return;

  // Split text for character reveal
  const split = splitText(title, { type: 'chars' });
  const chars = split && split.chars ? split.chars : [];

  // Definir estados iniciais
  gsap.set('#accessPanels .access-hub-overline', { opacity: 0, x: -20 });
  if (chars.length > 0) gsap.set(chars, { opacity: 0, y: 15, rotateX: -30 });
  gsap.set('#accessPanels .access-hub-intro', { opacity: 0, y: 20 });
  gsap.set('#accessPanels .access-panel-card', { opacity: 0, y: 30 });

  // Timeline com ScrollTrigger exatamente com o mesmo padrão da Section 3 (Gallery)
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#accessPanels',
      start: 'top 95%',
      end: 'top 30%',
      scrub: 2.5,
    }
  });

  tl.to('#accessPanels .access-hub-overline', { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' })
    .to(chars, { opacity: 1, y: 0, rotateX: 0, stagger: 0.02, duration: 0.8, ease: 'back.out(1.2)' }, '-=0.6')
    .to('#accessPanels .access-hub-intro', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
    .to('#accessPanels .access-panel-card', { opacity: 1, y: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' }, '-=0.6');
}
