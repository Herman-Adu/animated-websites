/* ============================================================
   PROMIX 2100 — app.js
   Lenis smooth scroll + GSAP canvas renderer + section system
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);

// ── Config ─────────────────────────────────────────────────────────────────
const FRAME_COUNT  = 241;
const FRAME_SPEED  = 2.0;   // 1.8–2.2: higher = animation ends sooner
const IMAGE_SCALE  = 0.88;  // padded cover, product floats in void
const BG_COLOR     = '#000000'; // matches page background exactly
const FRAMES_DIR   = 'frames/';

// ── State ───────────────────────────────────────────────────────────────────
const frames       = new Array(FRAME_COUNT).fill(null);
let currentFrame   = 0;
let framesLoaded   = 0;
let allLoaded      = false;

// ── DOM Refs ────────────────────────────────────────────────────────────────
const loader       = document.getElementById('loader');
const loaderBar    = document.getElementById('loader-bar');
const loaderPct    = document.getElementById('loader-percent');
const canvasWrap   = document.getElementById('canvas-wrap');
const canvas       = document.getElementById('canvas');
const ctx          = canvas.getContext('2d');
const overlay      = document.getElementById('dark-overlay');
const marqueeWrap  = document.getElementById('marquee-wrap');
const scrollCont   = document.getElementById('scroll-container');
const heroSection  = document.querySelector('.hero-standalone');

// ── Canvas sizing ────────────────────────────────────────────────────────────
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
  drawFrame(currentFrame);
}

// ── Canvas draw — product in right 2/3 of viewport ───────────────────────────
function drawFrame(index) {
  const img = frames[index];
  const cw = window.innerWidth;
  const ch = window.innerHeight;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, cw, ch);

  if (!img || !img.complete || img.naturalWidth === 0) return;

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  // Right 2/3 zone
  const zoneX = cw / 3;
  const zoneW = (2 / 3) * cw;

  const scale = Math.max(zoneW / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = zoneX + (zoneW - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.drawImage(img, dx, dy, dw, dh);
}

// ── Frame preloader ──────────────────────────────────────────────────────────
function padded(n) {
  return String(n).padStart(4, '0');
}

function onFrameLoad() {
  framesLoaded++;
  const pct = Math.round((framesLoaded / FRAME_COUNT) * 100);
  loaderBar.style.width = pct + '%';
  loaderPct.textContent = pct + '%';

  if (framesLoaded === FRAME_COUNT) {
    allLoaded = true;
    startExperience();
  }
}

function loadFrame(index) {
  const img = new Image();
  img.onload  = onFrameLoad;
  img.onerror = onFrameLoad; // count errors too, don't stall
  img.src = FRAMES_DIR + 'frame_' + padded(index + 1) + '.webp';
  frames[index] = img;
}

function preloadFrames() {
  // Phase 1: first 10 frames immediately (fast first paint)
  for (let i = 0; i < Math.min(10, FRAME_COUNT); i++) {
    loadFrame(i);
  }
  // Phase 2: remaining frames
  for (let i = 10; i < FRAME_COUNT; i++) {
    loadFrame(i);
  }
}

// ── Hero entrance animation ──────────────────────────────────────────────────
function animateHero() {
  const tl = gsap.timeline({ delay: 0.2 });

  tl.to('.hero-label', {
    opacity: 1, y: 0, duration: 0.7, ease: 'power3.out'
  })
  .to('.hero-word', {
    y: '0%', opacity: 1,
    stagger: 0.12, duration: 1.0, ease: 'power4.out'
  }, '-=0.3')
  .to('.hero-tagline', {
    opacity: 1, y: 0, duration: 0.7, ease: 'power3.out'
  }, '-=0.4');
}

// ── Start experience (after all frames loaded) ───────────────────────────────
function startExperience() {
  // Hide loader with fade
  gsap.to(loader, {
    opacity: 0,
    duration: 0.8,
    ease: 'power2.inOut',
    onComplete: () => { loader.style.display = 'none'; }
  });

  // Animate hero text in
  animateHero();

  // Boot scroll system
  initLenis();
}

// ── Lenis smooth scroll ──────────────────────────────────────────────────────
function initLenis() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Init all scroll systems now that Lenis is running
  initHeroTransition();
  initFrameScrub();
  initSections();
  initMarquee();
  initDarkOverlay(0.58, 0.77);
  initCounters();
}

// ── Hero → Canvas circle-wipe transition ─────────────────────────────────────
function initHeroTransition() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;

      // Hero fades out as scroll begins
      heroSection.style.opacity = Math.max(0, 1 - p * 18);

      // Canvas reveals via expanding circle clip-path
      const wipeProgress = Math.min(1, Math.max(0, (p - 0.005) / 0.07));
      const radius = wipeProgress * 80;
      canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
    }
  });
}

// ── Frame-to-scroll binding ──────────────────────────────────────────────────
function initFrameScrub() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(
        Math.floor(accelerated * FRAME_COUNT),
        FRAME_COUNT - 1
      );
      if (index !== currentFrame) {
        currentFrame = index;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    }
  });
}

// ── Section positioning and animation ────────────────────────────────────────
function positionSection(section) {
  const enter = parseFloat(section.dataset.enter) / 100;
  const leave = parseFloat(section.dataset.leave) / 100;
  const midpoint = (enter + leave) / 2;
  const scrollH  = scrollCont.scrollHeight;

  // Center the section's midpoint at the scroll midpoint
  const topPx = midpoint * scrollH - window.innerHeight / 2;
  section.style.top = topPx + 'px';
}

function setupSectionAnimation(section) {
  const type    = section.dataset.animation;
  const persist = section.dataset.persist === 'true';
  const enter   = parseFloat(section.dataset.enter) / 100;
  const leave   = parseFloat(section.dataset.leave) / 100;

  const children = section.querySelectorAll(
    '.section-label, .section-heading, .section-body, .section-note, ' +
    '.cta-button, .cta-heading, .cta-body, .cta-price, .stat'
  );

  const tl = gsap.timeline({ paused: true });

  switch (type) {
    case 'fade-up':
      tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-left':
      tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-right':
      tl.from(children, { x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'scale-up':
      tl.from(children, { scale: 0.88, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
      break;
    case 'rotate-in':
      tl.from(children, { y: 40, rotation: 3, opacity: 0, stagger: 0.10, duration: 0.9, ease: 'power3.out' });
      break;
    case 'stagger-up':
      tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });
      break;
    case 'clip-reveal':
      tl.from(children, { clipPath: 'inset(100% 0 0 0)', opacity: 0, stagger: 0.15, duration: 1.2, ease: 'power4.inOut' });
      break;
  }

  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: false,
    onUpdate(self) {
      const p = self.progress;
      const fadeRange = 0.03;

      let sectionOpacity;
      if (p < enter - fadeRange) {
        sectionOpacity = 0;
        if (tl.progress() > 0) tl.reverse();
      } else if (p >= enter - fadeRange && p <= enter) {
        const t = (p - (enter - fadeRange)) / fadeRange;
        sectionOpacity = t;
        if (t > 0.5 && tl.progress() === 0) tl.play();
      } else if (p > enter && p < leave) {
        sectionOpacity = 1;
        if (tl.progress() < 1) tl.play();
      } else if (!persist && p >= leave && p <= leave + fadeRange) {
        const t = 1 - (p - leave) / fadeRange;
        sectionOpacity = t;
      } else if (!persist && p > leave + fadeRange) {
        sectionOpacity = 0;
      } else {
        // persist = true past leave: stay visible
        sectionOpacity = 1;
      }

      section.style.opacity = Math.max(0, Math.min(1, sectionOpacity));
    }
  });
}

function initSections() {
  const sections = document.querySelectorAll('.scroll-section');
  sections.forEach(s => {
    positionSection(s);
    setupSectionAnimation(s);
  });
}

// ── Horizontal marquee ────────────────────────────────────────────────────────
function initMarquee() {
  const speed = parseFloat(marqueeWrap.dataset.scrollSpeed) || -25;
  const text  = marqueeWrap.querySelector('.marquee-text');

  gsap.to(text, {
    xPercent: speed,
    ease: 'none',
    scrollTrigger: {
      trigger: scrollCont,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    }
  });

  // Marquee visible from 18%–72% scroll
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      const fadeIn  = 0.18;
      const fadeOut = 0.72;
      const fadeRange = 0.04;
      let op = 0;

      if (p >= fadeIn && p <= fadeIn + fadeRange) {
        op = (p - fadeIn) / fadeRange;
      } else if (p > fadeIn + fadeRange && p < fadeOut) {
        op = 1;
      } else if (p >= fadeOut && p <= fadeOut + fadeRange) {
        op = 1 - (p - fadeOut) / fadeRange;
      }

      marqueeWrap.style.opacity = Math.max(0, Math.min(1, op));
    }
  });
}

// ── Dark overlay for stats section ───────────────────────────────────────────
function initDarkOverlay(enterPct, leavePct) {
  const fadeRange = 0.04;

  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress;
      let op = 0;

      if (p >= enterPct - fadeRange && p <= enterPct) {
        op = (p - (enterPct - fadeRange)) / fadeRange;
      } else if (p > enterPct && p < leavePct) {
        op = 0.92;
      } else if (p >= leavePct && p <= leavePct + fadeRange) {
        op = 0.92 * (1 - (p - leavePct) / fadeRange);
      }

      overlay.style.opacity = Math.max(0, Math.min(0.92, op));
    }
  });
}

// ── Counter animations ────────────────────────────────────────────────────────
function initCounters() {
  const statNums = document.querySelectorAll('.stat-number');
  let counted = false;

  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      const p = self.progress;

      if (p >= 0.60 && !counted) {
        counted = true;
        statNums.forEach(el => {
          const target   = parseFloat(el.dataset.value);
          const decimals = parseInt(el.dataset.decimals || '0');
          const obj      = { val: 0 };

          gsap.to(obj, {
            val: target,
            duration: 2.2,
            ease: 'power2.out',
            onUpdate() {
              el.textContent = decimals > 0
                ? obj.val.toFixed(decimals)
                : Math.round(obj.val).toLocaleString();
            }
          });
        });
      } else if (p < 0.57 && counted) {
        counted = false;
        statNums.forEach(el => { el.textContent = '0'; });
      }
    }
  });
}

// ── Resize handling ───────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  resizeCanvas();
  // Reposition sections on resize
  document.querySelectorAll('.scroll-section').forEach(positionSection);
  ScrollTrigger.refresh();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
resizeCanvas();
preloadFrames();
