/* =========================================================
   MacDoo — interações da landing page
   ========================================================= */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Horário de funcionamento (fuso de Americana-SP) ---------- */
  // Minutos desde 00:00. Chave = dia da semana (0 = domingo).
  const HOURS = {
    0: [18 * 60, 22 * 60 + 30],
    3: [18 * 60, 23 * 60],
    4: [18 * 60, 23 * 60],
    5: [18 * 60, 23 * 60 + 30],
    6: [18 * 60, 23 * 60 + 30],
  };
  const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  const fmt = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  };

  function nowInSaoPaulo() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return { day: WEEKDAY_INDEX[get('weekday')], minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  }

  function getStatus() {
    const { day, minutes } = nowInSaoPaulo();
    const today = HOURS[day];

    if (today && minutes >= today[0] && minutes < today[1]) {
      return { state: 'open', text: `Aberto agora · fecha às ${fmt(today[1])}`, day };
    }
    if (today && minutes < today[0]) {
      const soon = today[0] - minutes <= 90;
      return { state: soon ? 'soon' : 'closed', text: `Abre hoje às ${fmt(today[0])}`, day };
    }
    for (let i = 1; i <= 7; i++) {
      const next = (day + i) % 7;
      if (HOURS[next]) {
        const label = i === 1 ? 'amanhã' : DAY_NAMES[next];
        return { state: 'closed', text: `Fechado · abre ${label} às ${fmt(HOURS[next][0])}`, day };
      }
    }
    return { state: 'closed', text: 'Fechado', day };
  }

  function renderStatus() {
    const status = getStatus();
    document.querySelectorAll('[data-status]').forEach((el) => {
      el.classList.toggle('is-open', status.state === 'open');
      el.classList.toggle('is-soon', status.state === 'soon');
      const text = el.querySelector('[data-status-text]');
      if (text) text.textContent = status.text;
    });
    document.querySelectorAll('.hours tr[data-day]').forEach((row) => {
      row.classList.toggle('is-today', Number(row.dataset.day) === status.day);
    });
  }

  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  /* ---------- Header e barra fixa mobile ---------- */
  const header = document.querySelector('[data-header]');
  const dock = document.querySelector('.dock');
  const hero = document.querySelector('.hero');

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 30);
    if (dock && hero) dock.classList.toggle('is-visible', y > hero.offsetHeight * 0.55);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Revelar ao rolar (com escalonamento entre irmãos) ---------- */
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    const index = siblings.indexOf(el);
    if (index > 0) el.style.setProperty('--d', `${Math.min(index * 0.09, 0.45)}s`);
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Vídeo do hero: pausa fora da tela ---------- */
  const video = document.querySelector('[data-hero-video]');
  if (video) {
    if (reduceMotion) {
      video.removeAttribute('autoplay');
      video.pause();
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }).observe(video);
    }
  }

  /* ---------- Brasas subindo no hero ---------- */
  const canvas = document.querySelector('[data-embers]');
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, embers = [], running = false, raf = 0;

    const spawn = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: Math.random() * 1.8 + 0.6,
      vy: -(Math.random() * 0.9 + 0.35),
      vx: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      hue: 18 + Math.random() * 30,
      life: 1,
      decay: Math.random() * 0.0025 + 0.0015,
    });

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 700 ? 34 : 70;
      embers = Array.from({ length: count }, () => spawn(true));
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.phase += 0.02;
        e.x += e.vx + Math.sin(e.phase) * 0.35;
        e.y += e.vy;
        e.life -= e.decay;
        if (e.y < -10 || e.life <= 0) { embers[i] = spawn(false); continue; }

        const alpha = Math.max(e.life, 0) * (0.55 + Math.sin(e.phase * 3) * 0.25);
        ctx.fillStyle = `hsla(${e.hue}, 100%, 55%, ${alpha * 0.18})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `hsla(${e.hue + 15}, 100%, 70%, ${alpha})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    window.addEventListener('resize', resize);
    let inView = true;
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      inView ? start() : stop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden || !inView ? stop() : start()));
  }

  /* ---------- Ano no rodapé ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
