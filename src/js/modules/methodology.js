import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initMethodology() {
  const section = document.getElementById('methodologySection');
  if (!section) return;

  const steps = document.querySelectorAll('.methodology-step-item');
  const comments = document.querySelectorAll('.comment-bubble');
  const laser = document.querySelector('.phone-laser-line');

  // GSAP MatchMedia for responsive animations
  const ctx = gsap.matchMedia();

  // Desktop (min-width: 993px)
  ctx.add("(min-width: 993px)", () => {
    // Garante que o Kit está dentro do Pin Container para a animação desktop
    const pinContainer = document.querySelector('.methodology-pin-container');
    const overlapKit = document.querySelector('.methodology-overlap-kit');
    if (pinContainer && overlapKit && overlapKit.parentNode !== pinContainer) {
      pinContainer.appendChild(overlapKit);
    }

    // Initial setup sets for desktop
    gsap.set(comments, { opacity: 0, scale: 0.7, y: 80, z: -100 });
    gsap.set(laser, { scaleY: 0, opacity: 0, top: '10%' });
    gsap.set('.phone-plaque-screen', { opacity: 0, scale: 0.95 });
    gsap.set('.methodology-overlap-kit', { y: '100vh' });
    gsap.set('.methodology-step-item:not(.active)', { opacity: 0.35 });
    gsap.set('.step-progress-fill', { height: '0%' });

    // Cards and header initial setup
    gsap.set('.kit-header > *', { opacity: 0, y: 40 });
    gsap.set('.kit-card', { opacity: 0, y: 60, scale: 0.95 });
    gsap.set('.kit-footer-cta', { opacity: 0, y: 30 });

    // Main ScrollTrigger timeline with pinning (optimized scroll height)
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#methodologySection',
        start: 'top top',
        end: '+=5500',
        pin: true,
        scrub: 1.5,
        anticipatePin: 1
      }
    });

    // Step 1: Active
    tl.to('.methodology-step-item[data-step="1"]', { opacity: 1, duration: 0.3 })
      .to('.methodology-step-item[data-step="1"] .step-progress-fill', {
        height: '100%',
        duration: 1,
        ease: 'none'
      });

    // Step 2 Transition: Stagger reveal comments on the left
    tl.to('.methodology-step-item[data-step="1"]', { opacity: 0.35, duration: 0.4 }, 'step2-start')
      .to('.methodology-step-item[data-step="2"]', { opacity: 1, duration: 0.4 }, 'step2-start')
      .to('.methodology-step-item[data-step="2"] .step-progress-fill', {
        height: '100%',
        duration: 1,
        ease: 'none'
      }, 'step2-start')
      .to(comments, {
        opacity: 1,
        y: (i) => [-130, -50, 40, 110, 200, 280][i],
        x: (i) => [-170, 180, -200, 210, -160, 180][i],
        z: 0,
        scale: 1,
        stagger: 0.15,
        duration: 1.8,
        ease: 'back.out(1.1)'
      }, 'step2-start');

    // Step 3 Transition: Scan effect on mockup and counter ticker count-up
    const counterObj = { value: 0 };
    
    tl.to('.methodology-step-item[data-step="2"]', { opacity: 0.35, duration: 0.4 }, 'step3-start')
      .to('.methodology-step-item[data-step="3"]', { opacity: 1, duration: 0.4 }, 'step3-start')
      .to('.methodology-step-item[data-step="3"] .step-progress-fill', {
        height: '100%',
        duration: 1,
        ease: 'none'
      }, 'step3-start')
      
      // Laser line sweep scan
      .set(laser, { opacity: 1 }, 'step3-start')
      .to(laser, {
        top: '90%',
        duration: 1.8,
        ease: 'power2.inOut'
      }, 'step3-start')
      .to('.phone-plaque-screen', {
        opacity: 1,
        scale: 1,
        duration: 1.4,
        ease: 'power2.out'
      }, 'step3-start+=0.4')
      .to(laser, { opacity: 0, duration: 0.2 })
      
      // Count-up ticker numeric update
      .to(counterObj, {
        value: 8412,
        duration: 2.0,
        ease: 'power1.out',
        onUpdate: () => {
          const valueElement = document.querySelector('.counter-value');
          if (valueElement) {
            valueElement.textContent = Math.floor(counterObj.value).toLocaleString('pt-BR');
          }
        }
      }, 'step3-start')

      // Step 4: Overlap Slide-Up Cover Transition
      .to('.methodology-overlap-kit', {
        y: '0vh',
        duration: 2.2,
        ease: 'power2.inOut'
      }, 'overlap-start')
      .set('.methodology-overlap-kit', { overflowY: 'auto', pointerEvents: 'auto' }, 'overlap-start+=2.2')
      
      // Cards entrance animations stagger
      .to('.kit-header > *', {
        opacity: 1,
        y: 0,
        stagger: 0.15,
        duration: 1.0,
        ease: 'power3.out'
      }, 'overlap-start+=1.4')
      .to('.kit-card', {
        opacity: 1,
        y: 0,
        scale: 1,
        stagger: 0.15,
        duration: 1.2,
        ease: 'power3.out'
      }, 'overlap-start+=1.6')
      .to('.kit-footer-cta', {
        opacity: 1,
        y: 0,
        duration: 1.0,
        ease: 'power3.out'
      }, 'overlap-start+=2.0');
  });

  // Mobile and Tablets (max-width: 992px)
  ctx.add("(max-width: 992px)", () => {
    // Garante que o Kit se torna uma seção irmã independente no mobile
    const section = document.getElementById('methodologySection');
    const overlapKit = document.querySelector('.methodology-overlap-kit');
    if (section && overlapKit && overlapKit.parentNode === document.querySelector('.methodology-pin-container')) {
      section.parentNode.insertBefore(overlapKit, section.nextSibling);
    }

    // Reset layout elements to natural flow
    gsap.set(comments, { opacity: 0, scale: 0.1, y: 0, x: 0, z: 0 });
    gsap.set(laser, { opacity: 0, top: '10%' });
    gsap.set('.phone-plaque-screen', { opacity: 0, scale: 1 });
    gsap.set('.methodology-overlap-kit', { y: '0vh', pointerEvents: 'auto' });
    
    // Set all steps to fully visible
    gsap.set('.methodology-step-item', { opacity: 1 });
    gsap.set('.step-progress-fill', { height: '100%' });

    // Animate comments explosion (Option 1) on scroll (popcorn effect emerging from the phone screen)
    gsap.to(comments, {
      scrollTrigger: {
        trigger: '.phone-frame-wrapper',
        start: 'top 75%',
        toggleActions: 'play none none none'
      },
      opacity: 1,
      scale: 1,
      x: (i) => [-90, 90, -100, 100, -90, 90][i],
      y: (i) => [-130, -70, 0, 70, 140, 210][i],
      stagger: 0.1,
      duration: 1.2,
      ease: 'back.out(1.2)'
    });

    // Animate counter ticker numeric count-up on scroll
    const counterObj = { value: 0 };
    gsap.to(counterObj, {
      scrollTrigger: {
        trigger: '.methodology-counter-wrapper',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      value: 8412,
      duration: 2.0,
      ease: 'power1.out',
      onUpdate: () => {
        const valueElement = document.querySelector('.counter-value');
        if (valueElement) {
          valueElement.textContent = Math.floor(counterObj.value).toLocaleString('pt-BR');
        }
      }
    });

    // Animate smartphone sweep scan when mockup is visible (start: 'top 55%' to follow the comments explosion)
    const mobileLaserTl = gsap.timeline({
      scrollTrigger: {
        trigger: '.phone-frame-wrapper',
        start: 'top 55%',
        toggleActions: 'play none none none'
      }
    });

    mobileLaserTl.set(laser, { opacity: 1 })
      .to(laser, {
        top: '90%',
        duration: 1.8,
        ease: 'power2.inOut'
      })
      .to('.phone-plaque-screen', {
        opacity: 1,
        duration: 1.2,
        ease: 'power2.out'
      }, '-=1.4')
      .to(laser, { opacity: 0, duration: 0.2 });

    // Animate Kit cards fade-in cleanly when scrolling to them
    gsap.fromTo('.kit-header > *', 
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.kit-header',
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );

    gsap.fromTo('.kit-card', 
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.kit-cards-grid',
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );

    gsap.fromTo('.kit-footer-cta', 
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.kit-footer-cta',
          start: 'top 90%',
          toggleActions: 'play none none none'
        }
      }
    );
  });

  // Premium Mousemove Parallax Hover Effect (Only on devices that support hover pointer)
  if (window.matchMedia('(hover: hover)').matches) {
    const kitCards = document.querySelectorAll('.kit-card');
    kitCards.forEach(card => {
      const media = card.querySelector('.kit-card-img, .kit-card-video');
      if (!media) return;

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const percentX = (x / rect.width) - 0.5;
        const percentY = (y / rect.height) - 0.5;
        
        // Move a imagem proporcionalmente de forma muito suave (máximo de 20px)
        gsap.to(media, {
          x: percentX * 20,
          y: percentY * 20,
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });

      card.addEventListener('mouseleave', () => {
        // Retorna a imagem suavemente ao centro
        gsap.to(media, {
          x: 0,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      });
    });
  }

  // Premium Toggle Details Animation
  const toggles = document.querySelectorAll('.kit-card-toggle');
  toggles.forEach(toggle => {
    let isOpen = false;
    const card = toggle.closest('.kit-card');
    const panel = card.querySelector('.kit-card-details-panel');
    const textGroup = card.querySelector('.kit-card-text-group');
    const desc = panel.querySelector('.kit-card-description');
    const features = panel.querySelectorAll('.kit-card-features li');
    const svgIcon = toggle.querySelector('.toggle-icon-svg');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation(); // Previne eventos de clique indesejados no card pai
      isOpen = !isOpen;

      if (isOpen) {
        // Gira o SVG 45 graus para transformar o "+" em "x"
        gsap.to(svgIcon, { rotate: 45, duration: 0.4, ease: 'power2.out' });
        toggle.classList.add('active');

        // Oculta levemente o título e subtítulo original do rodapé do card
        gsap.to(textGroup, { opacity: 0, x: -10, duration: 0.3, ease: 'power2.out' });

        // Desliza o painel de detalhes (com checks) de baixo para cima
        panel.classList.add('active');
        gsap.to(panel, {
          y: '0%',
          duration: 0.5,
          ease: 'power3.out'
        });

        // Efeito Awwwards stagger: revela a descrição e os itens da lista um a um de baixo para cima
        gsap.to(desc, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.15 });
        gsap.to(features, {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.4,
          ease: 'power2.out',
          delay: 0.2
        });
      } else {
        // Gira o SVG de volta para "0" graus, redefinindo para "+"
        gsap.to(svgIcon, { rotate: 0, duration: 0.4, ease: 'power2.out' });
        toggle.classList.remove('active');

        // Mostra o título e subtítulo de volta
        gsap.to(textGroup, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out', delay: 0.2 });

        // Anima a saída dos itens e descrição sumindo
        gsap.to([desc, ...features], {
          opacity: 0,
          y: 15,
          duration: 0.25,
          ease: 'power2.in',
          overwrite: 'auto'
        });

        // Desliza o painel de volta para baixo
        gsap.to(panel, {
          y: '100%',
          duration: 0.4,
          ease: 'power3.in',
          onComplete: () => {
            panel.classList.remove('active');
          }
        });
      }
    });
  });
}
