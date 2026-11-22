import '@fontsource/bebas-neue/400.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { mountAllTorn } from './torn.js';
import { initGL, makeCoin, makeShape } from './webgl.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;

/* ───────── film grain texture ───────── */
(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const x = c.getContext('2d');
  const img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 120;
  }
  x.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
})();

/* ───────── torn paper ───────── */
mountAllTorn();

/* ───────── smooth scroll ───────── */
const lenis = new Lenis({ lerp: reduce ? 1 : 0.095, wheelMultiplier: 0.95 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();                                   // locked until the paper tears open

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) { e.preventDefault(); return; }
  const target = id === '#top' ? 0 : $(id);
  if (target === null) return;
  e.preventDefault();
  lenis.scrollTo(target, { duration: 1.7, easing: t => 1 - Math.pow(1 - t, 4) });
});

/* ───────── real-time 3D ───────── */
const gl = initGL($('#gl'), [
  { name: 'hero', el: $('[data-anchor="hero"]'), make: () => makeCoin('burst'), speed: 0.55, startY: 0.6, baseX: 0.1 },
  { name: 'coin', el: $('[data-anchor="coin"]'), make: () => makeCoin('sparkle'), speed: -0.5, startY: 0.3 },
  { name: 'compass', el: $('[data-anchor="compass"]'), make: () => makeCoin('compass'), speed: 0.4, startY: -0.4, baseX: -0.1 },
  { name: 'lab', el: $('[data-anchor="lab"]'), make: () => makeShape('knot'), speed: 0.22, drag: true, scrollSpin: 0.002 }
]);
if (gl) {
  gsap.ticker.add(() => { gl.setScrollVel(lenis.velocity || 0); gl.frame(); });
  const pop = (name, el) => ScrollTrigger.create({
    trigger: el, start: 'top 88%', once: true,
    onEnter: () => gsap.to(gl.byName[name], { reveal: 1, duration: reduce ? 0.01 : 1.7, ease: 'elastic.out(1,.55)' })
  });
  pop('coin', '[data-anchor="coin"]');
  pop('compass', '[data-anchor="compass"]');
  pop('lab', '[data-anchor="lab"]');

  $$('.chip').forEach(btn => btn.addEventListener('click', () => {
    $$('.chip').forEach(b => b.classList.toggle('is-on', b === btn));
    gl.swap('lab', btn.dataset.shape);
    const it = gl.byName.lab;
    it.velY += 0.12;
    gsap.fromTo(it, { reveal: 0.55 }, { reveal: 1, duration: 1.1, ease: 'elastic.out(1,.5)' });
  }));
} else {
  $('#gl').remove();
}

/* ───────── intro words ───────── */
const intro = $('#introText');
intro.innerHTML = intro.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');

/* ───────── preloader → site ───────── */
const countEl = $('#preCount');
const counter = { v: 0 };

function openPaper() {
  const tl = gsap.timeline({
    onComplete: () => { $('#pre').remove(); lenis.start(); ScrollTrigger.refresh(); }
  });
  tl.to('.pre__center', { opacity: 0, y: -40, duration: 0.45, ease: 'power2.in' })
    .to('.pre__half--top', { yPercent: -112, duration: 1.25, ease: 'power4.inOut' }, '<0.1')
    .to('.pre__half--bot', { yPercent: 112, duration: 1.25, ease: 'power4.inOut' }, '<')
    .from('.hero__paper', { yPercent: -8, scaleY: 0.88, transformOrigin: '50% 0', duration: 1.3, ease: 'power3.out' }, '-=0.85')
    .from('.hl', { yPercent: 70, opacity: 0, stagger: 0.11, duration: 1.1, ease: 'power4.out' }, '<0.1')
    .from('.topbar span, .hero__label', { opacity: 0, y: 12, stagger: 0.06, duration: 0.8, ease: 'power3.out' }, '-=0.7');
  if (gl) tl.to(gl.byName.hero, { reveal: 1, duration: reduce ? 0.01 : 1.8, ease: 'elastic.out(1,.55)' }, '-=0.9');
}

(document.fonts?.ready ?? Promise.resolve()).then(() => {
  ScrollTrigger.refresh();
  gsap.to(counter, {
    v: 100, duration: reduce ? 0.3 : 1.9, ease: 'power2.inOut',
    onUpdate: () => (countEl.textContent = String(Math.round(counter.v)).padStart(3, '0')),
    onComplete: openPaper
  });
});

/* ───────── scroll animations ───────── */
// hero lines slide beneath the torn edges
$$('.hl').forEach(el => gsap.to(el, {
  y: () => parseFloat(el.dataset.speed) * 3.2,
  ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
}));
gsap.to('.hero__paper', {
  yPercent: 6, ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
});

// floating nav
ScrollTrigger.create({
  trigger: '.hero', start: 'bottom 12%',
  onEnter: () => $('#nav').classList.add('is-on'),
  onLeaveBack: () => $('#nav').classList.remove('is-on')
});

// giant dim paragraph "reads" as you scroll
gsap.fromTo($$('.w', intro),
  { color: 'rgba(242,238,230,.07)' },
  {
    color: 'rgba(242,238,230,.34)', stagger: 0.06, ease: 'none',
    scrollTrigger: { trigger: '.intro', start: 'top 70%', end: 'bottom 55%', scrub: true }
  });
gsap.from('.intro__col', {
  opacity: 0, y: 30, stagger: 0.15, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '.intro', start: 'top 55%' }
});

// masked line reveals
$$('.mask .rv').forEach(rv => gsap.from(rv, {
  yPercent: 115, duration: 1.15, ease: 'power4.out',
  scrollTrigger: { trigger: rv.parentElement, start: 'top 90%' }
}));

// mission + about details
gsap.from('.mission__reg, .mission__copy', {
  opacity: 0, y: 24, stagger: 0.12, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '.mission', start: 'top 60%' }
});
gsap.from('.mini > *', {
  opacity: 0, y: -14, stagger: 0.06, duration: 0.8, ease: 'power3.out',
  scrollTrigger: { trigger: '.mission', start: 'top 80%' }
});
gsap.from('.divider .torn--front', {
  y: 36, ease: 'none',
  scrollTrigger: { trigger: '.divider', start: 'top bottom', end: 'bottom 40%', scrub: true }
});
gsap.from('.about__vertical', {
  yPercent: 20, opacity: 0, duration: 1.4, ease: 'power3.out',
  scrollTrigger: { trigger: '.about', start: 'top 60%' }
});
gsap.from('.tape--a', {
  xPercent: -38, ease: 'none',
  scrollTrigger: { trigger: '.about', start: 'top 70%', end: 'center 55%', scrub: 1 }
});
gsap.from('.tape--b', {
  rotate: -92, xPercent: -30, ease: 'none',
  scrollTrigger: { trigger: '.about', start: 'top 65%', end: 'center 50%', scrub: 1 }
});
gsap.from('.about__small, .about__right, .about__btn', {
  opacity: 0, y: 30, stagger: 0.14, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '.about__words', start: 'center 80%' }
});

// strip marquee speeds up with scroll velocity
const stripTrack = $('.strip__track');
if (stripTrack && !reduce) {
  const tw = gsap.to(stripTrack, { xPercent: -50, repeat: -1, duration: 26, ease: 'none' });
  stripTrack.style.animation = 'none';
  ScrollTrigger.create({
    trigger: '.strip', start: 'top bottom', end: 'bottom top',
    onUpdate: s => gsap.to(tw, { timeScale: 1 + Math.abs(s.getVelocity() / 400) * (s.direction > 0 ? 1 : -1), duration: 0.3, overwrite: true })
  });
}
gsap.from('.strip__tape', {
  rotate: -9, ease: 'none',
  scrollTrigger: { trigger: '.strip', start: 'top bottom', end: 'center center', scrub: true }
});

// contact
gsap.from('.contact__row, .foot, .contact__kicker', {
  opacity: 0, y: 40, stagger: 0.12, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '.contact__body', start: 'top 70%' }
});

/* ───────── work list + hover preview ───────── */
// Placeholder projects — replace with your own.
const projects = [
  { t: 'ORBIT STUDIO', g: 'WebGL · Three.js · Motion', y: '2026' },
  { t: 'PULSE COMMERCE', g: 'E-commerce · UI/UX · React', y: '2025' },
  { t: 'ATLAS INTERACTIVE', g: 'Real-time 3D · Shaders', y: '2025' },
  { t: 'KINETIC TYPE LAB', g: 'Creative coding · GSAP', y: '2024' },
  { t: 'MERIDIAN DASHBOARD', g: 'Data viz · Design system', y: '2024' }
];
const list = $('#workList');
list.innerHTML = projects.map((p, i) => `
  <li><a href="#" data-cursor="VIEW" data-i="${i}">
    <span class="n">0${i + 1}</span><span class="t">${p.t}</span><span class="g">${p.g}</span><span class="y">${p.y}</span>
  </a></li>`).join('');

gsap.from('#workList li', {
  opacity: 0, y: 60, stagger: 0.1, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '#workList', start: 'top 85%' }
});

const preview = $('#preview'), pvIn = $('#previewIn');
gsap.set(preview, { xPercent: -50, yPercent: -50, scale: 0.7, opacity: 0 });
const pvX = gsap.quickTo(preview, 'x', { duration: 0.5, ease: 'power3' });
const pvY = gsap.quickTo(preview, 'y', { duration: 0.5, ease: 'power3' });
list.addEventListener('pointermove', e => { pvX(e.clientX + 40); pvY(e.clientY); });
list.addEventListener('pointerover', e => {
  const a = e.target.closest('a[data-i]');
  if (!a) return;
  const i = +a.dataset.i, p = projects[i];
  pvIn.innerHTML = `<div class="pv pv--${i % 5}"><span>${p.g}</span><b>0${i + 1}</b><span>${p.t} — ${p.y}</span></div>`;
  list.classList.add('has-hover');
  gsap.to(preview, { opacity: 1, scale: 1, rotate: gsap.utils.random(-7, 7), duration: 0.5, ease: 'back.out(1.6)', overwrite: 'auto' });
});
list.addEventListener('pointerleave', () => {
  list.classList.remove('has-hover');
  gsap.to(preview, { opacity: 0, scale: 0.7, duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
});
list.addEventListener('click', e => { if (e.target.closest('a[data-i]')) e.preventDefault(); });

/* ───────── cursor ───────── */
if (!touch) {
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

/* ───────── magnetic buttons ───────── */
$$('.magnetic').forEach(el => {
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.35, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: 'power3' });
  });
  el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,.4)' }));
});

/* ───────── clock ───────── */
const clock = $('#clock');
const tick = () => (clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
tick(); setInterval(tick, 30000);

addEventListener('load', () => ScrollTrigger.refresh());
