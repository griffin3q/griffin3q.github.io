// Mały silnik gier: niska rozdzielczość + skalowanie "pixelated", wejście (dotyk/mysz/klawiatura), dźwięki.
export const PAL = { blue: '#42B0D5', navy: '#00243D', navy2: '#0B3A5B', white: '#FFFFFF', ice: '#D7F0F8',
  red: '#C23B2E', orange: '#E0812B', yellow: '#D9B23A', green: '#3E8A55', grey: '#8C9AA4', sky: '#7DCBE6', sea: '#0E5C86' };
export const CONTAINER_COLORS = ['blue', 'blue', 'navy', 'red', 'orange', 'green', 'grey', 'yellow', 'blue'];
export const COLOR_HEX = { blue: '#42B0D5', navy: '#0B4A6F', red: '#C23B2E', orange: '#E0812B', green: '#3E8A55', grey: '#8C9AA4', yellow: '#D9B23A' };

const imgCache = {};
export function loadImages(names) {
  return Promise.all(names.map((n) => imgCache[n] ? imgCache[n] : (imgCache[n] = new Promise((res) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/img/' + n + '.png';
  })))).then((arr) => Object.fromEntries(names.map((n, i) => [n, arr[i]])));
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// kontener rysowany "piksel po pikselu" w dowolnej szerokości
export function drawContainer(ctx, x, y, w, h, hex) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w);
  if (w <= 0) return;
  ctx.fillStyle = hex; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(hex, 0.8); for (let i = x + 1; i < x + w - 1; i += 2) ctx.fillRect(i, y + 1, 1, h - 2);
  ctx.fillStyle = shade(hex, 1.25); ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = shade(hex, 0.5); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  if (w > 8) { ctx.fillStyle = shade(hex, 0.45); ctx.fillRect(x + w - 4, y + 2, 1, h - 4); }
}
export function text(ctx, s, x, y, { size = 8, color = '#fff', align = 'left', shadow = PAL.navy, font = 'PS2P' } = {}) {
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(s, Math.round(x) + 1, Math.round(y) + 1); }
  ctx.fillStyle = color; ctx.fillText(s, Math.round(x), Math.round(y));
}
export function hud(ctx, W, score, msLeft, label) {
  ctx.fillStyle = PAL.navy; ctx.fillRect(0, 0, W, 16);
  ctx.fillStyle = PAL.blue; ctx.fillRect(0, 16, W, 1);
  text(ctx, String(score).padStart(5, '0'), 4, 4, { color: PAL.white, shadow: null });
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  text(ctx, (s < 10 ? '0' : '') + s + 's', W - 4, 4, { align: 'right', color: s <= 10 ? PAL.orange : PAL.blue, shadow: null });
  if (label) text(ctx, label, W / 2, 4, { align: 'center', color: PAL.ice, shadow: null });
}
export function button(ctx, b, pressed) {
  ctx.fillStyle = PAL.navy; ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
  ctx.fillStyle = pressed ? shade(PAL.blue, 0.8) : PAL.blue; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; if (!pressed) { ctx.fillRect(b.x, b.y, b.w, 2); ctx.fillRect(b.x, b.y, 2, b.h); }
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2); ctx.fillRect(b.x + b.w - 2, b.y, 2, b.h);
  text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 - 8 + (pressed ? 1 : 0), { align: 'center', color: PAL.navy, shadow: null, size: 16, font: 'VT323' });
}
export const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

// --- dźwięk (prosty "chiptune" przez WebAudio)
let actx = null;
export function sfx(kind) {
  if (localStorage.getItem('pg_sound') === '0') return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    const P = { drop: [220, 110, .08, 'square'], good: [523, 784, .1, 'square'], perfect: [784, 1568, .15, 'square'], bad: [140, 60, .25, 'sawtooth'], tick: [880, 880, .03, 'square'], line: [392, 1046, .2, 'triangle'], end: [523, 130, .5, 'triangle'], coin: [988, 1318, .08, 'square'] }[kind] || [440, 440, .05, 'square'];
    o.type = P[3]; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + P[2] + 0.02);
  } catch {}
}

// --- host gry
export class GameHost {
  constructor(box, game, { onEnd }) {
    this.box = box; this.game = game; this.onEnd = onEnd;
    this.W = game.W; this.H = game.H;
    const c = this.canvas = document.createElement('canvas'); c.width = this.W; c.height = this.H;
    box.appendChild(c); this.ctx = c.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.fit = this.fit.bind(this); window.addEventListener('resize', this.fit); this.fit();
    this.running = false; this.ended = false; this.keys = {};
    const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * this.W / r.width, (e.clientY - r.top) * this.H / r.height]; };
    this.pointers = new Map();
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); c.setPointerCapture?.(e.pointerId); const p = pos(e); this.pointers.set(e.pointerId, p); if (this.running) game.onDown?.(p[0], p[1], e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (!this.pointers.has(e.pointerId)) return; const p = pos(e); this.pointers.set(e.pointerId, p); if (this.running) game.onMove?.(p[0], p[1], e.pointerId); });
    const up = (e) => { if (!this.pointers.has(e.pointerId)) return; const p = pos(e); this.pointers.delete(e.pointerId); if (this.running) game.onUp?.(p[0], p[1], e.pointerId); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.kd = (e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault(); if (e.repeat && this.keys[e.code]) return; this.keys[e.code] = true; if (this.running) game.onKey?.(e.code, true); };
    this.ku = (e) => { this.keys[e.code] = false; if (this.running) game.onKey?.(e.code, false); };
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku);
  }
  fit() {
    const maxW = Math.min(window.innerWidth - 16, 560);
    const maxH = window.innerHeight - (this.box.getBoundingClientRect().top > 0 ? 150 : 150);
    let s = Math.min(maxW / this.W, Math.max(200, maxH) / this.H);
    if (s >= 2) s = Math.floor(s * 2) / 2; // ładne skalowanie, gdy jest miejsce
    this.box.style.width = Math.floor(this.W * s) + 'px'; this.box.style.height = Math.floor(this.H * s) + 'px';
  }
  async start() {
    await this.game.load?.();
    this.game.init(this);
    this.drawFrame(0); // podgląd przed startem
  }
  begin() {
    this.running = true; this.t0 = performance.now(); this.last = this.t0; this.elapsed = 0;
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.elapsed = now - this.t0;
      this.game.update(dt, this);
      if (this.elapsed >= this.game.roundMs) this.end('Koniec czasu!');
      this.drawFrame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  get msLeft() { return Math.max(0, this.game.roundMs - (this.elapsed || 0)); }
  drawFrame() { this.ctx.imageSmoothingEnabled = false; this.game.draw(this.ctx, this); }
  end(reason) {
    if (this.ended) return; this.ended = true; this.running = false; sfx('end');
    setTimeout(() => { cancelAnimationFrame(this.raf); this.drawFrame(); this.onEnd(Math.max(0, Math.floor(this.game.score)), reason, this.elapsed); }, 250);
  }
  destroy() {
    this.running = false; cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.fit); window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
  }
}
