/* ═══════════════════════════════════════════
   HOPE GIVING MINISTRY — main.js
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── NAV SCROLL ──
  const nav = document.getElementById('main-nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── HAMBURGER / MOBILE NAV ──
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  let menuOpen = false;

  const toggleMenu = (open) => {
    menuOpen = open;
    hamburger?.classList.toggle('open', open);
    mobileNav?.classList.toggle('open', open);
    hamburger?.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  hamburger?.addEventListener('click', () => toggleMenu(!menuOpen));

  mobileNav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  document.querySelectorAll('.mobile-dropdown-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      const sub = btn.nextElementSibling;
      sub?.classList.toggle('open', open);
      sub?.setAttribute('aria-hidden', String(!open));
    });
  });

  document.querySelectorAll('.nav-dropdown-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = btn.closest('.nav-dropdown');
      if (!item) return;
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.nav-dropdown.open').forEach(el => el.classList.remove('open'));
      document.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
      item.classList.toggle('open', !wasOpen);
      btn.setAttribute('aria-expanded', String(!wasOpen));
      e.preventDefault();
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown')) {
      document.querySelectorAll('.nav-dropdown.open').forEach(el => el.classList.remove('open'));
      document.querySelectorAll('.nav-dropdown-toggle').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) {
      toggleMenu(false);
      hamburger?.focus();
    }
  });

  // ── ACTIVE NAV LINK ──
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
    const href = link.getAttribute('href')?.split('/').pop();
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Show the nav Live pill only for 12 hours after an admin stream URL update.
  const getLiveState = () => {
    try {
      const state = JSON.parse(localStorage.getItem('hgmLiveStream') || '{}');
      const updatedAt = Number(state.updatedAt || 0);
      return Boolean(state.url && Date.now() - updatedAt < 12 * 60 * 60 * 1000);
    } catch {
      return false;
    }
  };

  document.querySelectorAll('.nav-links a').forEach(link => {
    if (!link.querySelector('.live-badge')) return;
    const item = link.closest('li');
    if (item) item.style.display = getLiveState() ? '' : 'none';
  });

  // Native share where available, clipboard fallback everywhere else.
  document.querySelectorAll('[data-share-page], #share-stream-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const title = document.title || 'Hope Giving Ministry';
      const url = window.location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title, url });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          btn.dataset.originalHtml ||= btn.innerHTML;
          btn.textContent = 'Link Copied';
          setTimeout(() => { btn.innerHTML = btn.dataset.originalHtml; }, 1800);
        }
      } catch {
        // User cancelled the native share sheet.
      }
    });
  });

  // ── SCROLL REVEAL ──
  const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  // ── HERO CANVAS PARTICLES ──
  const canvas = document.getElementById('hero-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W, H;
    const PARTICLE_COUNT = 70;
    const particles = [];

    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    class Particle {
      constructor() { this.reset(true); }
      reset(init) {
        this.x = Math.random() * W;
        this.y = init ? Math.random() * H : H + 10;
        this.size = Math.random() * 1.4 + 0.3;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = -(Math.random() * 0.4 + 0.1);
        this.opacity = Math.random() * 0.5 + 0.08;
        this.gold = Math.random() > 0.65;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.y < -10 || this.x < -10 || this.x > W + 10) this.reset(false);
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.gold
          ? `rgba(201,168,76,${this.opacity})`
          : `rgba(255,255,255,${this.opacity * 0.45})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    const drawBg = () => {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, W * 0.7);
      g.addColorStop(0, 'rgba(27,75,158,0.22)');
      g.addColorStop(1, 'rgba(11,31,58,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };

    const drawRays = () => {
      const cx = W * 0.5, cy = -H * 0.05;
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI / 7) * i + Math.PI * 0.14;
        const len = H * 1.5;
        const spread = 0.022;
        ctx.save();
        ctx.globalAlpha = 0.016 + Math.sin(Date.now() * 0.0004 + i) * 0.007;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle - spread) * len, cy + Math.sin(angle - spread) * len);
        ctx.lineTo(cx + Math.cos(angle + spread) * len, cy + Math.sin(angle + spread) * len);
        ctx.closePath();
        ctx.fillStyle = 'rgba(201,168,76,1)';
        ctx.fill();
        ctx.restore();
      }
    };

    let raf;
    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      drawBg(); drawRays();
      particles.forEach(p => { p.update(); p.draw(); });
      raf = requestAnimationFrame(animate);
    };
    animate();

    // Pause when hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else animate();
    });
  }

  // ── GIVING AMOUNT SELECTOR ──
  document.querySelectorAll('.give-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.giving-options')?.querySelectorAll('.give-amount').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── FILTER TABS ──
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bar = btn.closest('.filter-bar') || btn.closest('.filter-group');
      bar?.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active', 'btn-royal');
        b.classList.add('btn-outline-dark');
      });
      btn.classList.remove('btn-outline-dark');
      btn.classList.add('active', 'btn-royal');
      const filter = btn.dataset.filter;
      const container = document.querySelector(btn.dataset.target || '#gallery-masonry');
      if (container && filter) {
        container.querySelectorAll('.gallery-item, .sermon-card').forEach(item => {
          const show = filter === 'all' || item.dataset.category === filter || item.dataset.series === filter;
          item.style.display = show ? '' : 'none';
        });
      }
    });
  });

  // Sermon video modal.
  const videoModal = document.getElementById('videoModal');
  const videoFrame = document.getElementById('videoModalFrame');
  if (videoModal && videoFrame) {
    const closeVideo = () => {
      videoModal.classList.remove('open');
      videoFrame.src = '';
      document.body.style.overflow = '';
    };

    document.querySelectorAll('[data-video]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-share-page]')) return;
        videoFrame.src = card.dataset.video;
        videoFrame.title = card.dataset.title || 'Sermon video';
        videoModal.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });

    videoModal.querySelector('.video-modal-close')?.addEventListener('click', closeVideo);
    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) closeVideo();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && videoModal.classList.contains('open')) closeVideo();
    });
  }

  // ── ACCORDION ──
  document.querySelectorAll('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion-item');
      const panel = item?.querySelector('.accordion-panel');
      const isOpen = item?.classList.contains('open');
      trigger.closest('.accordion')?.querySelectorAll('.accordion-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.accordion-panel').style.maxHeight = '0';
      });
      if (!isOpen && panel) {
        item.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  // ── GALLERY LIGHTBOX ──
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  let lightboxCaptionTitle = null;
  let lightboxCaptionTag = null;
  let galleryItems = [];
  let currentIndex = 0;

  function updateLightboxCaption(item) {
    if (lightboxCaptionTitle) lightboxCaptionTitle.textContent = item.dataset.title || '';
    if (lightboxCaptionTag) lightboxCaptionTag.textContent = item.dataset.tag || '';
  }

  function openLightbox(index) {
    galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
    currentIndex = index;
    const item = galleryItems[currentIndex];
    const img = item.querySelector('img');
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    updateLightboxCaption(item);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function navigateLightbox(dir) {
    galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
    currentIndex = (currentIndex + dir + galleryItems.length) % galleryItems.length;
    const item = galleryItems[currentIndex];
    const img = item.querySelector('img');
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    updateLightboxCaption(item);
  }

  if (lightbox && lightboxImg) {
    lightboxCaptionTitle = lightbox.querySelector('.lightbox-caption-title');
    lightboxCaptionTag = lightbox.querySelector('.lightbox-caption-tag');

    document.querySelectorAll('.gallery-item').forEach((item, idx) => {
      item.addEventListener('click', () => openLightbox(idx));
    });

    const closeBtn = lightbox.querySelector('.lightbox-close');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });

    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(-1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(1); });
  }

  // ── COUNTDOWN TIMER ──
  const countdowns = document.querySelectorAll('[data-countdown]');
  countdowns.forEach(el => {
    const target = new Date(el.dataset.countdown);
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) { el.textContent = 'Event Started'; return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.querySelector('[data-d]').textContent = String(d).padStart(2,'0');
      el.querySelector('[data-h]').textContent = String(h).padStart(2,'0');
      el.querySelector('[data-m]').textContent = String(m).padStart(2,'0');
      el.querySelector('[data-s]').textContent = String(s).padStart(2,'0');
    };
    update();
    setInterval(update, 1000);
  });

});
