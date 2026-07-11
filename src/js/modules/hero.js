import { gsap } from 'gsap';
import { splitText } from '../splitText.js';

export function initHero() {
  const heroSection = document.getElementById('heroSection');
  const trophy = document.getElementById('heroTrophy');
  
  if (!heroSection) return;

  const introTl = gsap.timeline({
    defaults: { ease: 'power3.out' }
  });

  // Split title lines into characters for stagger animation
  const split1 = splitText('.hero-title-line.line-1', { type: 'chars' });
  const split2 = splitText('.hero-title-line.line-2', { type: 'chars' });
  const allChars = [];
  if (split1 && split1.chars) allChars.push(...split1.chars);
  if (split2 && split2.chars) allChars.push(...split2.chars);

  // Set initial states
  gsap.set('.navbar', { opacity: 0 }); // Only opacity — y/transform are owned by CSS
  gsap.set('#heroInfiniteBanner', { opacity: 0, y: 30, scale: 0.98 });
  gsap.set('.hero-overline', { opacity: 0, y: 15 });
  gsap.set('.hero-desc', { opacity: 0, y: 20 });
  gsap.set('.hero-cta-group', { opacity: 0, y: 15 });
  if (allChars.length > 0) {
    gsap.set(allChars, { opacity: 0, x: 20, y: 10 });
  }

  // Remove class to deactivate CSS opacity override
  document.body.classList.remove('js-loading');

  // Timeline orchestration
  introTl
    // 1. Reveal Trophy (subtle centered bg at 100% opacity) and ambient background
    .to('#heroTrophyWrapper', {
      opacity: 1,
      duration: 2.2,
      ease: 'power3.out'
    })
    .from('#heroTrophy', {
      scale: 1.08,
      duration: 2.5,
      ease: 'power3.out'
    }, 0)
    // 2. Fade-in Navigation (opacity only — transform left to CSS)
    .to('.navbar', {
      opacity: 1,
      duration: 1.0,
      ease: 'power2.out',
      onComplete: () => gsap.set('.navbar', { clearProps: 'opacity' })
    }, 0.5)
    // 3. Fade-in Overline
    .to('.hero-overline', {
      opacity: 1,
      y: 0,
      duration: 1.0,
      ease: 'power3.out'
    }, 0.6)
    // 4. Stagger Title Characters
    .to(allChars, {
      opacity: 1,
      x: 0,
      y: 0,
      stagger: 0.02,
      duration: 0.8,
      ease: 'power2.out'
    }, 0.7)
    // 5. Fade-in Description
    .to('.hero-desc', {
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: 'power3.out'
    }, 1.0)
    // 6. Fade-in CTA Group
    .to('.hero-cta-group', {
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: 'power3.out'
    }, 1.2)
    // 7. Fade-in Centered Giant Scrolling Text at the base
    .to('#heroInfiniteBanner', {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.6,
      ease: 'power3.out'
    }, 0.8);

  // Hero Scroll Parallax & Fade-out (ScrollTrigger)
  const scrollTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#heroSection',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.5,
    }
  });

  scrollTl
    .to('#heroTrophyWrapper', {
      y: 200,
      ease: 'none',
      duration: 1.0
    }, 0)
    .to('.hero-text-col', {
      y: -80,
      opacity: 0,
      duration: 1.0
    }, 0);



  // 3D Trophy Mouse Parallax
  if (trophy) {
    const xTo = gsap.quickTo(trophy, 'x', { duration: 0.8, ease: 'power2.out' });
    const yTo = gsap.quickTo(trophy, 'y', { duration: 0.8, ease: 'power2.out' });

    heroSection.addEventListener('mousemove', (e) => {
      const mouseX = (e.clientX / window.innerWidth) - 0.5;
      const mouseY = (e.clientY / window.innerHeight) - 0.5;
      xTo(-mouseX * 40);
      yTo(-mouseY * 25);
    });

    heroSection.addEventListener('mouseleave', () => {
      xTo(0);
      yTo(0);
    });
  }
}
