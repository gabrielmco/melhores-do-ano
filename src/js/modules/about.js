import { gsap } from 'gsap';
import { splitText } from '../splitText.js';

export function initAbout() {
  const aboutSection = document.getElementById('about');
  if (!aboutSection) return;

  const aboutTitleLines = document.querySelectorAll('.about-title-line');
  const aboutChars = [];

  aboutTitleLines.forEach((line) => {
    const split = splitText(line, { type: 'chars' });
    if (split && split.chars) {
      aboutChars.push(...split.chars);
    }
  });

  const descSplit = splitText('.about-desc', { type: 'words' });
  const descWords = descSplit && descSplit.words ? descSplit.words : [];

  gsap.set('.about-overline', { opacity: 0, x: -20 });
  if (aboutChars.length > 0) {
    gsap.set(aboutChars, { opacity: 0, y: 15, rotateX: -30 });
  }
  
  if (descWords.length > 0) {
    gsap.set(descWords, { opacity: 0, y: 20 });
  } else {
    gsap.set('.about-desc', { opacity: 0, y: 20 });
  }

  gsap.set('.about-feature-row', { opacity: 0, x: -20 });
  gsap.set('.about-cta-group > a', { opacity: 0, y: 35 });
  gsap.set('.about-plaque-img', { yPercent: -10 });

  // About background image vertical parallax (Only on desktop to optimize painting performance on mobile)
  if (window.innerWidth > 768) {
    gsap.to('.about-plaque-img', {
      yPercent: 10,
      ease: 'none',
      scrollTrigger: {
        trigger: '#about',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  // Smooth slide/fade reveal for the image column on the right
  gsap.from('.about-image-col', {
    opacity: 0,
    x: 45,
    duration: 1.5,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#about',
      start: 'top 80%',
      toggleActions: 'play none none none'
    }
  });

  // Texts, badges, and CTA sequential scroll reveal
  const aboutTl = gsap.timeline({
    scrollTrigger: {
      trigger: '.about-text-col',
      start: 'top 95%',
      end: 'top 20%',
      scrub: 2.5,
    }
  });

  aboutTl
    .to('.about-overline', {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: 'power3.out'
    })
    .to(aboutChars, {
      opacity: 1,
      y: 0,
      rotateX: 0,
      stagger: 0.02,
      duration: 0.8,
      ease: 'back.out(1.2)'
    }, '-=0.6');

  if (descWords.length > 0) {
    aboutTl.to(descWords, {
      opacity: 1,
      y: 0,
      stagger: 0.015,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.6');
  } else {
    aboutTl.to('.about-desc', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.6');
  }

  aboutTl
    .to('.about-feature-row', {
      opacity: 1,
      x: 0,
      stagger: 0.15,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.5')
    .to('.about-cta-group > a', {
      opacity: 1,
      y: 0,
      stagger: 0.15,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.5');
}
