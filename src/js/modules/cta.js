import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initCTA() {
  const section = document.getElementById('ctaFinalSection');
  if (!section) return;

  // Ensure initial states are explicitly set before animation
  gsap.set('.cta-overline', { 
    clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', 
    opacity: 0 
  });
  gsap.set('.cta-title-line', { 
    clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', 
    y: 15 
  });
  gsap.set('.cta-desc', { 
    clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', 
    y: 15 
  });
  gsap.set('.cta-btn-wrapper', { 
    opacity: 0, 
    x: -60 
  });

  // Timeline with ScrollTrigger
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 80%', // Animates when top of section enters 80% of viewport height
      toggleActions: 'play none none none' // Play once and keep the final state
    }
  });

  tl.to('.cta-overline', {
    clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out'
  })
  .to('.cta-title-line', {
    clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
    y: 0,
    duration: 1.0,
    stagger: 0.15,
    ease: 'power3.out'
  }, '-=0.5')
  .to('.cta-desc', {
    clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
    y: 0,
    duration: 1.0,
    ease: 'power3.out'
  }, '-=0.6')
  .to('.cta-btn-wrapper', {
    opacity: 1,
    x: 0,
    duration: 1.2,
    ease: 'power4.out'
  }, '-=0.6');
}
