  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }


  function animatedScroll(container, target, duration = 300) {
    const start = container.scrollLeft;
    const max = container.scrollWidth - container.clientWidth;
    const clampedTarget = Math.max(0, Math.min(target, max));
    const distance = clampedTarget - start;
    if (distance === 0) return;

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      container.scrollLeft = start + distance * easeInOutQuad(progress);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }


  document.addEventListener('DOMContentLoaded', function() {
    const wrappers = document.querySelectorAll('.carrusel-wrapper');
    wrappers.forEach(initCarrusel);
  });

  function initCarrusel(wrapper) {
    const scroller = wrapper.querySelector('.scroll-content');
    const btnLeft = wrapper.querySelector('.scroll-btn.left');
    const btnRight = wrapper.querySelector('.scroll-btn.right');


    const firstCard = scroller.querySelector('.tarjeta');
    const getGap = () => {
      const gapVal = getComputedStyle(scroller).gap || getComputedStyle(scroller).columnGap || '16px';
      return parseInt(gapVal, 10) || 0;
    };
    function getStep() {
      const gap = getGap();
      const cardW = firstCard ? firstCard.offsetWidth : 500;
      return cardW + gap;
    }

    function updateButtons() {
      const max = scroller.scrollWidth - scroller.clientWidth;
      btnLeft.disabled = scroller.scrollLeft <= 0;
      btnRight.disabled = scroller.scrollLeft >= max - 1; 
    }

    btnLeft.addEventListener('click', () => {
      animatedScroll(scroller, scroller.scrollLeft - getStep());
    });
    btnRight.addEventListener('click', () => {
      animatedScroll(scroller, scroller.scrollLeft + getStep());
    });


    scroller.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    updateButtons();


    scroller.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        animatedScroll(scroller, scroller.scrollLeft - getStep());
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        animatedScroll(scroller, scroller.scrollLeft + getStep());
      }
    });
  }
