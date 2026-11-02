// Suwnica – jeździj wózkiem suwnicy i zrzucaj kontenery prosto na naczepy przejeżdżających ciężarówek.
import { PAL, COLOR_HEX, CONTAINER_COLORS, drawContainer, text, hud, sfx, loadImages, button, inside } from '../engine.js';

export default function createCrane() {
  const W = 180, H = 320, BEAM_Y = 44, ROAD_Y = 250, ROPE = 70;
  let img, trolley, vel, ang, angV, load, falling, trucks, spawnT, popups, held, btns, combo, delivered, t = 0, missed;
  const g = {
    id: 'crane', W, H, roundMs: 60000, score: 0,
    async load() { img = await loadImages(['trailer', 'water', 'quay', 'road', 'container_blue', 'container_red', 'container_grey', 'container_orange', 'container_green', 'ship_hull']); },
    init() {
      g.score = 0; trolley = 60; vel = 0; ang = 0; angV = 0; falling = []; trucks = []; spawnT = 0.3; popups = []; held = {}; combo = 0; delivered = 0; missed = 0;
      newLoad();
      btns = [{ id: 'L', label: '<', x: 4, y: 276, w: 50, h: 38 }, { id: 'D', label: 'ZRZUĆ', x: 60, y: 276, w: 60, h: 38 }, { id: 'R', label: '>', x: 126, y: 276, w: 50, h: 38 }];
    },
    onDown(x, y, id) { const b = btns.find((b) => inside(b, x, y)); if (b) { if (b.id === 'D') release(); else held[id] = b.id; } else if (y < 270) { held[id] = x < trolley ? 'L' : 'R'; } },
    onUp(x, y, id) { delete held[id]; },
    onKey(code, down) {
      if (code === 'ArrowLeft' || code === 'KeyA') down ? (held.kl = 'L') : delete held.kl;
      if (code === 'ArrowRight' || code === 'KeyD') down ? (held.kr = 'R') : delete held.kr;
      if (down && (code === 'Space' || code === 'ArrowDown' || code === 'Enter')) release();
    },
    update(dt) {
      t += dt;
      const dir = Object.values(held); const ax = (dir.includes('R') ? 1 : 0) - (dir.includes('L') ? 1 : 0);
      const pv = vel;
      vel += ax * 260 * dt; vel *= Math.pow(ax ? 0.5 : 0.02, dt); vel = Math.max(-90, Math.min(90, vel));
      trolley += vel * dt; if (trolley < 14) { trolley = 14; vel = 0; } if (trolley > W - 14) { trolley = W - 14; vel = 0; }
      // wahadło: przyspieszenie wózka rozbuja ładunek
      const acc = (vel - pv) / Math.max(dt, 1e-3);
      angV += (-9.8 * 9 / ROPE * Math.sin(ang) - acc / ROPE * 0.9) * dt; angV *= Math.pow(0.35, dt); ang += angV * dt;
      ang = Math.max(-0.6, Math.min(0.6, ang));
      if (!load && !falling.some((f) => !f.done)) { load = load || null; }
      // ciężarówki
      spawnT -= dt;
      if (spawnT <= 0) { const sp = 22 + Math.min(40, t * 0.6) + Math.random() * 10; trucks.push({ x: W + 4, v: sp, got: null }); spawnT = 3.2 + Math.random() * 1.6 - Math.min(1.2, t * 0.02); }
      trucks.forEach((tr) => { tr.x -= tr.v * dt; });
      trucks = trucks.filter((tr) => tr.x > -60);
      // spadające kontenery
      for (const f of falling) {
        if (f.done) { if (f.onTruck) f.x = f.onTruck.x + f.off; continue; }
        f.vy += 300 * dt; f.y += f.vy * dt; f.x += f.vx * dt;
        const deckY = ROAD_Y - 12;
        if (f.y >= deckY && f.y - f.vy * dt < deckY + 2) {
          const tr = trucks.find((tr) => !tr.got && f.x + 12 > tr.x && f.x + 12 < tr.x + 33);
          if (tr) {
            const off = (f.x + 12) - (tr.x + 16.5); const a = Math.abs(off);
            if (a <= 7) {
              f.y = deckY; f.done = true; f.onTruck = tr; f.off = f.x - tr.x; tr.got = f; tr.v += 25;
              let pts = Math.round(60 + (7 - a) / 7 * 90); const perfect = a <= 1.5;
              if (perfect) { combo++; pts += 20 * Math.min(combo, 5); } else combo = 0;
              g.score += pts; delivered++;
              popups.push({ s: perfect ? 'IDEALNIE +' + pts : '+' + pts, x: tr.x + 16, y: deckY - 12, t: 0, c: perfect ? PAL.yellow : PAL.white });
              sfx(perfect ? 'perfect' : 'good');
            }
          }
        }
        if (!f.done && f.y > ROAD_Y + 2) { f.done = true; f.crash = true; f.y = ROAD_Y - 4; combo = 0; missed++; popups.push({ s: 'PUDŁO', x: f.x + 12, y: ROAD_Y - 22, t: 0, c: PAL.red }); sfx('bad'); }
      }
      falling = falling.filter((f) => !(f.crash && (f.fade = (f.fade || 0) + dt) > 1.2) && !(f.onTruck && f.onTruck.x < -55));
      for (const p of popups) { p.t += dt; p.y -= 14 * dt; } popups = popups.filter((p) => p.t < 1);
      if (!load) { g.reload = (g.reload || 0) + dt; if (g.reload > 0.55) { g.reload = 0; newLoad(); } }
    },
    draw(ctx, host) {
      ctx.fillStyle = PAL.sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#B5E2F1'; ctx.fillRect(0, 150, W, 100);
      // statek w tle (lewa) – z niego zdejmujemy kontenery
      ctx.fillStyle = PAL.sea; ctx.fillRect(0, 214, W, 20);
      if (img.ship_hull) ctx.drawImage(img.ship_hull, 0, 0, 120, 15, -50, 200, 120, 15);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) drawContainer(ctx, -40 + i * 26, 180 + j * 10, 24, 10, COLOR_HEX[CONTAINER_COLORS[(i * 2 + j + delivered) % CONTAINER_COLORS.length]]);
      // nabrzeże i droga
      if (img.quay) for (let x = 0; x < W; x += 16) ctx.drawImage(img.quay, x, 230);
      if (img.road) for (let x = 0; x < W; x += 16) { ctx.drawImage(img.road, x, ROAD_Y - 4); ctx.drawImage(img.road, x, ROAD_Y + 6); }
      ctx.fillStyle = PAL.white; for (let x = (-(t * 30) % 12); x < W; x += 12) ctx.fillRect(x, ROAD_Y + 10, 6, 1);
      // nogi suwnicy
      ctx.fillStyle = PAL.yellow; ctx.fillRect(4, BEAM_Y, 4, ROAD_Y - BEAM_Y + 2); ctx.fillRect(W - 8, BEAM_Y, 4, ROAD_Y - BEAM_Y + 2);
      ctx.fillStyle = '#A88A2A'; for (let y = BEAM_Y + 4; y < ROAD_Y; y += 8) { ctx.fillRect(4, y, 4, 1); ctx.fillRect(W - 8, y, 4, 1); }
      // ciężarówki
      for (const tr of trucks) { if (img.trailer) ctx.drawImage(img.trailer, Math.round(tr.x), ROAD_Y - 7); }
      // znacznik środka naczepy (pomoc)
      for (const tr of trucks) if (!tr.got) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(Math.round(tr.x + 16), ROAD_Y - 9, 1, 2); }
      for (const f of falling) { ctx.globalAlpha = f.fade ? Math.max(0, 1 - f.fade) : 1; drawContainer(ctx, f.x, f.y, 24, 10, COLOR_HEX[f.color]); ctx.globalAlpha = 1; }
      // belka
      ctx.fillStyle = PAL.yellow; ctx.fillRect(0, BEAM_Y - 8, W, 8); ctx.fillStyle = '#A88A2A'; for (let x = 0; x < W; x += 6) ctx.fillRect(x, BEAM_Y - 7, 3, 6);
      ctx.fillStyle = PAL.navy; ctx.fillRect(Math.round(trolley) - 8, BEAM_Y - 10, 16, 8);
      ctx.fillStyle = PAL.blue; ctx.fillRect(Math.round(trolley) - 7, BEAM_Y - 9, 5, 3);
      // lina + ładunek
      const lx = trolley + Math.sin(ang) * ROPE, ly = BEAM_Y + Math.cos(ang) * ROPE;
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(trolley) + 0.5, BEAM_Y); ctx.lineTo(Math.round(lx) + 0.5, Math.round(ly)); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.fillRect(Math.round(lx) - 13, Math.round(ly), 26, 2);
      if (load) {
        drawContainer(ctx, lx - 12, ly + 2, 24, 10, COLOR_HEX[load.color]);
        // linia celownicza
        ctx.fillStyle = 'rgba(255,255,255,.25)'; for (let y = ly + 14; y < ROAD_Y - 8; y += 6) ctx.fillRect(Math.round(lx), y, 1, 3);
      }
      for (const p of popups) text(ctx, p.s, p.x, p.y, { align: 'center', color: p.c, size: 6 });
      ctx.fillStyle = PAL.navy; ctx.fillRect(0, 268, W, H - 268);
      hud(ctx, W, g.score, host.msLeft, 'ZAŁ. ' + delivered);
      const pressed = new Set(Object.values(held)); btns.forEach((b) => button(ctx, b, pressed.has(b.id)));
    },
  };
  function newLoad() { load = { color: CONTAINER_COLORS[Math.floor(Math.random() * CONTAINER_COLORS.length)] }; }
  function release() {
    if (!load) return;
    const lx = trolley + Math.sin(ang) * ROPE, ly = BEAM_Y + Math.cos(ang) * ROPE;
    falling.push({ x: lx - 12, y: ly + 2, vx: vel + Math.cos(ang) * angV * ROPE * 0.5, vy: 0, color: load.color });
    load = null; sfx('drop');
  }
  return g;
}
export const meta = { id: 'crane', name: 'Suwnica', desc: 'Jeździj suwnicą i zrzucaj kontenery na naczepy. Uważaj na bujanie ładunku!', controls: '◀ ▶ / strzałki, ZRZUĆ / SPACJA', icon: 'crane' };
