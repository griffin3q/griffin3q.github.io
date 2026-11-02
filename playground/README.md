# Port Games ⚓ – portowe minigry dla pracowników

Tymczasowa strona zawodów: pracownicy logują się nickiem + PIN-em, grają w 4 pikselowe minigry
i rywalizują w rankingu. **Nieoficjalne wydarzenie pracownicze** – strona nie jest oficjalnym serwisem
ani produktem A.P. Moller – Maersk i nie używa oficjalnego logo (gwiazdka w grafice jest narysowana od zera).

* Frontend: czysty HTML/CSS/JS (bez budowania) w folderze `docs/` → **GitHub Pages**
* Backend: **Cloudflare Worker + D1 (SQLite)** w folderze `worker/`

## Gry
| ID | Nazwa | Runda | Sterowanie |
|----|-------|-------|-----------|
| `tower` | Wieża kontenerów – stawiaj kontenery jeden na drugim, wystające części odpadają | 60 s / do pudła | dotyk, klik, SPACJA |
| `ship` | Załadunek statku – układaj zestawy kontenerów w ładowni (pełny rząd = punkty) | 90 s / do zapełnienia | przyciski, strzałki, ↑ obrót, SPACJA zrzut |
| `crane` | Suwnica – jeździj suwnicą, zrzucaj bujający się kontener na naczepy | 60 s | ◀ ▶ ZRZUĆ, strzałki + SPACJA |
| `truck` | Dostawa – ciężarówka na 3 pasach, omijaj przeszkody, zbieraj paczki (3 życia) | 60 s / do rozbicia | stuknięcie lewo/prawo, przesunięcie palcem, strzałki |

Ranking ogólny = suma najlepszych wyników gracza ze wszystkich gier.

## Struktura
```
docs/                  ← strona (GitHub Pages: branch main, folder /docs)
  index.html
  css/style.css        ← motyw, filtr retro (CRT)
  js/config.js         ← ADRES API (wklej URL Workera)
  js/app.js            ← strony: start/logowanie, gry, ranking, profil, regulamin, opcje
  js/engine.js         ← silnik gier (canvas, dotyk/mysz/klawiatura, dźwięki 8-bit)
  js/games/*.js        ← 4 minigry
  assets/img/*.png     ← pikselowe sprite'y (każdy osobno – można podmieniać)
  assets/fonts/        ← Pixelify Sans, Press Start 2P, VT323 + licencje OFL
worker/
  wrangler.toml        ← konfiguracja: daty zawodów, kod wydarzenia, CORS, baza D1
  schema.sql           ← tabele bazy
  src/index.js         ← API
tools/
  gen_sprites.py       ← generator grafik (Pillow)
  api_test.sh          ← test API curl-em
  screenshots.cjs      ← zrzuty ekranu + test E2E (Playwright)
```

## Wdrożenie krok po kroku

### 0. Narzędzia (NixOS)
```bash
nix-shell -p nodejs git        # daje node + npm + npx (wrangler uruchamiamy przez npx)
```
Na innych systemach: zainstaluj Node.js 18+ (lub nowszy).

### 1. Repozytorium na GitHubie + GitHub Pages
1. Na github.com → **New repository**, np. `port-games` (może być publiczne; na darmowym planie Pages wymaga publicznego repo).
2. W folderze projektu:
   ```bash
   git init && git add . && git commit -m "Port Games"
   git branch -M main
   git remote add origin https://github.com/TWOJ-LOGIN/port-games.git
   git push -u origin main
   ```
3. Na GitHubie: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/docs` → Save**.
4. Po ~1 min strona działa pod `https://TWOJ-LOGIN.github.io/port-games/` (na razie w trybie treningowym).

### 2. Cloudflare: baza D1 i Worker
```bash
cd worker
npm install                      # instaluje wrangler lokalnie (lub używaj po prostu: npx wrangler ...)
npx wrangler login               # otworzy przeglądarkę – zaloguj się do Cloudflare (darmowe konto wystarczy)
npx wrangler d1 create maersk-games-db
```
Komenda wypisze `database_id` – **wklej go do `worker/wrangler.toml`** w miejsce `WKLEJ-TUTAJ-ID-Z-wrangler-d1-create`.

Załóż tabele w bazie produkcyjnej:
```bash
npx wrangler d1 execute maersk-games-db --remote --file=schema.sql
```
Ustaw sekret do podpisywania tokenów (wpisz długi losowy ciąg, np. wynik `openssl rand -hex 32`):
```bash
npx wrangler secret put TOKEN_SECRET
```
Edytuj `[vars]` w `wrangler.toml`:
* `ALLOWED_ORIGINS` – adres strony **bez ścieżki**, np. `https://TWOJ-LOGIN.github.io` (kilka po przecinku),
* `EVENT_START` / `EVENT_END` – czas trwania zawodów (ISO, np. `2026-11-16T08:00:00+01:00`),
* `EVENT_CODE` – kod, który podasz współpracownikom (pusty `""` = rejestracja bez kodu),
* `EVENT_NAME`.

Wdróż:
```bash
npx wrangler deploy
```
Dostaniesz adres typu `https://maersk-games-api.TWOJ-SUBDOMENA.workers.dev`.

### 3. Połącz stronę z API
W `docs/js/config.js` ustaw:
```js
API_URL: (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://127.0.0.1:8787' : 'https://maersk-games-api.TWOJ-SUBDOMENA.workers.dev',
```
`git commit -am "API URL" && git push` → po minucie strona zapisuje wyniki. Sprawdź: `https://…workers.dev/api/config`.

### Zmiana dat / kodu / CORS później
Edytuj `[vars]` w `wrangler.toml` i ponownie `npx wrangler deploy`. Poza oknem dat nie da się rozpocząć gry rankingowej, ranking pozostaje widoczny.

### Reset wyników / administracja
```bash
# wyczyść wszystkie wyniki (konta zostają)
npx wrangler d1 execute maersk-games-db --remote --command "DELETE FROM scores; DELETE FROM sessions;"
# pełny reset (konta też)
npx wrangler d1 execute maersk-games-db --remote --file=schema.sql
# usuń podejrzany wynik / gracza
npx wrangler d1 execute maersk-games-db --remote --command "SELECT s.id,u.nick,s.game,s.score FROM scores s JOIN users u ON u.id=s.user_id ORDER BY s.score DESC LIMIT 20"
npx wrangler d1 execute maersk-games-db --remote --command "DELETE FROM scores WHERE id = 123"
npx wrangler d1 execute maersk-games-db --remote --command "DELETE FROM scores WHERE user_id=(SELECT id FROM users WHERE nick='Nick'); DELETE FROM users WHERE nick='Nick'"
```
Zapomniany PIN: usuń gracza jak wyżej (lub tylko konto) – założy nowe.

## Uruchomienie lokalne
```bash
nix-shell -p nodejs python3
cd worker
npm install
echo 'TOKEN_SECRET="lokalny-sekret"' > .dev.vars
npx wrangler d1 execute maersk-games-db --local --file=schema.sql
npx wrangler dev --port 8787            # API: http://127.0.0.1:8787
# drugi terminal:
cd docs && python3 -m http.server 8000  # strona: http://localhost:8000
bash tools/api_test.sh                  # opcjonalny test API
```
`config.js` automatycznie używa `http://127.0.0.1:8787` gdy strona działa na localhost.

## Zabezpieczenia wyników (prosto, ale skutecznie na firmową zabawę)
* PIN hashowany PBKDF2 (SHA-256, sól per użytkownik), token logowania podpisany HMAC (30 dni).
* Każda gra zaczyna się od `/api/session/start` → podpisany token sesji, jednorazowy (drugi zapis = odrzucony).
* Serwer sprawdza: minimalny czas gry (3 s), maksymalny wynik gry, maksymalną liczbę punktów na sekundę
  rzeczywistego czasu od startu sesji, okno dat zawodów, limit 8 startów gry na minutę na gracza.
* To nie jest odporne na zdeterminowanego programistę (gra działa w przeglądarce) – organizator może ręcznie usuwać wyniki SQL-em.
Limity zmienisz w `worker/src/index.js` (`GAMES`, `MIN_GAME_MS`, `SESSIONS_PER_MINUTE`).

## Wygląd
* Wszystkie grafiki to pikselowe PNG z `tools/gen_sprites.py` (`python3 tools/gen_sprites.py`, wymaga Pillow;
  na NixOS: `nix-shell -p "python3.withPackages(p:[p.pillow])"`). Możesz podmienić dowolny plik w `docs/assets/img/` (zachowaj rozmiar).
* Kolory: jasnoniebieski `#42B0D5`, granat `#00243D`, biel (`css/style.css`, `js/engine.js`).
* Filtr retro (linie CRT, dithering, winieta) – domyślnie włączony, wyłącznik w zakładce **Opcje**. Jest to lekka nakładka CSS, więc działa płynnie na telefonach.
* Czcionki (SIL Open Font License, pliki licencji w `docs/assets/fonts/`): Pixelify Sans (nagłówki, pełne polskie znaki), VT323 (tekst), Press Start 2P (liczniki w grach).
