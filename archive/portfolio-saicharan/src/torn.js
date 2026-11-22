// Procedural torn-paper edges, rendered as SVG paths.
// <svg data-torn="bottom|top|both" data-h="120" data-amp="26" data-seed="3"> → filled with currentColor,
// with a pale "fibre" layer peeking out from under the tear (var(--fiber)).

const W = 1440;

function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// One ragged edge: low-frequency wobble + sharp random teeth + the odd deep notch.
function edge(seed, amp, step = 5) {
  const r = rng(seed);
  const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
  const pts = [];
  let x = 0, walk = 0;
  while (x < W + step) {
    const low = Math.sin(x * 0.0042 + p1) * 0.5 + Math.sin(x * 0.0113 + p2) * 0.3 + Math.sin(x * 0.027 + p3) * 0.15;
    walk = walk * 0.72 + (r() - 0.5) * 0.9;            // correlated fibre jitter (not pure noise)
    let y = low * 0.75 + walk * 0.5;
    if (r() < 0.035) y += (r() - 0.4) * 0.9;           // the odd bite out of the paper
    pts.push([Math.min(x, W), y * amp]);
    x += step * (0.45 + r() * 1.3);
  }
  pts[pts.length - 1][0] = W;
  return pts;
}

const fmt = n => n.toFixed(1);

function build(h, side, amp, seed, offset = 0) {
  const top = side === 'top' || side === 'both';
  const bottom = side === 'bottom' || side === 'both';
  const a = top ? edge(seed, amp) : null;
  const b = bottom ? edge(seed + 17, amp) : null;
  const baseTop = top ? amp : 0;
  const baseBot = bottom ? h - amp : h;
  let d = '';
  // top edge, left → right
  if (a) a.forEach(([x, y], i) => (d += `${i ? 'L' : 'M'}${fmt(x)} ${fmt(baseTop + y + offset)}`));
  else d += `M0 0L${W} 0`;
  // bottom edge, right → left
  if (b) [...b].reverse().forEach(([x, y]) => (d += `L${fmt(x)} ${fmt(baseBot + y + offset)}`));
  else d += `L${W} ${h}L0 ${h}`;
  return d + 'Z';
}

export function mountTorn(svg) {
  if (svg.dataset.mounted) return;
  svg.dataset.mounted = '1';
  const side = svg.dataset.torn || 'bottom';
  const h = +(svg.dataset.h || 120);
  const amp = +(svg.dataset.amp || 26);
  const seed = +(svg.dataset.seed || 1);
  svg.setAttribute('viewBox', `0 0 ${W} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const NS = 'http://www.w3.org/2000/svg';
  // fibre layer (offset toward the torn side) then the paper itself
  const fiber = document.createElementNS(NS, 'path');
  fiber.setAttribute('d', build(h, side, amp, seed, side === 'top' ? -4 : 4));
  fiber.setAttribute('class', 'torn__fiber');
  const paper = document.createElementNS(NS, 'path');
  paper.setAttribute('d', build(h, side, amp, seed, 0));
  paper.setAttribute('class', 'torn__paper');
  svg.append(fiber, paper);
}

export function mountAllTorn(root = document) {
  root.querySelectorAll('svg[data-torn]').forEach(mountTorn);
}
