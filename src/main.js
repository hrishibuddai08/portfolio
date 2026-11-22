import '@fontsource/bebas-neue/400.css';
import '@fontsource/manrope/400.css';
import '@fontsource/caveat/700.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { mountAllTorn } from './torn.js';
import { initGL, makeRobot, makeCoin } from './webgl.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (reduce) document.documentElement.classList.add('reduce');
document.documentElement.classList.add('intro');

const RED = '#d4143a', INK = '#121214', PAPER = '#f6f3ee';
const DIM = 'rgba(18,18,20,.14)';

/* ───────── film grain ───────── */
(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const x = c.getContext('2d');
  const img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 130;
  }
  x.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
})();

/* ───────── torn paper ───────── */
mountAllTorn();

/* ───────── real-time smooth scroll ───────── */
const lenis = new Lenis({ lerp: reduce ? 1 : 0.09, wheelMultiplier: 0.95 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) { e.preventDefault(); return; }
  const target = id === '#top' ? 0 : $(id);
  if (target === null) return;
  e.preventDefault();
  lenis.scrollTo(target, { duration: 2.2, easing: t => 1 - Math.pow(1 - t, 4) });
});

/* ───────── real-time 3D ───────── */
const popQueue = [];
const gl = initGL($('#gl'), [
  { name: 'hero', el: $('[data-anchor="hero"]'), make: makeRobot, scale: 1.12, fixed: true },
  { name: 'buddy', el: $('#buddy'), make: makeRobot, scale: 1.12, fixed: true },
  { name: 'orbit', el: $('[data-anchor="orbit"]'), make: () => makeCoin('burst'), speed: 0.55, startY: 0.6, baseX: 0.1 },
  { name: 'compass', el: $('[data-anchor="compass"]'), make: () => makeCoin('compass'), speed: 0.4, startY: -0.4, baseX: -0.1 }
]);
if (gl) {
  gsap.ticker.add(() => { gl.setScrollVel(lenis.velocity || 0); gl.frame(); });
  popQueue.push(['compass', '[data-anchor="compass"]', 'top 88%']);
} else {
  document.documentElement.classList.add('no-gl');
  $('#gl').remove();
}
const item = n => gl?.byName[n] ?? {};
// the robot's greeting: the speech bubble pops in and out with its wave
if (gl) {
  const bot = item('hero').obj.userData;
  lenis.on('scroll', ({ scroll }) => {
    bot.noWave = scroll > innerHeight * 0.4;
    if (scroll > innerHeight * 0.12) gsap.to('#hi', { opacity: 0, duration: 0.2, overwrite: 'auto' });
  });
  bot.onHi = on => gsap.to('#hi', { opacity: on ? 1 : 0, scale: on ? 1 : 0.6, y: on ? 0 : 12, duration: on ? 0.5 : 0.35, ease: on ? 'back.out(2.2)' : 'power2.in', overwrite: 'auto' });
  gsap.set('#hi', { xPercent: -50 });
  const greet = () => { if (scrollY < innerHeight * 0.4) bot.wave?.(); };
  gsap.delayedCall(3.3, greet);                  // right after the paper opens
  setInterval(greet, 11000);                     // and now and then
}

/* ── the companion: the same little face follows you down the page ── */
const buddyBubble = $('#buddyBubble');
const buddyTone = () => {};
function say(text, ms = 3800) {
  buddyBubble.textContent = text;
  gsap.killTweensOf(buddyBubble);
  gsap.to(buddyBubble, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(2)' });
  gsap.to(buddyBubble, { opacity: 0, scale: 0.7, y: 10, duration: 0.3, ease: 'power2.in', delay: ms / 1000 });
}
const buddyLines = {
  '#capabilities': ['Six ways I can help ✺', false],
  '#principles': ['Targets, not promises — I like being honest.', false],
  '#process': ['Five stops. I’ll keep you posted.', false],
  '#studio': ['One developer. That’s me!', false],
  '#contact': ['Say hi — I reply to everyone 👋', false]
};
if (import.meta.env.DEV) window.__gl = gl;

/* ───────── intro words ───────── */
const intro = $('#introText');
intro.innerHTML = intro.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');

/* ───────── the paper opens, completely ───────── */
function openPaper() {
  const tl = gsap.timeline({
    onComplete: () => { $('#pre').remove(); document.documentElement.classList.remove('intro'); lenis.start(); ScrollTrigger.refresh(); if (gl) item('hero').obj.userData.noWave = false; }
  });
  const P = '.pre__sheet--paper';
  tl.to(`${P}.pre__sheet--top`, { yPercent: -122, rotate: -2.2, duration: 1.6, ease: 'power4.inOut' }, 0)
    .to(`${P}.pre__sheet--bot`, { yPercent: 122, rotate: 2.2, duration: 1.6, ease: 'power4.inOut' }, 0)
    .from('.hl', { yPercent: 90, opacity: 0, stagger: 0.1, duration: 1.2, ease: 'power4.out' }, 0.95)
    .from('.topbar span, .hero__label, .hero__bottom > *', { opacity: 0, y: 18, stagger: 0.06, duration: 0.9, ease: 'power3.out' }, 1.15);
  tl.to('.pre__cap', { opacity: 0, duration: 0.4 }, 0);
  if (gl) {                                                          // the robot glides from centre-stage to its place in the headline
    const H = item('hero');
    if (H.reveal < 1) tl.to(H, { reveal: 1, duration: 1.2, ease: 'elastic.out(1,.55)' }, 0.5);
    tl.to(H, { ox: 0, oy: 0, os: 1, duration: 1.7, ease: 'power4.inOut' }, 0.05);
  }
}

// opening screen: the robot is already here — face dark, then it powers on and says hi, then the paper tears open
function runIntro() {
  if (!gl || reduce) { if (gl) item('hero').reveal = 1; openPaper(); return; }
  const H = item('hero'), bot = H.obj.userData, r = $('#heroAnchor').getBoundingClientRect();
  H.ox = innerWidth / 2 - (r.left + r.width / 2); H.oy = innerHeight / 2 - (r.top + r.height / 2); H.os = innerWidth < 900 ? 1.35 : 1.8;
  bot.noWave = true; bot.setBoot(-1);
  const b = { p: 0 };
  gsap.timeline()
    .to(H, { reveal: 1, duration: 1.1, ease: 'elastic.out(1,.6)' }, 0.15)
    .to(b, { p: 1, duration: 1.0, ease: 'power1.inOut', onUpdate: () => bot.setBoot(b.p), onComplete: () => bot.setBoot(null) }, 1.15)
    .add(() => bot.setWord('Hi!'), 2.45)
    .add(() => bot.setWord(null), 3.9)
    .add(openPaper, 3.95);
}

(document.fonts?.ready ?? Promise.resolve()).then(() => {
  ScrollTrigger.refresh();
  requestAnimationFrame(() => { document.documentElement.classList.add('ready'); gsap.delayedCall(0.15, runIntro); });
});

/* ───────── chrome: progress + nav ───────── */
const progress = $('#progress');
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => (progress.style.transform = `scaleX(${s.progress})`) });
const nav = $('#nav');
lenis.on('scroll', ({ scroll }) => nav.classList.toggle('is-on', scroll > 140));

/* ═════════ SCENE: hero → intro → tunnel as one continuous zoom ═════════ */
const WORDS = ['WEB', 'DESIGN', 'BUILD', 'SHIP'];
const words = $$('.tz__word'), tzCaps = $$('.tz__cap'), tzCount = $('#tzCount');
// the robot sits in the gap between "I BUILD" and "DIGITAL PRODUCTS" — measured, so it holds on any screen
const placeHero = () => {
  const g = $('#heroGap').getBoundingClientRect(), s = $('#scene').getBoundingClientRect();
  const a = $('#heroAnchor');
  a.style.left = (g.left + g.width / 2 - s.left) + 'px';
  a.style.top = (g.top + g.height / 2 - s.top + innerHeight * 0.012) + 'px';
};
placeHero();
ScrollTrigger.addEventListener('refreshInit', placeHero);
(document.fonts?.ready ?? Promise.resolve()).then(placeHero);
const mm = gsap.matchMedia();
mm.add({ mob: '(max-width: 900px)', ok: '(prefers-reduced-motion: no-preference)' }, ctx => {
  if (!ctx.conditions.ok) return;
  const mob = ctx.conditions.mob;
  const scene = $('#scene'), heroA = $('#heroAnchor'), orbitA = $('[data-anchor="orbit"]');
  gsap.set([heroA, orbitA], { xPercent: -50, yPercent: -50 });
  const iw = $$('.w', intro);
  const STEP = 1.5, T0 = 4.3;
  const bigScale = () => {
    const head = Math.min(innerWidth * (mob ? 0.8 : 0.66), innerHeight * (mob ? 0.46 : 0.74) * 1.31);
    return (head / 1.52) * 2 / 1.12 / heroA.offsetWidth;
  };                               // tunnel starts at T0

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: scene, start: 'top top', end: '+=820%',
      onLeave: () => { if (gl) { item('hero').reveal = 0; item('buddy').reveal = 1; buddyTone(); } },
      onEnterBack: () => { if (gl) { item('buddy').reveal = 0; item('hero').reveal = 1; } }, scrub: 0.7, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: () => tick()
    },
    onUpdate: () => tick()                                  // timeline-driven, so the screen follows the eased playhead exactly
  });
  function tick() {
        const i = clamp(Math.floor((tl.time() - T0 + 0.35) / STEP), 0, words.length - 1);
        tzCount.textContent = `0${i + 1} / 0${words.length}`;
        const tt = tl.time(), u = (tt - T0 + 0.1) / STEP, k = Math.floor(u), f = u - k;
        const sm = v => v * v * (3 - 2 * v);
        const p = clamp(k + sm(clamp((f - 0.5) / 0.5)), 0, words.length - 1);     // hold on a word, then roll smoothly to the next
        const on = tt > 3.9 && tt < T0 + words.length * STEP - 0.25;
        if (gl) item('hero').obj.userData.setWord?.(on ? p : null);
  }

  // 1 · hero zooms in, the 3D monogram slides aside
  tl.to('#heroBottom', { opacity: 0, y: 60, duration: 0.4 }, 0)
    .to('.topbar', { opacity: 0, duration: 0.3 }, 0)
    .to('#heroStage', { scale: 3.4, opacity: 0, transformOrigin: '50% 50%', ease: 'power2.in', duration: 1.15 }, 0)
    .to(heroA, mob
      ? { x: 0, y: () => innerHeight * 0.18 - heroA.offsetTop, scale: 0.82, ease: 'power2.inOut', duration: 1.2 }
      : { x: () => innerWidth * 0.28, y: () => innerHeight * 0.5 - heroA.offsetTop, scale: 0.85, ease: 'power2.inOut', duration: 1.2 }, 0.05);

  // 2 · intro arrives and "reads" itself
  tl.fromTo('#L2', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, ease: 'power2.out', duration: 0.9 }, 0.6)
    .fromTo(iw, { color: DIM }, { color: INK, duration: 0.3, stagger: 2.0 / iw.length }, 1.1);
  if (gl) tl.to(item('orbit'), { reveal: 1, ease: 'back.out(2)', duration: 0.8 }, 1.2);

  // 3 · zoom THROUGH the intro into the crimson tunnel
  tl.to('#L2', { scale: 9, opacity: 0, transformOrigin: '28% 50%', ease: 'power3.in', duration: 1.0 }, 3.55)
    .to(scene, { backgroundColor: RED, duration: 0.7 }, 3.75)
    .to(heroA, { x: 0, y: () => innerHeight * 0.5 - heroA.offsetTop, scale: () => bigScale(), ease: 'power3.inOut', duration: 1.1 }, 3.55)
    .to(['.tz__rings', '.tz__label', '.tz__count'], { opacity: 1, duration: 0.5 }, 4.0);
  if (gl) {
    tl.to(item('orbit'), { reveal: 0, duration: 0.4 }, 3.55)
      ;
  }

  // 4 · WEB → DESIGN → BUILD → SHIP, each one rushing past the camera
  words.forEach((w, i) => {
    const t = T0 + i * STEP;
    tl.fromTo(tzCaps[i], { opacity: 0, y: 26 }, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.3 }, t + 0.25)
      .to(tzCaps[i], { opacity: 0, y: -26, ease: 'power2.in', duration: 0.3 }, t + 1.05);
  });
  const Tend = T0 + words.length * STEP - 0.3;
  tl.to(heroA, {
    x: () => { const b = $('#buddy').getBoundingClientRect(); return b.left + b.width / 2 - parseFloat(heroA.style.left); },
    y: () => { const b = $('#buddy').getBoundingClientRect(); return b.top + b.height / 2 - parseFloat(heroA.style.top); },
    scale: () => $('#buddy').getBoundingClientRect().width / heroA.offsetWidth,
    ease: 'power3.inOut', duration: 1.0
  }, Tend);
  tl.to('.tz__rings', { scale: 3.6, duration: words.length * STEP + 0.4 }, T0 - 0.3);
});

/* ═════════ CAPABILITIES: cards fold back and the next one zooms in ═════════ */
const caps = $$('.cap');
caps.forEach((c, i) => {
  if (!reduce && i < caps.length - 1) {
    gsap.fromTo(c, { rotateX: 0, scale: 1, filter: 'brightness(1)' }, {
      rotateX: -22, scale: 0.9, filter: 'brightness(0.8)', transformOrigin: '50% 0%', ease: 'none',
      scrollTrigger: { trigger: caps[i + 1], start: 'top 86%', end: 'top 14%', scrub: true }
    });
  }
  const trig = { trigger: c, start: 'top 96%', end: 'top 32%', scrub: true };
  gsap.fromTo($('.cap__art', c), { scale: 0.45, rotate: -20, opacity: 0.15 }, { scale: 1, rotate: 0, opacity: 1, ease: 'none', scrollTrigger: trig });
  gsap.from($('.cap__num', c), { scale: 1.7, transformOrigin: '0% 0%', ease: 'none', scrollTrigger: trig });
  gsap.from($('.cap__body h3', c), { xPercent: -12, opacity: 0, ease: 'none', scrollTrigger: trig });
});

// self-drawing line icons, floating idle motion, pointer parallax + glare, progress HUD
const capCount = $('#capCount'), capDots = $$('.caps__dots i');
caps.forEach((c, i) => {
  const art = $('.cap__art', c), shapes = $$('.cap__art > *', c);
  shapes.forEach(el => { el.setAttribute('pathLength', '1'); el.style.strokeDasharray = '1'; el.style.strokeDashoffset = reduce ? '0' : '1'; });
  if (!reduce) {
    gsap.to(shapes, { strokeDashoffset: 0, stagger: 0.14, ease: 'none', scrollTrigger: { trigger: c, start: 'top 92%', end: 'top 20%', scrub: true } });
    gsap.to(art, { y: -14, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.3 });
  }
  if (finePointer && !reduce) {
    const ax = gsap.quickTo(art, 'x', { duration: 0.6, ease: 'power3' });
    const nx = gsap.quickTo($('.cap__num', c), 'x', { duration: 0.6, ease: 'power3' });
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', (px * 100) + '%'); c.style.setProperty('--my', (py * 100) + '%'); c.style.setProperty('--gl', 1);
      ax((px - 0.5) * 46); nx(-(px - 0.5) * 22);
    });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--gl', 0); ax(0); nx(0); });
  }
  ScrollTrigger.create({
    trigger: c, start: 'top 58%', end: 'bottom 58%',
    onToggle: s => {
      if (!s.isActive) return;
      capCount.textContent = '0' + (i + 1) + ' / 0' + caps.length;
      capDots.forEach((d, k) => d.classList.toggle('on', k === i));
    }
  });
});

/* ═════════ PRINCIPLES: pinned horizontal parallax ═════════ */
const stats = $('#principles'), rowA = $('.st__row--a .st__track'), rowB = $('#stCards'), rowC = $('.st__row--c .st__track');
const statEls = $$('.stat', rowB), counted = new Set();
const countUp = el => {
  const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), o = { v: 0 };
  gsap.to(o, { v: end, duration: reduce ? 0.01 : 1.6, ease: 'power2.out', onUpdate: () => (el.textContent = o.v.toFixed(dec)) });
};
const tiltStats = () => {
  const vw = innerWidth;
  statEls.forEach((s, i) => {
    const r = s.getBoundingClientRect();
    const d = (r.left + r.width / 2 - vw / 2) / vw;
    gsap.set(s, { transformPerspective: 1000, rotateY: -d * 30, z: -Math.abs(d) * 160, opacity: 1 - clamp(Math.abs(d) - 0.35, 0, 1) * 0.55 });
    if (!counted.has(i) && r.left + r.width * 0.3 < vw * 0.9) { counted.add(i); countUp($('[data-count]', s)); }
  });
};
if (!reduce) {
  const distB = () => rowB.scrollWidth - innerWidth;
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stats, start: 'top top', end: () => '+=' + (distB() * 1.1 + innerHeight * 0.6), pin: true, scrub: 0.6,
      invalidateOnRefresh: true, onUpdate: tiltStats, onRefresh: tiltStats
    }
  })
    .fromTo(rowA, { x: 0 }, { x: () => -rowA.scrollWidth * 0.5 }, 0)           // outline words drift left (slow)
    .fromTo(rowB, { x: () => innerWidth * 0.1 }, { x: () => -distB() }, 0)       // stats travel left (main)
    .fromTo(rowC, { x: () => -rowC.scrollWidth * 0.5 }, { x: 0 }, 0);            // bottom words drift right (counter)
} else {
  statEls.forEach((s, i) => { counted.add(i); countUp($('[data-count]', s)); });
}

/* ═════════ WORK: live previews, tap to open the original ═════════ */
const projects = [
  { t: 'HOPSTAY', host: 'hopstay.co.in', url: 'https://hopstay.co.in', live: true, tags: ['Booking platform', 'Product engineering'],
    d: 'One clear booking system — a reservation product replacing fragmented booking and admin workflows.' },
  { t: 'GMR INFRA', host: 'abhtechsolutions.com/work/gmr-infra', url: 'https://www.abhtechsolutions.com/work/gmr-infra', img: 'https://www.abhtechsolutions.com/images/abhi-portfolio-gmrinfra-img.png',
    tags: ['Corporate web platform', 'Web application'], d: 'Clarity, confidence, credibility — a responsive digital presence that communicates the business properly.' },
  { t: 'OYE', host: 'oye-nine.vercel.app', url: 'https://oye-nine.vercel.app', live: true, tags: ['E-commerce', 'Brand + build'],
    d: 'Own Your Edge — designed and built end to end: brand, visual language, interface and deployment.' },
  { t: 'VSN CONSTRUCTIONS', host: 'vsnconstructions.com', url: 'https://www.vsnconstructions.com', tags: ['Construction', 'Next.js'],
    d: "A general contractor's website with a drag-to-rotate 3D structural model, an operating-model diagram and a project enquiry flow." },
  { t: 'TELA', host: 'tela.co.in', url: 'https://tela.co.in', tags: ['E-commerce', 'Shopify · custom theme'],
    d: "A men's shirt storefront built around the cloth — fabric weight and origin on every product page." }
];
const shot = u => `https://image.thum.io/get/png/wait/6/width/1280/crop/800/${u}`;
const canEmbed = !matchMedia('(max-width: 900px)').matches && !navigator.connection?.saveData && (navigator.deviceMemory ?? 8) >= 4;

const N = projects.length;
let workActive = false;
const SAYS = [
  "This is Hopstay — hostels, PGs and co-living in Hyderabad with every rupee shown before you book. One system replacing scattered booking and admin work. It's live — tap the card!",
  "GMR Infra needed a site that feels as solid as the business. A responsive build for clarity, confidence and credibility. This one opens its case study.",
  "OYE means Own Your Edge. Brand, visual language, interface and deployment — designed and built end to end. Not a template, on purpose.",
  "VSN Constructions builds big. Their site has a 3D structural model you can drag to rotate, plus a diagram of how they run ten projects at once.",
  "Tela sells shirts cut by hand, in runs of 120 or fewer — so the store puts fabric weight and origin on every product page. Shopify, custom theme."
];
const SPEC = [
  ['Booking platform', 'Product engineering · hopstay.co.in'],
  ['Corporate web platform', 'Web application · opens the case study'],
  ['E-commerce', 'Brand + build · hosted on Vercel'],
  ['Construction', 'Next.js · drag-to-rotate 3D model'],
  ['E-commerce', 'Shopify · custom theme']
];
const NOTES = ["it's live — tap it!", 'opens the case study', "it's live — tap it!", 'try the 3D model!', 'fabric first'];
const THEMES = ['paper', 'red', 'cool', 'ink', 'blush'];
const DOT_COLORS = ['#d4143a', '#121214', '#ffffff', '#f08aa0', '#9e0f2c'];
const wkBands = $('#wkBands');
const dots = i => Array.from({ length: 9 }, (_, k) => {
  const s = 7 + ((k * 7 + i * 3) % 5) * 5;
  return `<i class="dot" style="left:${(k * 37 + i * 19) % 96}%;top:${(k * 53 + i * 29) % 92}%;width:${s}px;height:${s}px;background:${DOT_COLORS[(k + i) % DOT_COLORS.length]};animation-delay:${-(k * 0.7)}s"></i>`;
}).join('');
wkBands.innerHTML = projects.map((p, i) => `
  <article class="band band--${THEMES[i]} band--${i % 2 ? 'r' : 'l'}" data-i="${i}">
    <svg class="torn band__torn" data-torn="top" data-h="64" data-amp="22" data-seed="${90 + i}"></svg>
    <div class="band__dots" aria-hidden="true">${dots(i)}</div>
    <a class="polaroid" href="${p.url}" target="_blank" rel="noopener" data-cursor="VISIT" aria-label="Open ${p.t} — ${p.host} (new tab)">
      <div class="polaroid__frame">
        <span class="polaroid__tape" aria-hidden="true"></span>
        <div class="polaroid__view"></div>
        <div class="polaroid__cap">${p.host} ↗</div>
      </div>
    </a>
    <div class="band__mid" aria-hidden="true">
      <svg class="band__arrow" viewBox="0 0 230 120" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M214 14C150 -4 62 18 22 92"/><path d="M22 92l4-26M22 92l25-10"/></svg>
      <span class="band__note">${NOTES[i]}</span>
    </div>
    <div class="band__text">
      <div class="band__num">0${i + 1}.</div>
      <h3 class="band__title">${p.t}</h3>
      <p class="band__desc">${p.d}</p>
      <div class="band__spec"><b>${SPEC[i][0]}</b><span>${SPEC[i][1]}</span></div>
      <a class="band__go" href="${p.url}" target="_blank" rel="noopener" data-cursor="GO">GO!</a>
    </div>
  </article>`).join('');
mountAllTorn(wkBands);
const bandEls = $$('.band', wkBands);
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));

// each polaroid always has a cheap static capture; sites that allow embedding add a LIVE iframe on top, shown only on the card in view once scrolling is idle
function mountBand(i) {
  const view = $('.polaroid__view', bandEls[i]), p = projects[i];
  if (view.dataset.on) return;
  view.dataset.on = '1';
  const img = new Image();
  img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
  img.src = p.img || shot(p.url);
  view.appendChild(img);
  if (p.live && canEmbed) {
    const f = document.createElement('iframe');
    f.src = p.url; f.tabIndex = -1; f.title = `${p.t} live preview`;
    f.setAttribute('aria-hidden', 'true'); f.referrerPolicy = 'no-referrer';
    f.sandbox = 'allow-scripts allow-same-origin';
    f.style.visibility = 'hidden';
    f.addEventListener('load', () => { f._ready = true; });
    view.appendChild(f); bandEls[i]._live = f;
    const fit = () => (f.style.transform = `scale(${view.clientWidth / 1280})`);
    fit(); new ResizeObserver(fit).observe(view);
  }
}
const bio = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { mountBand(+e.target.dataset.i); bio.unobserve(e.target); }
}), { rootMargin: '150% 0px' });
bandEls.forEach(b => bio.observe(b));

// the robot explains each project, typed out letter by letter
const bBub = $('#buddyBubble');
let typer = null;
function explain(i) {
  if (!gl) return;
  const bot = item('buddy').obj.userData, txt = SAYS[i];
  typer?.kill();
  gsap.killTweensOf(bBub);
  bBub.classList.add('is-talk');
  bBub.textContent = '';
  gsap.to(bBub, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(2)' });
  bot.setGaze?.({ x: -0.5, y: -0.04 });
  bot.setTalk?.(true);
  bot.setTone?.(i === 3);                          // light body on the ink band
  const o = { n: 0 };
  typer = gsap.to(o, {
    n: txt.length, duration: reduce ? 0.01 : txt.length * 0.028, ease: 'none', delay: 0.35,
    onUpdate: () => { bBub.textContent = txt.slice(0, Math.round(o.n)); },
    onComplete: () => bot.setTalk?.(false)
  });
}

bandEls.forEach((b, i) => {
  ScrollTrigger.create({ trigger: b, start: 'top 55%', end: 'bottom 55%', onToggle: s => { if (s.isActive && workActive) explain(i); } });
  if (reduce) return;
  const pol = $('.polaroid', b), view = $('.polaroid__view', b), txt = $$('.band__text > *', b), arrow = $$('.band__arrow path', b);
  const rot = i % 2 ? 4.5 : -4.5;
  gsap.fromTo(pol, { y: 150, rotate: rot * 3.2, scale: 0.8 }, { y: 0, rotate: rot, scale: 1, ease: 'none', scrollTrigger: { trigger: b, start: 'top 92%', end: 'top 22%', scrub: true } });
  gsap.fromTo(view, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: b, start: 'top 92%', end: 'center 50%', scrub: true } });
  gsap.from(txt, { opacity: 0, y: 44, stagger: 0.08, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 62%' } });
  arrow.forEach(pth => { pth.setAttribute('pathLength', '1'); pth.style.strokeDasharray = '1'; pth.style.strokeDashoffset = '1'; });
  gsap.to(arrow, { strokeDashoffset: 0, stagger: 0.3, ease: 'none', scrollTrigger: { trigger: b, start: 'top 68%', end: 'top 30%', scrub: true } });
  gsap.from($('.band__note', b), { opacity: 0, rotate: i % 2 ? 12 : -12, scale: 0.6, duration: 0.7, ease: 'back.out(2)', scrollTrigger: { trigger: b, start: 'top 45%' } });
  $$('.dot', b).forEach((d, k) => gsap.fromTo(d, { y: 90 * ((k % 3) - 1) }, { y: -90 * ((k % 3) - 1), ease: 'none', scrollTrigger: { trigger: b, start: 'top bottom', end: 'bottom top', scrub: true } }));
});
if (!reduce) {
  let liveFor = -1;
  gsap.ticker.add(() => {                         // live iframe only on the card nearest the middle of the screen, and only when scrolling is idle
    if (Math.abs(lenis.velocity || 0) > 0.3) { if (liveFor !== -1) { bandEls.forEach(b => b._live && (b._live.style.visibility = 'hidden')); liveFor = -1; } return; }
    let best = -1, bd = 1e9;
    bandEls.forEach((b, i) => { const r = b.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4 && d < bd) { bd = d; best = i; } });
    if (best !== liveFor || (best >= 0 && bandEls[best]._live && bandEls[best]._live._ready && bandEls[best]._live.style.visibility !== 'visible')) {
      bandEls.forEach((b, i) => { if (b._live) b._live.style.visibility = (i === best && b._live._ready) ? 'visible' : 'hidden'; });
      liveFor = best;
    }
  });
}

/* tape marquee reacts to scroll speed */
const stripTrack = $('.strip__track');
if (stripTrack && !reduce) {
  const tw = gsap.to(stripTrack, { xPercent: -50, repeat: -1, duration: 26, ease: 'none' });
  stripTrack.style.animation = 'none';
  ScrollTrigger.create({
    trigger: '.strip', start: 'top bottom', end: 'bottom top',
    onUpdate: s => gsap.to(tw, { timeScale: 1 + Math.abs(s.getVelocity() / 400) * (s.direction > 0 ? 1 : -1), duration: 0.3, overwrite: true })
  });
  gsap.from('.strip__tape', { rotate: -9, ease: 'none', scrollTrigger: { trigger: '.strip', start: 'top bottom', end: 'center center', scrub: true } });
}

/* ═════════ PROCESS: a website builds itself as you scroll ═════════ */
{
  const build = $('#build'), bw = $('#bw'), wrap = $('#bwWrap'), view = $('#bwView');
  const steps = $$('.bs'), fill = $('#buildFill'), urlEl = $('#bwUrl');
  const URLS = ['yourbrand.com', 'yourbrand.com / sketch', 'yourbrand.com / wireframe', 'localhost:5173', 'https://yourbrand.com'];
  let stage = -1;

  // small celebration when the site goes live
  const burst = () => {
    const cols = ['#d4143a', '#121214', '#f08aa0', '#ffffff', '#9e0f2c'];
    for (let i = 0; i < 34; i++) {
      const d = document.createElement('i');
      d.className = 'confetti';
      d.style.background = cols[i % cols.length];
      view.appendChild(d);
      const an = Math.random() * Math.PI * 2, r = 80 + Math.random() * 220;
      gsap.fromTo(d, { x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 },
        { x: Math.cos(an) * r, y: Math.sin(an) * r * 0.7 + 60, scale: 0.6 + Math.random() * 1.1, rotate: Math.random() * 540 - 270,
          duration: 1.3 + Math.random() * 0.6, ease: 'power3.out', onComplete: () => d.remove() });
      gsap.to(d, { opacity: 0, duration: 0.5, delay: 1.1 + Math.random() * 0.4 });
    }
  };

  const setStage = i => {
    if (i === stage) return;
    const prev = stage; stage = i;
    bw.dataset.stage = i;
    urlEl.textContent = URLS[i];
    steps.forEach((el, k) => { el.classList.toggle('on', k === i); el.classList.toggle('done', k < i); });
    if (i === 4 && prev === 3 && !reduce) burst();
  };
  setStage(0);

  if (reduce) {
    setStage(4); steps.forEach(el => el.classList.add('on'));
    fill.style.transform = 'scaleY(1)';
  } else {
    const mob = () => matchMedia('(max-width: 900px)').matches;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: build, start: 'top top', end: '+=360%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: s => {
          setStage(Math.min(4, Math.floor(s.progress * 5 + 0.0001)));
          fill.style.transform = `scaleY(${s.progress})`;
        }
      }
    });
    tl.fromTo(wrap, { rotateY: () => (mob() ? 0 : -18), rotateX: 9, scale: 0.9, y: 40 }, { rotateY: () => (mob() ? 0 : 10), rotateX: -2, scale: 1, y: 0, transformPerspective: 1600 }, 0)
      .to('#bw', { boxShadow: '0 70px 120px -40px rgba(212,20,58,.45), 0 30px 60px -30px rgba(18,18,20,.5)' }, 0.8);

    // the page itself responds to the pointer: a soft glare + a few px of depth
    if (finePointer) {
      const mx = gsap.quickTo(view, '--gx', { duration: 0.5 }), my = gsap.quickTo(view, '--gy', { duration: 0.5 });
      wrap.addEventListener('pointermove', e => {
        const r = wrap.getBoundingClientRect();
        mx(((e.clientX - r.left) / r.width) * 100); my(((e.clientY - r.top) / r.height) * 100);
      });
    }
  }
}

/* ═════════ ABOUT / CONTACT ═════════ */
$$('.mask .rv').forEach(rv => gsap.from(rv, {
  yPercent: 115, duration: 1.15, ease: 'power4.out',
  scrollTrigger: { trigger: rv.parentElement, start: 'top 90%' }
}));
if (!reduce) {
  $$('.caps__head h2, .work__head h2, .journey__head h2').forEach(h => gsap.from(h, {
    scale: 1.35, transformOrigin: '0% 50%', ease: 'none',
    scrollTrigger: { trigger: h, start: 'top 98%', end: 'top 55%', scrub: true }
  }));
  gsap.from('.frame', { scale: 0.9, borderRadius: '70px', ease: 'none', scrollTrigger: { trigger: '.frame', start: 'top 98%', end: 'top 30%', scrub: true } });
  gsap.from('.about__vertical', { yPercent: 20, opacity: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: '.studio', start: 'top 60%' } });
  gsap.from('.tape--a', { xPercent: 40, ease: 'none', scrollTrigger: { trigger: '.studio', start: 'top 70%', end: 'center 55%', scrub: 1 } });
  gsap.from('.tape--b', { rotate: -92, xPercent: 30, ease: 'none', scrollTrigger: { trigger: '.studio', start: 'top 65%', end: 'center 50%', scrub: 1 } });
  gsap.from('.contact__title', { scale: 0.72, transformOrigin: '0% 50%', ease: 'none', scrollTrigger: { trigger: '.contact__title', start: 'top 98%', end: 'top 40%', scrub: true } });
}
gsap.from('.about__right', { opacity: 0, y: 30, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.about__words', start: 'center 80%' } });
gsap.from('.value, .quality li', { opacity: 0, y: 40, stagger: 0.1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.values', start: 'top 80%' } });
gsap.from('.details__item, .foot', { opacity: 0, y: 50, stagger: 0.08, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.contact__grid', start: 'top 82%' } });

/* ───────── cursor (mouse only) ───────── */
if (finePointer) {
  const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__ring span');
  gsap.set(cur, { opacity: 0 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', e => {
    gsap.set(cur, { opacity: 1 });
    gsap.set(dot, { x: e.clientX, y: e.clientY });
    rx(e.clientX); ry(e.clientY);
  });
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-cursor]');
    cur.classList.toggle('is-hover', !!t);
    if (t) label.textContent = t.dataset.cursor;
  });
}

/* ───────── clock (India) ───────── */
const clock = $('#clock');
const tick = () => (clock.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }));
tick(); setInterval(tick, 20000);

/* ───────── triggers that depend on pinned layout — created last ───────── */
if (gl) popQueue.forEach(([name, trigger, start]) => ScrollTrigger.create({
  trigger, start, once: true,
  onEnter: () => gsap.to(item(name), { reveal: 1, duration: reduce ? 0.01 : 1.7, ease: 'elastic.out(1,.55)' })
}));
if (gl) {
  const buddy = item('buddy');
ScrollTrigger.create({
    trigger: '#work', start: 'top 60%', end: 'bottom 40%',
    onToggle: s => {
      const bot = item('buddy').obj.userData, bd = $('#buddy');
      workActive = s.isActive;
      bd.classList.toggle('in-work', s.isActive);
      if (s.isActive) { const a = $$('.band', wkBands).findIndex(b => { const r = b.getBoundingClientRect(); return r.top < innerHeight * 0.55 && r.bottom > innerHeight * 0.55; }); if (a >= 0) explain(a); }
      else { bot.setTone?.(false); bot.setGaze?.(null); bot.setTalk?.(false); bBub.classList.remove('is-talk'); typer?.kill(); gsap.to(bBub, { opacity: 0, duration: 0.25 }); }
    }
  });
  Object.entries(buddyLines).forEach(([id, [text, dark]]) => ScrollTrigger.create({
    trigger: id, start: 'top 62%', end: 'bottom 40%',
    onToggle: s => {
      if (!s.isActive) return;
      buddy.obj.userData.setTone?.(dark);                  // light body on the dark Work section
      buddy.obj.userData.wave?.(true);
      say(text);
    }
  }));
}
['#work', '#capabilities', '#process', '#studio'].forEach(id => {
  const link = $(`.nav__links a[href="${id}"]`);
  ScrollTrigger.create({ trigger: id, start: 'top 55%', end: 'bottom 45%', onToggle: s => link?.classList.toggle('is-active', s.isActive) });
});

addEventListener('load', () => ScrollTrigger.refresh());
