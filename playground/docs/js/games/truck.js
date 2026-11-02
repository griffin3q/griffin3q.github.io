// Dostawa – prowadź ciężarówkę przez terminal, omijaj przeszkody i zbieraj paczki.
import { PAL, COLOR_HEX, CONTAINER_COLORS, drawContainer, text, hud, sfx, loadImages } from '../engine.js';

export default function createTruck() {
  const W = 180, H = 320, LANES = [60, 90, 120], PY = 250;
  let img, lane, px, speed, dist, objs, spawnT, lives, inv, popups, scroll, side, swipe, parcels;
  const g = {
    id: 'truck', W, H, roundMs: 60000, score: 0,
    async load() { img = await loadImages(['truck_top', 'cone', 'barrel', 'forklift', 'parcel', 'road', 'quay', 'water']); },
    init() {
      g.score = 0; lane = 1; px = LANES[1]; speed = 70; dist = 0; objs = []; spawnT = 1; lives = 3; inv = 0; popups = []; scroll = 0; parcels = 0;
      side = []; for (let y = -40; y < H + 40; y += 40) side.push(mkSide(y));
    },
    onDown(x, y, id) { swipe = { x, y, id, used: false }; },
    onMove(x, y, id) { if (swipe && swipe.id === id && !swipe.used && Math.abs(x - swipe.x) > 14) { move(x > swipe.x ? 1 : -1); swipe.used = true; } },
    onUp(x, y, id) { if (swipe && swipe.id === id && !swipe.used) move(x < W / 2 ? -1 : 1); swipe = null; },
    onKey(code, down) { if (!down) return; if (code === 'ArrowLeft' || code === 'KeyA') move(-1); if (code === 'ArrowRight' || code === 'KeyD') move(1); },
    update(dt, host) {
      speed = Math.min(190, 70 + host.elapsed / 1000 * 2.2);
      const dy = speed * dt; dist += dy; scroll += dy; g.score += dy / 8;
      px += (LANES[lane] - px) * Math.min(1, dt * 14);
      inv = Math.max(0, inv - dt);
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.42, 1.15 - host.elapsed / 1000 * 0.012) * (0.8 + Math.random() * 0.4);
        const free = [0, 1, 2]; const l = free.splice(Math.floor(Math.random() * 3), 1)[0];
        const r = Math.random();
        const type = r < 0.3 ? 'parcel' : r < 0.6 ? 'cone' : r < 0.85 ? 'barrel' : 'forklift';
        objs.push({ type, lane: l, x: LANES[l], y: -20, vx: type === 'forklift' ? (Math.random() < 0.5 ? -14 : 14) : 0 });
        if (Math.random() < Math.min(0.5, host.elapsed / 120000) && type !== 'parcel') { const l2 = free[Math.floor(Math.random() * 2)]; objs.push({ type: 'cone', lane: l2, x: LANES[l2], y: -20, vx: 0 }); }
      }
      for (const o of objs) {
        o.y += dy; o.x += o.vx * dt; if (o.x < LANES[0] - 6 || o.x > LANES[2] + 6) o.vx *= -1;
        if (!o.hit && Math.abs(o.y - PY) < (o.type === 'forklift' ? 18 : 15) && Math.abs(o.x - px) < 13) {
          o.hit = true;
          if (o.type === 'parcel') { g.score += 40; parcels++; sfx('coin'); popups.push({ s: '+40', x: o.x, y: PY - 20, t: 0, c: PAL.yellow }); o.gone = true; }
          else if (inv <= 0) { lives--; inv = 1.4; sfx('bad'); popups.push({ s: 'BUM!', x: px, y: PY - 24, t: 0, c: PAL.red }); if (lives <= 0) host.end('Ciężarówka rozbita!'); }
        }
      }
      objs = objs.filter((o) => o.y < H + 30 && !o.gone);
      for (const s of side) { s.y += dy; if (s.y > H + 40) Object.assign(s, mkSide(s.y - (side.length * 40))); }
      for (const p of popups) { p.t += dt; p.y -= 20 * dt; } popups = popups.filter((p) => p.t < 0.8);
    },
    draw(ctx, host) {
      // pobocza – plac kontenerowy
      if (img.quay) for (let x = 0; x < W; x += 16) for (let y = -16 + (scroll % 16); y < H; y += 16) ctx.drawImage(img.quay, x, Math.floor(y));
      for (const s of side) s.items.forEach((it) => drawContainer(ctx, it.x, Math.floor(s.y + it.y), it.w, it.h, COLOR_HEX[it.c]));
      // droga
      if (img.road) for (let x = 42; x < 138; x += 16) for (let y = -16 + (scroll % 16); y < H; y += 16) ctx.drawImage(img.road, x, Math.floor(y), Math.min(16, 138 - x), 16);
      ctx.fillStyle = PAL.yellow; ctx.fillRect(42, 0, 2, H); ctx.fillRect(136, 0, 2, H);
      ctx.fillStyle = PAL.white; for (let y = -20 + (scroll % 20); y < H; y += 20) { ctx.fillRect(74, Math.floor(y), 2, 10); ctx.fillRect(104, Math.floor(y), 2, 10); }
      for (const o of objs) { const im = img[o.type]; if (im) ctx.drawImage(im, Math.round(o.x - im.width / 2), Math.round(o.y - im.height / 2)); }
      if (!(inv > 0 && Math.floor(inv * 10) % 2)) { const im = img.truck_top; if (im) ctx.drawImage(im, Math.round(px - 7), PY - 12); }
      for (const p of popups) text(ctx, p.s, p.x, p.y, { align: 'center', color: p.c, size: 8 });
      hud(ctx, W, Math.floor(g.score), host.msLeft, '');
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < lives ? PAL.red : '#33485a'; ctx.fillRect(70 + i * 14, 5, 10, 7); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(70 + i * 14, 11, 10, 1); }
      text(ctx, Math.floor(dist / 10) + ' m', 4, 20, { size: 6, color: PAL.white });
    },
  };
  function mkSide(y) {
    const items = [];
    for (const base of [2, 140]) { let yy = 0; while (yy < 36) { const c = CONTAINER_COLORS[Math.floor(Math.random() * CONTAINER_COLORS.length)]; if (Math.random() < 0.75) items.push({ x: base + (Math.random() < 0.5 ? 0 : 14), y: yy, w: 24, h: 10, c }); yy += 12; } }
    return { y, items };
  }
  function move(d) { const n = Math.max(0, Math.min(2, lane + d)); if (n !== lane) { lane = n; sfx('tick'); } }
  return g;
}
export const meta = { id: 'truck', name: 'Dostawa', desc: 'Przejedź przez terminal: omijaj pachołki, beczki i wózki widłowe, zbieraj paczki.', controls: 'Stuknij lewo/prawo, przesuń palcem, strzałki', icon: 'truck' };
