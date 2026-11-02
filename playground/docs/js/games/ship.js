// Załadunek statku – układaj zestawy kontenerów w ładowni. Pełny rząd = zabezpieczony ładunek.
import { PAL, text, hud, sfx, loadImages, button, inside } from '../engine.js';

const SHAPES = [
  { c: 'blue',   m: [[1, 1, 1, 1]] },
  { c: 'navy',   m: [[1, 1], [1, 1]] },
  { c: 'red',    m: [[1, 1, 1], [0, 1, 0]] },
  { c: 'orange', m: [[1, 0], [1, 0], [1, 1]] },
  { c: 'green',  m: [[0, 1], [0, 1], [1, 1]] },
  { c: 'yellow', m: [[1, 1, 0], [0, 1, 1]] },
  { c: 'grey',   m: [[0, 1, 1], [1, 1, 0]] },
  { c: 'blue',   m: [[1, 1, 1]] },
];
export default function createShip() {
  const W = 180, H = 320, COLS = 10, ROWS = 13, CS = 16, GX = 10, GY = 30;
  let img, grid, piece, next, fallT, fallEvery, lines, flash, btns, held, repT, lockT, t = 0, softDrop;
  const g = {
    id: 'ship', W, H, roundMs: 90000, score: 0,
    async load() { img = await loadImages(['cell_blue', 'cell_navy', 'cell_red', 'cell_orange', 'cell_green', 'cell_yellow', 'cell_grey', 'ship_hull', 'water', 'star']); },
    init() {
      g.score = 0; lines = 0; flash = []; held = {}; fallT = 0; fallEvery = 0.8; repT = 0; lockT = 0;
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      next = rnd(); newPiece();
      const by = 276, bw = 40, bh = 36;
      btns = [
        { id: 'L', label: '<', x: 4, y: by, w: bw, h: bh }, { id: 'R', label: '>', x: 48, y: by, w: bw, h: bh },
        { id: 'O', label: 'OBRÓĆ', x: 92, y: by, w: 46, h: bh }, { id: 'D', label: 'V', x: 142, y: by, w: 34, h: bh },
      ];
    },
    onDown(x, y, id) { const b = btns.find((b) => inside(b, x, y)); if (b) { held[id] = b.id; press(b.id); repT = 0.18; } },
    onUp(x, y, id) { delete held[id]; },
    onKey(code, down) {
      if (!down) { if (code === 'ArrowDown' || code === 'KeyS') softDrop = false; return; }
      if (code === 'ArrowLeft' || code === 'KeyA') press('L');
      else if (code === 'ArrowRight' || code === 'KeyD') press('R');
      else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyX') press('O');
      else if (code === 'Space') hardDrop();
      else if (code === 'ArrowDown' || code === 'KeyS') softDrop = true;
    },
    update(dt, host) {
      t += dt;
      const hb = Object.values(held);
      if (hb.length) { repT -= dt; if (repT <= 0) { repT = 0.07; hb.forEach((b) => b !== 'O' && press(b)); } }
      const fast = softDrop || hb.includes('D');
      fallT += dt;
      if (fallT >= (fast ? 0.05 : fallEvery)) { fallT = 0; if (!step(host) && fast) {} }
      flash = flash.filter((f) => (f.t -= dt) > 0);
    },
    draw(ctx, host) {
      ctx.fillStyle = PAL.sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#A9DDEE'; ctx.fillRect(0, 180, W, 80);
      // morze
      if (img.water) for (let x = 0; x < W; x += 16) for (let y = 246; y < H; y += 16) ctx.drawImage(img.water, x, y);
      // ładownia
      ctx.fillStyle = '#123E5E'; ctx.fillRect(GX - 2, GY - 2, COLS * CS + 4, ROWS * CS + 4);
      ctx.fillStyle = '#0D3350'; for (let c = 0; c < COLS; c++) ctx.fillRect(GX + c * CS, GY, 1, ROWS * CS);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c]) cell(ctx, c, r, grid[r][c]);
      // cień spadania
      if (piece) {
        let gy = piece.y; while (fits(piece.m, piece.x, gy + 1)) gy++;
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        piece.m.forEach((row, r) => row.forEach((v, c) => v && ctx.fillRect(GX + (piece.x + c) * CS + 1, GY + (gy + r) * CS + 1, CS - 2, CS - 2)));
        piece.m.forEach((row, r) => row.forEach((v, c) => v && piece.y + r >= 0 && cell(ctx, piece.x + c, piece.y + r, piece.c)));
      }
      for (const f of flash) { ctx.fillStyle = `rgba(255,255,255,${f.t * 2})`; ctx.fillRect(GX, GY + f.r * CS, COLS * CS, CS); }
      if (img.ship_hull) ctx.drawImage(img.ship_hull, 0, 0, 120, 15, GX - 6, GY + ROWS * CS + 2, COLS * CS + 12, 12);
      ctx.fillStyle = PAL.navy; ctx.fillRect(0, 270, W, H - 270);
      hud(ctx, W, g.score, host.msLeft, 'LINIE ' + lines);
      // następny
      ctx.fillStyle = PAL.navy; ctx.fillRect(W - 44, 18, 44, 12);
      text(ctx, 'NAST:', W - 43, 20, { size: 5, color: PAL.ice, shadow: null });
      next.m.forEach((row, r) => row.forEach((v, c) => { if (v && r < 3) { ctx.fillStyle = PAL.blue; ctx.fillRect(W - 18 + c * 3, 19 + r * 3, 3, 3); } }));
      const pressed = new Set(Object.values(held));
      btns.forEach((b) => button(ctx, b, pressed.has(b.id)));
    },
  };
  function cell(ctx, c, r, col) { const im = img['cell_' + col]; if (im) ctx.drawImage(im, GX + c * CS, GY + r * CS, CS, CS); else { ctx.fillStyle = PAL.blue; ctx.fillRect(GX + c * CS, GY + r * CS, CS, CS); } }
  function rnd() { const s = SHAPES[Math.floor(Math.random() * SHAPES.length)]; return { c: s.c, m: s.m.map((r) => r.slice()) }; }
  function newPiece() { piece = next; piece.x = Math.floor((COLS - piece.m[0].length) / 2); piece.y = -piece.m.length + 1; next = rnd(); return fits(piece.m, piece.x, piece.y); }
  function fits(m, x, y) {
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c]) {
      const gx = x + c, gy = y + r; if (gx < 0 || gx >= COLS || gy >= ROWS) return false; if (gy >= 0 && grid[gy][gx]) return false;
    }
    return true;
  }
  function press(id) {
    if (!piece) return;
    if (id === 'L' && fits(piece.m, piece.x - 1, piece.y)) { piece.x--; sfx('tick'); }
    if (id === 'R' && fits(piece.m, piece.x + 1, piece.y)) { piece.x++; sfx('tick'); }
    if (id === 'O') { const m = piece.m[0].map((_, c) => piece.m.map((row) => row[c]).reverse());
      for (const k of [0, -1, 1, -2, 2]) if (fits(m, piece.x + k, piece.y)) { piece.m = m; piece.x += k; sfx('tick'); break; } }
  }
  let hostRef;
  function hardDrop() { if (!piece) return; while (fits(piece.m, piece.x, piece.y + 1)) { piece.y++; g.score += 1; } lock(hostRef); }
  function step(host) { hostRef = host; if (fits(piece.m, piece.x, piece.y + 1)) { piece.y++; return true; } lock(host); return false; }
  function lock(host) {
    hostRef = host || hostRef;
    let over = false;
    piece.m.forEach((row, r) => row.forEach((v, c) => { if (v) { if (piece.y + r < 0) over = true; else grid[piece.y + r][piece.x + c] = piece.c; } }));
    g.score += 5; sfx('drop');
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) if (grid[r].every(Boolean)) { grid.splice(r, 1); grid.unshift(Array(COLS).fill(null)); flash.push({ r: r + cleared, t: 0.3 }); cleared++; r++; }
    if (cleared) { lines += cleared; g.score += [0, 100, 250, 450, 700][cleared]; sfx('line'); fallEvery = Math.max(0.18, 0.8 - lines * 0.04); }
    if (over || !newPiece()) { piece = null; hostRef && hostRef.end('Ładownia pełna!'); }
  }
  const origUpdate = g.update; g.update = (dt, host) => { hostRef = host; origUpdate(dt, host); };
  return g;
}
export const meta = { id: 'ship', name: 'Załadunek statku', desc: 'Układaj zestawy kontenerów w ładowni. Pełny rząd = punkty i miejsce na więcej.', controls: 'Przyciski / strzałki, ↑ obrót, SPACJA zrzut', icon: 'ship' };
