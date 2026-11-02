import { api, auth, hasApi } from './api.js';
import { GameHost, PAL, COLOR_HEX, drawContainer, loadImages, sfx } from './engine.js';
import createTower, { meta as mTower } from './games/tower.js';
import createShip, { meta as mShip } from './games/ship.js';
import createCrane, { meta as mCrane } from './games/crane.js';
import createTruck, { meta as mTruck } from './games/truck.js';

const GAMES = { tower: [createTower, mTower], ship: [createShip, mShip], crane: [createCrane, mCrane], truck: [createTruck, mTruck] };
const $view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('pl-PL');
const fmtDate = (ms) => new Date(ms).toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
let host = null, serverCfg = null;

// --- ustawienia
const settings = {
  get crt() { return localStorage.getItem('pg_crt') !== '0'; }, set crt(v) { localStorage.setItem('pg_crt', v ? '1' : '0'); applySettings(); },
  get sound() { return localStorage.getItem('pg_sound') !== '0'; }, set sound(v) { localStorage.setItem('pg_sound', v ? '1' : '0'); },
};
function applySettings() { document.body.classList.toggle('crt', settings.crt); }
applySettings();

async function loadConfig() {
  if (!hasApi()) return null;
  try { serverCfg = await api('/api/config'); } catch { serverCfg = null; }
  const bar = document.getElementById('evbar');
  if (serverCfg) {
    const e = serverCfg.event; bar.hidden = false;
    bar.textContent = e.status === 'przed' ? `Start zawodów: ${fmtDate(e.start)}` : e.status === 'po' ? `Zawody zakończone ${fmtDate(e.end)} – dziękujemy za grę!` : `Zawody trwają do ${fmtDate(e.end)}`;
  }
  return serverCfg;
}

function setWho() {
  const u = auth.user;
  document.getElementById('who').innerHTML = u ? `⚓ ${esc(u.nick)}` : hasApi() ? '<a href="#/start">Zaloguj</a>' : 'tryb treningowy';
}
function setTab(r) { document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.r === r)); }

// --- miniatury gier (rysowane pikselowo)
async function drawThumb(cv, id) {
  const ctx = cv.getContext('2d'); cv.width = 96; cv.height = 48; ctx.imageSmoothingEnabled = false;
  const img = await loadImages(['trailer', 'truck_top', 'cone', 'parcel', 'cell_blue', 'cell_red', 'cell_navy', 'cell_orange', 'cell_green', 'ship_hull', 'water', 'road']);
  ctx.fillStyle = PAL.sky; ctx.fillRect(0, 0, 96, 48);
  const cols = ['blue', 'red', 'navy', 'orange', 'green', 'grey', 'yellow'];
  if (id === 'tower') {
    ctx.fillStyle = PAL.sea; ctx.fillRect(0, 42, 96, 6);
    let w = 34, x = 31; for (let i = 0; i < 6; i++) { drawContainer(ctx, x, 37 - i * 6, w, 6, COLOR_HEX[cols[i % 7]]); x += (i % 2 ? 2 : -1); w -= 2; }
    ctx.fillStyle = PAL.yellow; ctx.fillRect(0, 0, 96, 3); ctx.fillStyle = '#222'; ctx.fillRect(70, 3, 1, 4); drawContainer(ctx, 58, 7, 26, 6, COLOR_HEX.blue);
  } else if (id === 'ship') {
    for (let x = 0; x < 96; x += 16) ctx.drawImage(img.water, x, 36);
    const m = [[0, 0, 0, 1, 1, 0, 0, 0], [1, 1, 0, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1]];
    m.forEach((row, r) => row.forEach((v, c) => v && ctx.drawImage(img['cell_' + cols[(r + c) % 5]], 16 + c * 8, 12 + r * 8)));
    ctx.drawImage(img.cell_red, 40, 2); ctx.drawImage(img.cell_red, 48, 2); ctx.drawImage(img.cell_red, 48, -6);
    ctx.drawImage(img.ship_hull, 0, 0, 120, 15, 10, 36, 76, 9);
  } else if (id === 'crane') {
    ctx.fillStyle = '#6E757B'; ctx.fillRect(0, 36, 96, 12);
    ctx.drawImage(img.trailer, 40, 32);
    ctx.fillStyle = PAL.yellow; ctx.fillRect(0, 4, 96, 4); ctx.fillRect(4, 4, 3, 36); ctx.fillRect(89, 4, 3, 36);
    ctx.fillStyle = PAL.navy; ctx.fillRect(48, 2, 10, 4); ctx.fillStyle = '#222'; ctx.fillRect(53, 8, 1, 10);
    drawContainer(ctx, 41, 18, 24, 10, COLOR_HEX.blue);
  } else {
    ctx.fillStyle = '#6E757B'; ctx.fillRect(0, 0, 96, 48);
    for (let x = 24; x < 72; x += 16) for (let y = 0; y < 48; y += 16) ctx.drawImage(img.road, x, y);
    ctx.fillStyle = PAL.white; for (let y = 2; y < 48; y += 12) { ctx.fillRect(39, y, 1, 6); ctx.fillRect(55, y, 1, 6); }
    ctx.drawImage(img.truck_top, 41, 22); ctx.drawImage(img.cone, 27, 6); ctx.drawImage(img.parcel, 59, 12);
    drawContainer(ctx, 0, 6, 22, 8, COLOR_HEX.red); drawContainer(ctx, 74, 20, 22, 8, COLOR_HEX.blue); drawContainer(ctx, 0, 30, 22, 8, COLOR_HEX.green);
  }
}

// --- widoki
const views = {
  async start() {
    setTab('');
    if (!hasApi()) { $view.innerHTML = `<div class="panel"><h2>Tryb treningowy</h2><p>Brak skonfigurowanego serwera (plik <code>js/config.js</code>). Możesz grać, ale wyniki nie będą zapisywane.</p><a class="btn" href="#/gry">Do gier</a></div>`; return; }
    const needCode = serverCfg?.event?.requiresCode !== false;
    $view.innerHTML = `
    <div class="banner"><div class="title">${esc(window.PORT_CONFIG.EVENT_TITLE)}</div></div>
    <div class="panel light">
      <h2>Witaj na pokładzie!</h2>
      <p>Graj w portowe minigry, zbieraj punkty i walcz o pierwsze miejsce w rankingu firmy.</p>
      <div class="seg" role="tablist"><button id="t-login" class="on">LOGOWANIE</button><button id="t-reg">NOWE KONTO</button></div>
      <form id="f" autocomplete="off">
        <label for="nick">Nick (widoczny w rankingu)</label><input id="nick" maxlength="20" required placeholder="np. Kapitan_Konrad">
        <label for="pin">PIN (4–8 cyfr)</label><input id="pin" inputmode="numeric" pattern="\\d{4,8}" maxlength="8" type="password" required>
        <div id="regx" hidden>
          ${needCode ? '<label for="code">Kod wydarzenia (od organizatora)</label><input id="code" maxlength="30">' : ''}
          <label for="team">Dział / zespół (opcjonalnie)</label><input id="team" maxlength="30" placeholder="np. Customs, Warehouse">
        </div>
        <p class="err" id="err"></p>
        <button class="btn big" id="go">WCHODZĘ ▶</button>
      </form>
      <p class="muted">Nie podawaj prawdziwego hasła firmowego – PIN służy tylko do tej zabawy.</p>
    </div>`;
    let mode = 'login';
    const tl = document.getElementById('t-login'), tr = document.getElementById('t-reg');
    tl.onclick = (e) => { e.preventDefault(); mode = 'login'; tl.classList.add('on'); tr.classList.remove('on'); document.getElementById('regx').hidden = true; };
    tr.onclick = (e) => { e.preventDefault(); mode = 'register'; tr.classList.add('on'); tl.classList.remove('on'); document.getElementById('regx').hidden = false; };
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault(); const err = document.getElementById('err'); err.textContent = '';
      const v = (id) => (document.getElementById(id)?.value || '').trim();
      try {
        const r = await api('/api/' + mode, { nick: v('nick'), pin: v('pin'), code: v('code'), team: v('team') });
        auth.set(r.token, r.user); setWho(); location.hash = '#/gry';
      } catch (ex) { err.textContent = ex.message; }
    };
  },

  async gry() {
    setTab('gry');
    const best = {};
    if (hasApi() && auth.token) { try { (await api('/api/me')).games.forEach((g) => (best[g.game] = g.best)); } catch {} }
    $view.innerHTML = `
      <div class="banner"><div class="title">WYBIERZ GRĘ</div></div>
      ${!hasApi() ? '<div class="panel"><span class="tag">TRENING</span> Serwer nie jest skonfigurowany – wyniki nie są zapisywane.</div>' : !auth.token ? '<div class="panel"><a class="btn" href="#/start">ZALOGUJ SIĘ</a> aby Twoje wyniki trafiły do rankingu.</div>' : ''}
      <div class="games">${Object.values(GAMES).map(([, m]) => `
        <a class="card" href="#/gra/${m.id}">
          <canvas data-thumb="${m.id}"></canvas>
          <div class="c-body"><h3>${esc(m.name)}</h3><p>${esc(m.desc)}</p>
          <div class="best">Rekord: <b>${best[m.id] != null ? fmt(best[m.id]) : '—'}</b></div>
          <span class="btn">GRAJ ▶</span></div>
        </a>`).join('')}
      </div>`;
    document.querySelectorAll('[data-thumb]').forEach((c) => drawThumb(c, c.dataset.thumb));
  },

  async gra(id) {
    setTab('gry');
    const entry = GAMES[id]; if (!entry) { location.hash = '#/gry'; return; }
    const [create, m] = entry;
    document.body.classList.add('playing');
    $view.innerHTML = `
      <div class="game-stage">
        <div class="gbar"><a class="btn navy" href="#/gry">◀</a><h2>${esc(m.name)}</h2><a class="btn navy" href="#/ranking?g=${id}">TOP</a></div>
        <div class="canvas-box" id="box"><div class="overlay" id="ov"><p class="muted">Ładowanie…</p></div></div>
        <div class="muted" style="font-size:18px">Sterowanie: ${esc(m.controls)}</div>
      </div>`;
    const box = document.getElementById('box'), ov = document.getElementById('ov');
    const online = hasApi() && !!auth.token;
    let session = null;
    const startRound = async () => {
      host?.destroy(); box.querySelector('canvas')?.remove();
      ov.hidden = false; ov.innerHTML = '<p class="muted">Przygotowanie…</p>';
      session = null;
      if (online) {
        try { session = (await api('/api/session/start', { game: id })).session; }
        catch (e) { ov.innerHTML = `<div class="big">!</div><p>${esc(e.message)}</p><button class="btn" id="tr">GRAJ TRENINGOWO</button><a class="btn white" href="#/gry">WRÓĆ</a>`; document.getElementById('tr').onclick = () => run(); if (e.status === 401) setWho(); return; }
      }
      run();
    };
    const run = async () => {
      host = new GameHost(box, create(), { onEnd: finish });
      box.insertBefore(host.canvas, ov);
      await host.start();
      for (const n of ['3', '2', '1']) { ov.innerHTML = `<div class="big">${n}</div><p>${esc(m.desc)}</p><p class="muted">${session ? 'Gra rankingowa' : 'Gra treningowa'}</p>`; sfx('tick'); await new Promise((r) => setTimeout(r, 650)); if (!document.body.contains(box)) return; }
      ov.hidden = true; host.begin();
    };
    const finish = async (score, reason) => {
      ov.hidden = false;
      ov.innerHTML = `<div class="big">${fmt(score)}</div><p>${esc(reason)}</p><p id="sv" class="muted">${session ? 'Zapisywanie wyniku…' : 'Tryb treningowy – wynik niezapisany.'}</p>
        <div><button class="btn" id="again">JESZCZE RAZ</button><a class="btn white" href="#/gry">INNA GRA</a></div>`;
      document.getElementById('again').onclick = startRound;
      if (session) {
        const sv = document.getElementById('sv');
        try { const r = await api('/api/score', { session, score });
          sv.className = 'ok'; sv.textContent = `${r.newBest ? 'NOWY REKORD! ' : ''}Twój najlepszy: ${fmt(r.best)} · miejsce #${r.rank}`; }
        catch (e) { sv.className = 'err'; sv.textContent = 'Nie zapisano: ' + e.message; }
        session = null;
      }
    };
    startRound();
  },

  async ranking(_, q) {
    setTab('ranking');
    const game = q.get('g') || 'all', limit = q.get('n') || '10';
    const tabs = [['all', 'OGÓLNY'], ...Object.values(GAMES).map(([, m]) => [m.id, m.name.toUpperCase()])];
    $view.innerHTML = `<div class="panel"><h2>Ranking</h2>
      <div class="row">${tabs.map(([k, n]) => `<a class="btn ${k === game ? '' : 'navy'}" href="#/ranking?g=${k}&n=${limit}">${esc(n)}</a>`).join('')}</div>
      <div class="row" style="margin-top:8px"><span class="muted">Pokaż:</span>${['10', '50'].map((n) => `<a class="btn ${n === limit ? 'white' : 'navy'}" href="#/ranking?g=${game}&n=${n}">TOP ${n}</a>`).join('')}</div>
      <div id="tbl" style="margin-top:14px"><p class="muted">Ładowanie…</p></div>
      ${game === 'all' ? '<p class="muted">Wynik ogólny = suma Twoich rekordów ze wszystkich gier.</p>' : ''}</div>`;
    const tbl = document.getElementById('tbl');
    if (!hasApi()) { tbl.innerHTML = '<p>Ranking dostępny po podłączeniu serwera.</p>'; return; }
    try {
      const r = await api(`/api/leaderboard?game=${game}&limit=${limit}`);
      const me = auth.user;
      const medal = (i) => i <= 3 ? `<span class="medal" style="background:${['#D9B23A', '#C9D2D8', '#C07A3A'][i - 1]}"></span>` : '';
      tbl.innerHTML = r.top.length ? `<table class="rank"><tr><th>#</th><th>Gracz</th><th class="n">Punkty</th></tr>
        ${r.top.map((x) => `<tr class="${me && x.nick === me.nick ? 'me' : ''}"><td>${medal(x.rank)}${x.rank}</td><td>${esc(x.nick)}${x.team ? ` <span class="muted">· ${esc(x.team)}</span>` : ''}</td><td class="n">${fmt(x.score)}</td></tr>`).join('')}</table>
        <p>${r.me ? `Twoje miejsce: <b>#${r.me.rank}</b> z ${r.total} (${fmt(r.me.score)} pkt)` : me ? 'Nie masz jeszcze wyniku w tej kategorii.' : ''}</p>` : '<p>Brak wyników – bądź pierwszy!</p>';
    } catch (e) { tbl.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  },

  async profil() {
    setTab('profil');
    if (!hasApi()) { $view.innerHTML = '<div class="panel"><h2>Profil</h2><p>Dostępny po podłączeniu serwera.</p></div>'; return; }
    if (!auth.token) { location.hash = '#/start'; return; }
    $view.innerHTML = '<div class="panel"><p>Ładowanie…</p></div>';
    try {
      const r = await api('/api/me'); const by = Object.fromEntries(r.games.map((g) => [g.game, g]));
      const total = r.games.reduce((a, g) => a + g.best, 0);
      let rank = null; try { rank = (await api('/api/leaderboard?game=all&limit=1')).me; } catch {}
      $view.innerHTML = `<div class="panel light"><h2>${esc(r.user.nick)}</h2>
        <p>${r.user.team ? esc(r.user.team) + ' · ' : ''}Suma rekordów: <b>${fmt(total)}</b>${rank ? ` · miejsce ogólne <b>#${rank.rank}</b>` : ''}</p>
        <table class="rank"><tr><th>Gra</th><th class="n">Rekord</th><th class="n">Gier</th></tr>
        ${Object.values(GAMES).map(([, m]) => `<tr><td>${esc(m.name)}</td><td class="n">${by[m.id] ? fmt(by[m.id].best) : '—'}</td><td class="n">${by[m.id]?.plays || 0}</td></tr>`).join('')}</table></div>
        <div class="panel"><h3>Ostatnie gry</h3>${r.recent.length ? `<table class="rank">${r.recent.map((s) => `<tr><td>${esc(GAMES[s.game]?.[1].name || s.game)}</td><td class="n">${fmt(s.score)}</td><td class="n muted">${new Date(s.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</td></tr>`).join('')}</table>` : '<p class="muted">Jeszcze nic – czas zagrać!</p>'}
        <p><button class="btn navy" id="out">WYLOGUJ</button></p></div>`;
      document.getElementById('out').onclick = () => { auth.clear(); setWho(); location.hash = '#/start'; };
    } catch (e) { $view.innerHTML = `<div class="panel"><p class="err">${esc(e.message)}</p><a class="btn" href="#/start">Zaloguj ponownie</a></div>`; }
  },

  async regulamin() {
    setTab('regulamin');
    const e = serverCfg?.event;
    $view.innerHTML = `<div class="panel light"><h2>Regulamin zabawy</h2>
      <ol>
        <li>To <b>nieoficjalne wydarzenie integracyjne</b> organizowane przez pracowników dla pracowników. Nie jest to oficjalna inicjatywa ani serwis firmy.</li>
        <li>Zawody trwają ${e ? `od <b>${fmtDate(e.start)}</b> do <b>${fmtDate(e.end)}</b>` : 'w terminie ogłoszonym przez organizatora'}.</li>
        <li>Rejestrujesz się nickiem i PIN-em. Jedna osoba = jedno konto. Nie używaj hasła firmowego ani danych wrażliwych.</li>
        <li>W każdej grze liczy się Twój <b>najlepszy wynik</b>. Ranking ogólny to suma rekordów ze wszystkich gier – opłaca się zagrać w każdą!</li>
        <li>Jedna runda trwa 60–90 sekund (lub krócej, jeśli przegrasz wcześniej).</li>
        <li>Zakazane są boty, skrypty, modyfikowanie gry i inne kombinacje. Serwer sprawdza wyniki, a organizator może usunąć podejrzane wpisy.</li>
        <li>Grajcie fair, w przerwach i z uśmiechem. Praca ma pierwszeństwo ⚓</li>
      </ol></div>
      <div class="panel"><h2>Gry</h2>${Object.values(GAMES).map(([, m]) => `<h3>${esc(m.name)}</h3><p>${esc(m.desc)}<br><span class="muted">Sterowanie: ${esc(m.controls)}</span></p>`).join('')}</div>`;
  },

  async ustawienia() {
    setTab('ustawienia');
    $view.innerHTML = `<div class="panel"><h2>Ustawienia</h2>
      <label class="switch"><input type="checkbox" id="crt" ${settings.crt ? 'checked' : ''}> Filtr retro (linie CRT + dithering)</label>
      <label class="switch"><input type="checkbox" id="snd" ${settings.sound ? 'checked' : ''}> Dźwięki 8-bit</label>
      <p class="muted">Test czcionki: Zażółć gęślą jaźń · ĄĘŁŃÓŚŹŻ</p>
      <p class="muted">Serwer: ${hasApi() ? esc(window.PORT_CONFIG.API_URL) : 'brak (tryb treningowy)'}</p></div>`;
    document.getElementById('crt').onchange = (e) => (settings.crt = e.target.checked);
    document.getElementById('snd').onchange = (e) => (settings.sound = e.target.checked);
  },
};

async function route() {
  host?.destroy(); host = null; document.body.classList.remove('playing');
  const [path, qs] = (location.hash.slice(2) || '').split('?');
  const [name, arg] = path.split('/');
  const q = new URLSearchParams(qs || '');
  let v = name || (hasApi() && !auth.token ? 'start' : 'gry');
  if (!views[v]) v = 'gry';
  setWho(); window.scrollTo(0, 0);
  await views[v](arg, q);
}
window.addEventListener('hashchange', route);
await Promise.all([document.fonts.load('10px PS2P'), document.fonts.load('16px VT323'), document.fonts.load('700 16px Pixelify')]).catch(() => {});
await loadConfig();
route();
