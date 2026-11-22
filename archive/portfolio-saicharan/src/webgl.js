import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ───────────── emblem shapes ───────────── */
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
const extrude = (shape, depth = 0.06, b = 0.012) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 28 });

/* ───────────── materials ───────────── */
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0xff4a12, metalness: 0.9, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.5
});
const embMat = new THREE.MeshPhysicalMaterial({
  color: 0xff8a3d, metalness: 0.95, roughness: 0.28, clearcoat: 0.6, envMapIntensity: 1.6
});
const darkMat = new THREE.MeshPhysicalMaterial({
  color: 0x4a1200, metalness: 0.7, roughness: 0.5, envMapIntensity: 0.9
});

/* ───────────── objects ───────────── */
function coinBody() {
  const prof = [
    [0, 0.08], [0.76, 0.08], [0.79, 0.125], [0.93, 0.125], [1.0, 0.085],
    [1.0, -0.085], [0.93, -0.125], [0.79, -0.125], [0.76, -0.08], [0, -0.08]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 128);
  g.rotateX(Math.PI / 2);          // faces → ±Z
  return g;
}

function addEmblem(group, geo, scale, z, mat = embMat) {
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
  g.add(new THREE.Mesh(coinBody(), bodyMat));
  if (kind === 'burst') {
    addEmblem(g, extrude(burst(12, 1, 0.52), 0.05), 0.5, 0.075);
    addEmblem(g, extrude(ring(1, 0.9), 0.05), 0.66, 0.075, darkMat);
  } else if (kind === 'sparkle') {
    addEmblem(g, extrude(sparkle(), 0.06), 0.56, 0.075);
    addEmblem(g, extrude(ring(1, 0.93), 0.05), 0.68, 0.075, embMat);
  } else if (kind === 'compass') {
    const n = extrude(needle(), 0.06);
    addEmblem(g, n, 0.62, 0.075);
    const n2 = extrude(needle(), 0.05); n2.rotateZ(Math.PI / 2);
    addEmblem(g, n2, 0.36, 0.075, darkMat);
    addEmblem(g, extrude(ring(1, 0.94), 0.05), 0.7, 0.075, embMat);
  }
  return g;
}

export function makeShape(name) {
  if (name === 'coin') return makeCoin('sparkle');
  let geo;
  if (name === 'knot') geo = new THREE.TorusKnotGeometry(0.62, 0.22, 260, 40, 2, 3);
  else if (name === 'gem') geo = new THREE.IcosahedronGeometry(0.95, 1);
  else geo = new THREE.TorusGeometry(0.7, 0.3, 48, 128);
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xff4a12, metalness: 0.9, roughness: name === 'gem' ? 0.3 : 0.18,
    clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.5, flatShading: name === 'gem'
  });
  const mesh = new THREE.Mesh(geo, m);
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/* ───────────── scene ───────────── */
export function initGL(canvas, defs) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL unavailable', e);
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);
  let W = innerWidth, H = innerHeight;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.z = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-400, 500, 900);
  const rim = new THREE.DirectionalLight(0xff7a3a, 2.6); rim.position.set(600, -200, 300);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { mouse.tx = e.clientX / W - 0.5; mouse.ty = e.clientY / H - 0.5; });

  const items = defs.map(d => {
    const obj = d.make();
    obj.visible = false;
    scene.add(obj);
    return {
      ...d, obj, reveal: d.reveal ?? 0, spinY: d.startY ?? 0, spinX: 0, velY: 0, velX: 0,
      speed: d.speed ?? 0.5, scale: d.scale ?? 1, baseX: d.baseX ?? 0, baseZ: d.baseZ ?? 0, scrollSpin: d.scrollSpin ?? 0.004
    };
  });
  const byName = Object.fromEntries(items.map(i => [i.name, i]));

  // drag-to-rotate for interactive anchors
  items.filter(i => i.drag).forEach(it => {
    let down = false, lx = 0, ly = 0;
    it.el.addEventListener('pointerdown', e => { down = true; lx = e.clientX; ly = e.clientY; it.el.setPointerCapture(e.pointerId); });
    it.el.addEventListener('pointermove', e => {
      if (!down) return;
      it.velY += (e.clientX - lx) * 0.0016; it.velX += (e.clientY - ly) * 0.0016;
      lx = e.clientX; ly = e.clientY;
    });
    const up = () => (down = false);
    it.el.addEventListener('pointerup', up); it.el.addEventListener('pointercancel', up);
  });

  let scrollVel = 0, last = performance.now() / 1000, t = 0;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - last); last = now; t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;

    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      const vis = r.width > 0 && r.bottom > -300 && r.top < H + 300 && it.reveal > 0.002;
      it.obj.visible = vis;
      if (!vis) continue;

      it.velY *= 0.94; it.velX *= 0.94;
      it.spinY += dt * it.speed + scrollVel * it.scrollSpin + it.velY;
      it.spinX += it.velX;
      if (it.drag) it.spinX *= 0.985;

      const s = (r.width / 2) * it.scale * it.reveal;
      it.obj.scale.setScalar(s);
      it.obj.position.set(r.left + r.width / 2 - W / 2, -(r.top + r.height / 2 - H / 2), 0);
      it.obj.rotation.set(
        it.baseX + it.spinX + mouse.y * 0.55 + Math.sin(t * 0.7 + it.spinY * 0.1) * 0.08,
        it.spinY + mouse.x * 0.7,
        it.baseZ + Math.sin(t * 0.5) * 0.05
      );
    }
    renderer.render(scene, camera);
  }

  return {
    items, byName, frame,
    setScrollVel: v => (scrollVel = Math.max(-80, Math.min(80, v))),
    swap(name, shapeName) {
      const it = byName[name];
      const nu = makeShape(shapeName);
      nu.visible = it.obj.visible;
      scene.remove(it.obj);
      it.obj.traverse(o => { if (o.geometry && !o.isCoinShared) o.geometry.dispose?.(); });
      it.obj = nu; scene.add(nu);
    }
  };
}
