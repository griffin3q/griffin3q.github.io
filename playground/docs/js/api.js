const BASE = (window.PORT_CONFIG && window.PORT_CONFIG.API_URL || '').replace(/\/+$/, '');
export const hasApi = () => !!BASE;
export const auth = {
  get token() { return localStorage.getItem('pg_token') || ''; },
  get user() { try { return JSON.parse(localStorage.getItem('pg_user') || 'null'); } catch { return null; } },
  set(token, user) { localStorage.setItem('pg_token', token); localStorage.setItem('pg_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('pg_token'); localStorage.removeItem('pg_user'); },
};
export async function api(path, body) {
  if (!BASE) throw new Error('Brak adresu API – tryb treningowy.');
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
  let res;
  try {
    res = await fetch(BASE + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) { throw new Error('Brak połączenia z serwerem.'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') auth.clear();
  if (!res.ok) { const err = new Error(data.error || ('Błąd ' + res.status)); err.status = res.status; throw err; }
  return data;
}
