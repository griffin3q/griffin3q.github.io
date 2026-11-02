// Wieża kontenerów – zatrzymaj przesuwający się kontener nad stosem. Wystające części odpadają.
import { PAL, COLOR_HEX, CONTAINER_COLORS, drawContainer, text, hud, sfx, loadImages } from '../engine.js';

export default function createTower() {
  const W = 180, H = 320, BH = 10, BASE_W = 64, HOLD_Y = 96;
  let img, stack, cur, debris, combo, popups, cam, camTarget, dropAnim, waves = 0;
  const g = {
    id: 'tower', W, H, roundMs: 60000, score: 0,
    async load() { img = await loadImages(['port_banner', 'water', 'star']); },
    init() {
      g.score = 0; combo = 0; debris = []; popups = []; cam = 0; camTarget = 0; dropAnim = null;
      stack = [{ x: (W - BASE_W) / 2, w: BASE_W, color: 'navy' }];
      spawn();
    },
    onDown() { drop(); }, onKey(code, down) { if (down && (code === 'Space' || code === 'Enter' || code === 'ArrowDown')) drop(); },
    update(dt, host) {
      waves += dt;
      if (cur && !dropAnim) {
        cur.x += cur.v * dt;
        if (cur.x < -cur.w * 0.35) { cur.x = -cur.w * 0.35; cur.v = Math.abs(cur.v); }
        if (cur.x + cur.w > W + cur.w * 0.35) { cur.x = W + cur.w * 0.35 - cur.w; cur.v = -Math.abs(cur.v); }
      }
      if (dropAnim) { dropAnim.t += dt; if (dropAnim.t >= 0.12) { dropAnim = null; land(host); } }
      for (const d of debris) { d.vy += 420 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.r += d.vr * dt; }
      debris = debris.filter((d) => d.y + cam < H + 40);
      for (const p of popups) { p.t += dt; p.y -= 18 * dt; } popups = popups.filter((p) => p.t < 0.9);
      cam += (camTarget - cam) * Math.min(1, dt * 6);
    },
    draw(ctx, host) {
      const h = stack.length * BH; // wysokość wieży (do koloru nieba)
      const k = Math.min(1, h / 900);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mix('#7DCBE6', '#0B2747', k)); sky.addColorStop(1, mix('#C7EAF5', '#2A5D86', k));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (k > 0.4) { ctx.fillStyle = '#fff'; for (let i = 0; i < 24; i++) ctx.fillRect((i * 53) % W, (i * 97 + Math.floor(cam * 0.2)) % H, 1, 1); }
      // chmurki pikselowe
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 4; i++) { const cx = ((i * 61 + waves * 4) % (W + 40)) - 20, cy = ((i * 83 + cam * 0.5) % 260) + 20; ctx.fillRect(cx, cy, 18, 4); ctx.fillRect(cx + 4, cy - 3, 9, 3); }
      const groundY = topY(0) + BH + cam;
      if (img.port_banner && groundY < H + 60) { ctx.drawImage(img.port_banner, 10, groundY - 46); ctx.drawImage(img.port_banner, -150, groundY - 46); }
      ctx.fillStyle = '#6E757B'; ctx.fillRect(0, groundY - 2, W, H); ctx.fillStyle = PAL.sea; ctx.fillRect(0, groundY + 6, W, H);
      // stos
      stack.forEach((b, i) => drawContainer(ctx, b.x, topY(i) + cam, b.w, BH, COLOR_HEX[b.color]));
      // gwiazdka na niebieskich (motyw własny)
      stack.forEach((b, i) => { if (b.color === 'blue' && b.w > 16 && img.star) ctx.drawImage(img.star, 0, 0, 9, 9, Math.round(b.x + b.w / 2 - 3), topY(i) + cam + 2, 6, 6); });
      // dźwig + aktualny kontener
      if (cur) {
        const y = dropAnim ? HOLD_Y + (topY(stack.length) + cam - HOLD_Y) * (dropAnim.t / 0.12) : HOLD_Y;
        const cx = Math.round(cur.x + cur.w / 2);
        ctx.fillStyle = PAL.yellow; ctx.fillRect(0, 22, W, 5); ctx.fillStyle = '#A88A2A'; for (let i = 0; i < W; i += 4) ctx.fillRect(i, 23, 2, 3);
        ctx.fillStyle = PAL.navy; ctx.fillRect(cx - 6, 27, 12, 6);
        if (!dropAnim) { ctx.fillStyle = '#222'; ctx.fillRect(cx, 33, 1, HOLD_Y - 35); ctx.fillRect(cx - 6, HOLD_Y - 3, 12, 2); }
        drawContainer(ctx, cur.x, y, cur.w, BH, COLOR_HEX[cur.color]);
      }
      for (const d of debris) { ctx.save(); ctx.translate(Math.round(d.x + d.w / 2), Math.round(d.y + cam + BH / 2)); ctx.rotate(Math.round(d.r * 4) / 4); drawContainer(ctx, -d.w / 2, -BH / 2, d.w, BH, COLOR_HEX[d.color]); ctx.restore(); }
      for (const p of popups) text(ctx, p.s, p.x, p.y + cam, { align: 'center', color: p.c, size: 8 });
      hud(ctx, W, g.score, host.msLeft, 'H:' + (stack.length - 1));
      if (combo > 1) text(ctx, 'COMBO x' + combo, W / 2, 22 + 14, { align: 'center', color: PAL.yellow, size: 8 });
    },
  };
  function topY(i) { return 260 - i * BH; }
  function mix(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return `rgb(${r(16)},${r(8)},${r(0)})`; }
  function spawn() {
    const prev = stack[stack.length - 1]; const lvl = stack.length;
    const speed = Math.min(150, 55 + lvl * 4);
    const fromLeft = lvl % 2 === 0;
    cur = { x: fromLeft ? -prev.w * 0.3 : W - prev.w * 0.7, w: prev.w, v: fromLeft ? speed : -speed, color: CONTAINER_COLORS[Math.floor(Math.random() * CONTAINER_COLORS.length)] };
    camTarget = Math.max(0, (stack.length * BH) - 140);
  }
  function drop() { if (!cur || dropAnim) return; sfx('drop'); dropAnim = { t: 0 }; }
  function land(host) {
    const prev = stack[stack.length - 1]; const y = topY(stack.length);
    let dx = cur.x - prev.x;
    const ovL = Math.max(cur.x, prev.x), ovR = Math.min(cur.x + cur.w, prev.x + prev.w);
    if (ovR - ovL <= 1) { // pudło
      debris.push({ ...cur, y, vx: cur.v * 0.3, vy: 0, r: 0, vr: 3 }); cur = null; sfx('bad');
      popups.push({ s: 'PLUSK!', x: W / 2, y: y - 10, t: 0, c: PAL.red });
      host.end('Kontener wpadł do wody!'); return;
    }
    let pts = 10, perfect = false;
    if (Math.abs(dx) <= 2) { perfect = true; combo++; cur.x = prev.x; pts += 20 + 5 * Math.min(combo, 6); sfx('perfect');
      if (combo >= 3 && cur.w < BASE_W) { cur.w = Math.min(BASE_W, cur.w + 2); cur.x -= 1; } // nagroda: lekkie poszerzenie
      popups.push({ s: 'IDEALNIE!', x: W / 2, y: y - 10, t: 0, c: PAL.yellow });
    } else {
      combo = 0; sfx('good');
      if (cur.x < ovL) debris.push({ x: cur.x, w: ovL - cur.x, color: cur.color, y, vx: -30, vy: 0, r: 0, vr: -3 });
      if (cur.x + cur.w > ovR) debris.push({ x: ovR, w: cur.x + cur.w - ovR, color: cur.color, y, vx: 30, vy: 0, r: 0, vr: 3 });
      cur.x = ovL; cur.w = ovR - ovL;
      popups.push({ s: '+' + pts, x: cur.x + cur.w / 2, y: y - 10, t: 0, c: PAL.white });
    }
    g.score += pts;
    stack.push({ x: cur.x, w: cur.w, color: cur.color });
    if (cur.w < 3) { host.end('Za wąsko!'); cur = null; return; }
    spawn();
  }
  return g;
}
export const meta = { id: 'tower', name: 'Wieża kontenerów', desc: 'Stuknij, by opuścić kontener. Wystające części odpadną – celuj idealnie!', controls: 'Dotknij / klik / SPACJA', icon: 'tower' };
