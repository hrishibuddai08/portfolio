import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ═════════════════════════════════════════════════════════════
   Procedural PBR textures — no image assets, generated at start-up
   ═════════════════════════════════════════════════════════════ */
const lerp = (a, b, t) => a + (b - a) * t;
function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// tileable value noise (period `per` lattice cells)
function vnoise(x, y, per, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const g = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, seed);
  return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
}
function fbm(x, y, per, oct, seed) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, per * f, seed + i * 7); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
function heightMap(N, fn) {
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = fn(x, y);
  return h;
}
function toNormal(h, N, strength) {
  const d = new Uint8Array(N * N * 4);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const inv = 1 / Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    d[i] = (-dx * inv * 0.5 + 0.5) * 255; d[i + 1] = (dy * inv * 0.5 + 0.5) * 255; d[i + 2] = (inv * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  return d;
}
function tex(data, N, { color = false, repeat = 1, aniso = 8 } = {}) {
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}
const grey = (v, N) => { const d = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++) { const c = Math.max(0, Math.min(255, v[i] * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = c; d[i * 4 + 3] = 255; } return d; };

function buildTextures(N, aniso) {
  // clear-coat "orange peel": gentle, wide undulation
  const peel = tex(toNormal(heightMap(N, (x, y) => fbm((x / N) * 22, (y / N) * 22, 22, 3, 11)), N, 2.4), N, { repeat: 2, aniso });
  // metallic flake: sparse, tiny, randomly oriented facets
  const flake = tex(toNormal(heightMap(N, (x, y) => (hash(x, y, 5) > 0.9 ? hash(x, y, 6) : 0.25 * fbm(x / 8, y / 8, N / 8, 2, 3))), N, 3.2), N, { repeat: 3, aniso });
  // roughness: smudges + hairline scratches
  const r = heightMap(N, (x, y) => 0.26 + 0.2 * fbm((x / N) * 5, (y / N) * 5, 5, 3, 21) + 0.05 * hash(x, y, 9));
  for (let k = 0; k < N / 5; k++) {
    let x = hash(k, 1, 40) * N, y = hash(k, 2, 40) * N;
    const a = hash(k, 3, 40) * Math.PI, len = 10 + hash(k, 4, 40) * N * 0.2, amt = 0.18 + hash(k, 5, 40) * 0.25;
    for (let s = 0; s < len; s++) {
      const xi = (Math.floor(x) + N) % N, yi = (Math.floor(y) + N) % N;
      r[yi * N + xi] = Math.min(1, r[yi * N + xi] + amt);
      x += Math.cos(a); y += Math.sin(a);
    }
  }
  const rough = tex(grey(r, N), N, { repeat: 2, aniso });

  // carbon-fibre 2×2 twill
  const cell = N / 16;
  const cf = heightMap(N, (x, y) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const horiz = ((cx + cy) >> 1) % 2 === 0;
    const u = (horiz ? (y % cell) : (x % cell)) / cell;
    return 0.5 + 0.5 * Math.sin(u * Math.PI) * (horiz ? 1 : 0.85);
  });
  const cfCol = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { const v = 22 + cf[i] * 40; cfCol[i * 4] = v; cfCol[i * 4 + 1] = v; cfCol[i * 4 + 2] = v + 3; cfCol[i * 4 + 3] = 255; }
  const carbonMap = tex(cfCol, N, { color: true, repeat: 3, aniso });
  const carbonNormal = tex(toNormal(cf, N, 3), N, { repeat: 3, aniso });

  // brushed metal streaks (horizontal)
  const bru = heightMap(N, (x, y) => 0.34 + 0.22 * vnoise(x * 0.012 * 8, y * 0.9, N, 31) + 0.1 * hash(0, y, 32));
  const brushed = tex(grey(bru, N), N, { repeat: 2, aniso });
  return { peel, flake, rough, carbonMap, carbonNormal, brushed };
}

/* ═════════════════════════════════════════════════════════════
   Materials (built once the renderer exists)
   ═════════════════════════════════════════════════════════════ */
let M = null;
function buildMaterials(N, aniso) {
  const T = buildTextures(N, aniso);
  const v2 = (a, b = a) => new THREE.Vector2(a, b);
  const lacquer = new THREE.MeshPhysicalMaterial({            // deep crimson candy lacquer over metallic flake
    color: 0x9c0925, metalness: 0.7, roughness: 0.32, roughnessMap: T.rough,
    normalMap: T.flake, normalScale: v2(0.16),
    clearcoat: 1, clearcoatRoughness: 0.035, clearcoatNormalMap: T.peel, clearcoatNormalScale: v2(0.22),
    envMapIntensity: 1.1, sheen: 0.0
  });
  const pearl = new THREE.MeshPhysicalMaterial({              // glazed ceramic
    color: 0xf3eee6, metalness: 0, roughness: 0.16, roughnessMap: T.rough, clearcoat: 0.8, clearcoatRoughness: 0.05,
    clearcoatNormalMap: T.peel, clearcoatNormalScale: v2(0.12), envMapIntensity: 1.1
  });
  const chrome = new THREE.MeshPhysicalMaterial({             // mirror chrome
    color: 0xf2f2f4, metalness: 1, roughness: 0.035, envMapIntensity: 1.5
  });
  const carbon = new THREE.MeshPhysicalMaterial({             // carbon fibre under clear
    color: 0xffffff, map: T.carbonMap, normalMap: T.carbonNormal, normalScale: v2(0.8),
    metalness: 0.35, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2
  });
  const brushed = new THREE.MeshPhysicalMaterial({            // anisotropic brushed aluminium
    color: 0xdedfe2, metalness: 1, roughness: 0.38, roughnessMap: T.brushed, anisotropy: 0.85, anisotropyRotation: 0, envMapIntensity: 1.3
  });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x2a2b30, metalness: 1, roughness: 0.28, roughnessMap: T.brushed, envMapIntensity: 1.2 });
  const deep = lacquer.clone(); deep.color = new THREE.Color(0x6e0720);
  const titanium = new THREE.MeshPhysicalMaterial({ color: 0x77746f, metalness: 1, roughness: 0.34, roughnessMap: T.brushed, anisotropy: 0.7, envMapIntensity: 1.25 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0x050507, metalness: 0.2, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
  return { lacquer, pearl, chrome, carbon, brushed, steel, deep, titanium, lens, T };
}

// studio environment: soft boxes, a warm bounce card and a floor — gives lacquer its long, believable highlights
function studioScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x6f6c69);
  const box = (w, h, power, color = 0xffffff) => new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
  const top = box(16, 16, 6); top.position.set(0, 11, 0); top.rotation.x = Math.PI / 2; s.add(top);
  const key = box(3.2, 13, 9); key.position.set(-10, 3, 4); key.lookAt(0, 0, 0); s.add(key);
  const fill = box(5, 10, 3.6, 0xfff1ea); fill.position.set(10, 1, 3); fill.lookAt(0, 0, 0); s.add(fill);
  const rim = box(11, 4, 3, 0xffc9d4); rim.position.set(0, 3, -11); rim.lookAt(0, 0, 0); s.add(rim);
  const front = box(14, 7, 0.55, 0xd8d4d0); front.position.set(0, 0.5, 11); front.lookAt(0, 0, 0); s.add(front);
  const strip = box(18, 0.8, 8); strip.position.set(0, 5.5, 6); strip.lookAt(0, 0, 0); s.add(strip);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf1e8de).multiplyScalar(0.9) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -7; s.add(floor);
  return s;
}

/* ═════════════════════════════════════════════════════════════
   Shapes
   ═════════════════════════════════════════════════════════════ */
function sparkle() {
  const s = new THREE.Shape();
  s.moveTo(0, 1);
  s.quadraticCurveTo(0.1, 0.1, 1, 0);
  s.quadraticCurveTo(0.1, -0.1, 0, -1);
  s.quadraticCurveTo(-0.1, -0.1, -1, 0);
  s.quadraticCurveTo(-0.1, 0.1, 0, 1);
  return s;
}
function burst(n, ro, ri) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = (i * Math.PI) / n - Math.PI / 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
function needle() {
  const s = new THREE.Shape();
  s.moveTo(0, 1); s.lineTo(0.2, 0); s.lineTo(0, -1); s.lineTo(-0.2, 0); s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.07, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}
function ring(ro, ri) {
  const s = new THREE.Shape();
  s.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, ri, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}
function hShape() {                                           // "H" with softly rounded corners
  const s = new THREE.Shape();
  const r = 0.1;
  const pts = [
    [-0.78, -1], [-0.26, -1], [-0.26, -0.2], [0.26, -0.2], [0.26, -1], [0.78, -1],
    [0.78, 1], [0.26, 1], [0.26, 0.2], [-0.26, 0.2], [-0.26, 1], [-0.78, 1]
  ];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const va = new THREE.Vector2(a[0] - p[0], a[1] - p[1]).normalize().multiplyScalar(r);
    const vb = new THREE.Vector2(b[0] - p[0], b[1] - p[1]).normalize().multiplyScalar(r);
    i === 0 ? s.moveTo(p[0] + va.x, p[1] + va.y) : s.lineTo(p[0] + va.x, p[1] + va.y);
    s.quadraticCurveTo(p[0], p[1], p[0] + vb.x, p[1] + vb.y);
  }
  s.closePath();
  return s;
}
const extrude = (shape, depth = 0.06, b = 0.012, seg = 3) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: seg, curveSegments: 32 });
const shadowOn = (obj, cast = true) => { obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; } }); return obj; };

/* ═════════════════════════════════════════════════════════════
   Objects
   ═════════════════════════════════════════════════════════════ */
// ───────── hero: a small companion robot (matte ABS, satin joints, rubber soles) ─────────
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function planarUV(geo, w, h) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / w + 0.5; uv[i * 2 + 1] = p.getY(i) / h + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// the face: black glass, a faint pixel grid, two glowing square eyes that glance, blink — and smile ^ ^ when greeting
function makeFace() {
  const W = 512, H = 384, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const REEL = ['WEB', 'DESIGN', 'BUILD', 'SHIP'];
  const draw = (gx, gy, open, happy, word, boot) => {
    if (boot != null && boot < 1) {                                  // screen powering on
      x.fillStyle = '#040405'; x.fillRect(0, 0, W, H);
      if (boot > 0) {
        const e = boot * boot * (3 - 2 * boot), y = e * H;
        const g = x.createLinearGradient(0, y - 70, 0, y);
        g.addColorStop(0, 'rgba(255,225,245,0)'); g.addColorStop(1, 'rgba(255,225,245,.5)');
        x.fillStyle = g; x.fillRect(0, Math.max(0, y - 70), W, 70);
        x.fillStyle = 'rgba(255,238,248,.95)'; x.fillRect(0, y - 2, W, 3);
        const a = Math.min(1, Math.max(0, (boot - 0.5) / 0.5));
        if (a > 0) [W * 0.34, W * 0.66].forEach(cx => {
          x.save(); x.shadowColor = `rgba(255,225,245,${a})`; x.shadowBlur = 40 * a;
          x.fillStyle = `rgba(255,255,255,${a})`;
          const ew = 76 * a, eh = 5 + 75 * a * a;
          x.beginPath(); x.roundRect(cx - ew / 2, H * 0.5 - eh / 2, ew, eh, 8); x.fill(); x.restore();
        });
      }
      tex.needsUpdate = true; return;
    }
    x.fillStyle = '#040405'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.04)'; x.lineWidth = 1;
    for (let i = 0; i <= W; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let j = 0; j <= H; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
    if (word != null) {                                              // vertical reel: words scroll up one after another
      x.save();
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const list = typeof word === 'string' ? [word] : REEL, pos = typeof word === 'string' ? 0 : word;
      list.forEach((wd, k) => {
        const d = k - pos, ad = Math.abs(d);
        if (ad > 1.25) return;
        let fs = 250; x.font = `400 ${fs}px "Bebas Neue", Impact, sans-serif`;
        const w0 = x.measureText(wd).width; if (w0 > W * 0.84) { fs *= (W * 0.84) / w0; x.font = `400 ${fs}px "Bebas Neue", Impact, sans-serif`; }
        const al = Math.max(0, 1 - ad * 0.95);
        x.shadowColor = `rgba(255,225,245,${al})`; x.shadowBlur = 38;
        x.fillStyle = `rgba(255,255,255,${al})`;
        x.fillText(wd, W / 2, H * 0.53 - d * H * 0.74);
      });
      x.restore(); tex.needsUpdate = true; return;
    }
    const cy = H * 0.5 + gy;
    [W * 0.34 + gx, W * 0.66 + gx].forEach(cx => {
      x.save();
      x.shadowColor = 'rgba(255,225,245,.95)'; x.shadowBlur = 46;
      if (happy > 0.5) {                                             // ^ ^ eyes
        x.strokeStyle = '#ffffff'; x.lineWidth = 20; x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath(); x.moveTo(cx - 40, cy + 22); x.lineTo(cx, cy - 22); x.lineTo(cx + 40, cy + 22); x.stroke();
      } else {
        const ew = 76, eh = 80 * open;
        const g = x.createLinearGradient(cx - ew / 2, cy - eh / 2, cx + ew / 2, cy + eh / 2);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f3d9ee');
        x.fillStyle = g;
        x.beginPath(); x.roundRect(cx - ew / 2, cy - eh / 2, ew, Math.max(4, eh), 8); x.fill();
      }
      x.restore();
    });
    tex.needsUpdate = true;
  };
  draw(0, 0, 1, 0, null, null);
  return { tex, draw };
}

export function makeRobot() {
  const root = new THREE.Group(), robot = new THREE.Group();
  root.add(robot);
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, r), mat);
  const cyl = (rt, rb, h, mat, seg = 32) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

  const abs = new THREE.MeshPhysicalMaterial({                 // soft-touch black ABS
    color: 0x0b0b0d, roughness: 0.8, roughnessMap: M.T.rough, metalness: 0,
    normalMap: M.T.peel, normalScale: new THREE.Vector2(0.16),
    clearcoat: 0, sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x4a4a52), envMapIntensity: 0.65
  });
  const satin = new THREE.MeshPhysicalMaterial({ color: 0x4a4a50, metalness: 0.9, roughness: 0.32, roughnessMap: M.T.brushed, envMapIntensity: 1.2 });
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.95, normalMap: M.T.flake, normalScale: new THREE.Vector2(0.5), envMapIntensity: 0.35 });
  const led = new THREE.MeshStandardMaterial({ color: 0x300008, emissive: 0xff2a52, emissiveIntensity: 1.6, roughness: 0.3 });
  const grille = new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.9 });

  /* ── head ── */
  const head = new THREE.Group(); head.position.set(0, 0, 0);
  head.add(rbox(1.52, 1.16, 1.1, 0.32, abs));
  const bezelShape = rrect(1.34, 0.98, 0.26);
  bezelShape.holes.push(new THREE.Path(rrect(1.18, 0.84, 0.2).getPoints(24).reverse()));
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bezelShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 5, curveSegments: 24 }), satin);
  bezel.position.z = 0.55; head.add(bezel);
  const face = makeFace();
  const sg = new THREE.ShapeGeometry(rrect(1.18, 0.84, 0.2), 28); planarUV(sg, 1.18, 0.84); sg.translate(0, 0, 0.558);
  head.add(new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({
    color: 0x050506, map: face.tex, emissiveMap: face.tex, emissive: 0xffffff, emissiveIntensity: 1.35,
    roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.7
  })));
  [-1, 1].forEach(side => {                                          // ear modules: satin discs with a ring
    const disc = cyl(0.17, 0.17, 0.1, satin); disc.rotation.z = Math.PI / 2; disc.position.set(side * 0.8, 0.06, -0.02); head.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 12, 40), abs); ring.rotation.y = Math.PI / 2; ring.position.set(side * 0.855, 0.06, -0.02); head.add(ring);
  });
  for (let i = -2; i <= 2; i++) {                                    // top speaker slots
    const slot = rbox(0.34, 0.012, 0.03, 0.006, grille); slot.position.set(0, 0.585, -0.1 + i * 0.08); head.add(slot);
  }
  robot.add(head);

  /* ── soft shadow on a catcher "wall" behind ── */
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ color: 0x120a0c, opacity: 0.26 }));
  catcher.position.z = -1.5; catcher.receiveShadow = true; catcher.userData.catcher = true;
  root.add(catcher);
  shadowOn(robot);

  /* ── life: the body never turns — only the eyes glance, the head breathes, and it nods hello ── */
  const ease = v => v * v * (3 - 2 * v), cl = v => Math.min(1, Math.max(0, v));
  const WAVE = 3.2;
  let last = 0, nextBlink = 2.2, blinkT = -1, waveT = -1, cooldown = 0, lastGx = 99, lastGy = 99, lastOpen = 1, lastHappy = 0, lookX = 0, lookY = 0, ex = 0, ey = 0, boot = null, lastBoot = null, word = null, lastWord = null, pulse = 0;
  root.userData.wave = force => { if (waveT < 0 && (force || cooldown <= 0)) { waveT = 0; cooldown = 9; root.userData.onHi?.(true); } };
  // light / dark body so the companion stays visible on any background
  const C0 = new THREE.Color(0x0b0b0d), C1 = new THREE.Color(0xe7e3dc), S0 = new THREE.Color(0x4a4a50), S1 = new THREE.Color(0xb9b9bf);
  let tone = 0, toneT = 0;
  root.userData.setTone = dark => { toneT = dark ? 1 : 0; };
  root.userData.setWord = w => { word = w; };
  root.userData.setBoot = v => { boot = v; };
  let talking = false;
  root.userData.setTalk = v => { talking = v; };
  root.userData.setGaze = g => { root.userData.gaze = g; };
  root.userData.update = t => {
    const dt = Math.min(0.05, Math.max(0, t - last)); last = t; cooldown -= dt;
    const m = root.userData.gaze || root.userData.mouse || { x: 0, y: 0 };
    const sc = root.userData.screen, near = sc && m.px != null && Math.hypot(m.px - sc.x, m.py - sc.y) < sc.w * 0.55;
    if (near && !root.userData.noWave) root.userData.wave();

    let env = 0;
    if (waveT >= 0) {
      waveT += dt;
      env = ease(cl(waveT / 0.4)) * (1 - ease(cl((waveT - (WAVE - 0.5)) / 0.5)));
      if (waveT > WAVE) { waveT = -1; root.userData.onHi?.(false); }
    }

    // hover + breathing, plus a little happy bounce while greeting
    if (Math.abs(tone - toneT) > 0.002) { tone += (toneT - tone) * 0.08; abs.color.lerpColors(C0, C1, tone); satin.color.lerpColors(S0, S1, tone); }
    const br = Math.sin(t * 1.7);
    robot.position.y = Math.sin(t * 1.5) * 0.035 + env * Math.abs(Math.sin(waveT * 6)) * 0.07;
    pulse *= 0.9;
    head.scale.setScalar(1 + br * 0.008 + pulse * 0.07);

    // head + eyes look straight at the pointer: direction from the robot to the cursor
    let nx = m.x * 2, ny = m.y * 2;
    if (!root.userData.gaze && sc && m.px != null) {
      nx = Math.max(-1, Math.min(1, (m.px - sc.x) / (innerWidth * 0.4)));
      ny = Math.max(-1, Math.min(1, (m.py - sc.y) / (innerHeight * 0.4)));
    }
    ex += (nx - ex) * 0.22; ey += (ny - ey) * 0.22;
    lookX += ((ex * 0.42 + Math.sin(t * 0.43) * 0.02) - lookX) * 0.14;
    lookY += ((ey * 0.3 + Math.sin(t * 0.31 + 1) * 0.015) - lookY) * 0.14;
    head.rotation.y += (lookX - head.rotation.y) * 0.1;
    head.rotation.x += (lookY + env * Math.sin(waveT * 7) * 0.12 + (talking ? Math.sin(t * 9) * 0.035 : 0) - head.rotation.x) * 0.2;
    head.rotation.z = Math.sin(t * 0.9) * 0.02 + env * Math.sin(waveT * 3.5) * 0.06;

    // eyes: wander, blink (sometimes twice), ^ ^ when greeting
    if (blinkT < 0 && t > nextBlink) blinkT = 0;
    let open = 1;
    if (blinkT >= 0) {
      blinkT += dt;
      open = 1 - Math.sin(cl(blinkT / 0.17) * Math.PI) * 0.94;
      if (blinkT > 0.17) { blinkT = -1; nextBlink = t + (Math.random() < 0.25 ? 0.22 : 2.6 + Math.random() * 3.4); }
    }
    if (talking && blinkT < 0) open = 0.72 + 0.28 * Math.sin(t * 17);   // eyes pulse like speech
    const gx = ex * 62 + Math.sin(t * 0.8) * 2.5, gy = ey * 36 + Math.sin(t * 0.6 + 2) * 2;
    const happy = env > 0.25 ? 1 : 0;
    if (Math.abs(gx - lastGx) > 0.4 || Math.abs(gy - lastGy) > 0.4 || Math.abs(open - lastOpen) > 0.02 || happy !== lastHappy || word !== lastWord || boot !== lastBoot || (boot != null && boot < 1)) {
      face.draw(gx, gy, open, happy, word, boot); lastGx = gx; lastGy = gy; lastOpen = open; lastHappy = happy; lastWord = word; lastBoot = boot;
    }
  };
  root.userData.rotTarget = robot;
  root.userData.shadow = true;
  return root;
}

function coinBody() {
  const prof = [
    [0, 0.08], [0.76, 0.08], [0.79, 0.125], [0.93, 0.125], [1.0, 0.085],
    [1.0, -0.085], [0.93, -0.125], [0.79, -0.125], [0.76, -0.08], [0, -0.08]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 160);
  g.rotateX(Math.PI / 2);
  return g;
}
function addEmblem(group, geo, scale, z, mat) {
  geo.center();
  geo.computeVertexNormals();
  const depth = new THREE.Box3().setFromBufferAttribute(geo.attributes.position).getSize(new THREE.Vector3()).z;
  const front = new THREE.Mesh(geo, mat);
  front.scale.setScalar(scale);
  front.position.z = z + (depth * scale) / 2;
  const back = front.clone();
  back.rotation.y = Math.PI;
  back.position.z = -front.position.z;
  group.add(front, back);
}
export function makeCoin(kind) {
  const g = new THREE.Group();
  const dark = kind === 'sparkleInk';
  g.add(new THREE.Mesh(coinBody(), dark ? M.carbon : M.lacquer));
  if (kind === 'sparkle' || dark) {
    addEmblem(g, extrude(sparkle(), 0.06), 0.56, 0.075, dark ? M.chrome : M.pearl);
    addEmblem(g, extrude(ring(1, 0.93), 0.05), 0.68, 0.075, dark ? M.chrome : M.pearl);
  } else if (kind === 'burst') {
    addEmblem(g, extrude(burst(12, 1, 0.52), 0.05), 0.5, 0.075, M.pearl);
    addEmblem(g, extrude(ring(1, 0.9), 0.05), 0.66, 0.075, M.steel);
  } else {
    addEmblem(g, extrude(needle(), 0.06), 0.62, 0.075, M.pearl);
    const n2 = extrude(needle(), 0.05); n2.rotateZ(Math.PI / 2);
    addEmblem(g, n2, 0.36, 0.075, M.steel);
    addEmblem(g, extrude(ring(1, 0.94), 0.05), 0.7, 0.075, M.pearl);
  }
  return g;
}

/* ═════════════════════════════════════════════════════════════
   Scene
   ═════════════════════════════════════════════════════════════ */
export function initGL(canvas, defs) {
  let renderer;
  const mobile = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
  const lowPower = mobile || (navigator.hardwareConcurrency || 8) <= 4;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL unavailable', e);
    return null;
  }
  const maxDpr = mobile ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  M = buildMaterials(lowPower ? 256 : 512, Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioScene(), 0.015).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);
  let W = innerWidth, H = innerHeight;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.z = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  const fillRim = new THREE.DirectionalLight(0xffc2cf, 0.7); fillRim.position.set(700, -200, 400); scene.add(fillRim);

  // the "sun": a shadow-casting key light that follows the hero monogram
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.castShadow = !lowPower;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 11; sun.shadow.blurSamples = 20; sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { mouse.tx = e.clientX / W - 0.5; mouse.ty = e.clientY / H - 0.5; mouse.px = e.clientX; mouse.py = e.clientY; }, { passive: true });
  addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    mouse.tx = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
    mouse.ty = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90));
  }, { passive: true });

  const items = defs.map(d => {
    const obj = d.make();
    obj.visible = false;
    scene.add(obj);
    if (lowPower) obj.traverse(o => { if (o.userData?.catcher) o.visible = false; });
    return {
      ...d, obj, reveal: d.reveal ?? 0, spinY: d.startY ?? 0, speed: d.speed ?? 0.5, scale: d.scale ?? 1,
      baseX: d.baseX ?? 0, baseZ: d.baseZ ?? 0, scrollSpin: d.scrollSpin ?? 0.004, rotX: 0, rotY: 0, rotZ: 0
    };
  });
  const byName = Object.fromEntries(items.map(i => [i.name, i]));

  let scrollVel = 0, last = performance.now() / 1000, t = 0, cleared = false;

  function frame() {
    if (document.hidden) return;
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - last); last = now; t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;

    let any = false, sunUsed = false;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      const vis = r.width > 0 && r.bottom > -400 && r.top < H + 400 && it.reveal > 0.002;
      it.obj.visible = vis;
      if (!vis) continue;
      any = true;

      const s = (r.width / 2) * it.scale * it.reveal * (it.os ?? 1);
      it.obj.scale.setScalar(s);
      it.obj.position.set(r.left + r.width / 2 - W / 2 + (it.ox || 0), -(r.top + r.height / 2 - H / 2 + (it.oy || 0)), 0);

      const rt = it.obj.userData.rotTarget || it.obj;
      if (it.fixed) rt.rotation.set(0, 0, 0);
      else if (it.manual) rt.rotation.set(it.rotX, it.rotY, it.rotZ);
      else {
        it.spinY += dt * it.speed + scrollVel * it.scrollSpin;
        rt.rotation.set(
          it.baseX + mouse.y * 0.55 + Math.sin(t * 0.7 + it.spinY * 0.1) * 0.08,
          it.spinY * (it.sway ? 0 : 1) + (it.sway ? Math.sin(t * 0.6) * it.sway : 0) + mouse.x * 0.7,
          it.baseZ + Math.sin(t * 0.5) * 0.05
        );
      }
      it.obj.userData.mouse = mouse;
      it.obj.userData.screen = { x: r.left + r.width / 2 + (it.ox || 0), y: r.top + r.height / 2 + (it.oy || 0), w: r.width };
      it.obj.userData.update?.(t);

      if (it.obj.userData.shadow && !lowPower) {            // aim the sun so the soft shadow falls on the "wall" behind
        const p = it.obj.position, e = 3.4 * s;
        sun.position.set(p.x - 0.9 * s, p.y + 1.35 * s, 2.6 * s);
        sun.target.position.set(p.x, p.y, 0);
        const c = sun.shadow.camera;
        c.left = -e; c.right = e; c.top = e; c.bottom = -e; c.near = 0.3 * s; c.far = 10 * s;
        c.updateProjectionMatrix();
        sunUsed = true;
      }
    }
    sun.castShadow = sunUsed;
    if (any) { renderer.render(scene, camera); cleared = false; }
    else if (!cleared) { renderer.clear(); cleared = true; }
  }

  return { items, byName, frame, setScrollVel: v => (scrollVel = Math.max(-80, Math.min(80, v))) };
}
