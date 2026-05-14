import { raw } from "hono/html";

const CSS = `
:root {
  color-scheme: light dark;
  --bg: light-dark(#fafafa, #0d1117);
  --panel: light-dark(#ffffff, #161b22);
  --border: light-dark(#e1e4e8, #30363d);
  --text: light-dark(#24292f, #c9d1d9);
  --muted: light-dark(#6a737d, #8b949e);
  --accent: light-dark(#0969da, #58a6ff);
  --ok-bg: light-dark(#dafbe1, #1f3a26);
  --ok-fg: light-dark(#1a7f37, #3fb950);
  --warn-bg: light-dark(#fff8c5, #3a2f0c);
  --warn-fg: light-dark(#9a6700, #d4a72c);
  --error-fg: light-dark(#cf222e, #f85149);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2.5rem 1rem 4rem;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
}
main { max-width: 720px; margin: 0 auto; }
header { margin-bottom: 2rem; }
h1 { margin: 0 0 0.25rem; font-size: 1.5rem; font-weight: 600; }
.subtitle { margin: 0; color: var(--muted); font-size: 0.9rem; }
.subtitle code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; padding: 0.1rem 0.35rem; background: var(--panel); border: 1px solid var(--border); border-radius: 4px; }
.bar {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  margin-bottom: 1.25rem;
}
.bar label { font-weight: 500; white-space: nowrap; }
.bar input { flex: 1; min-width: 0; }
section {
  padding: 1rem 1.25rem 1.25rem;
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  margin-bottom: 1rem;
}
.section-head {
  display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.section-head h2 { margin: 0; font-size: 1rem; font-weight: 600; }
.hint { margin: 0 0 0.75rem; color: var(--muted); font-size: 0.85rem; }
.badge {
  font-size: 0.75rem; font-weight: 500;
  padding: 0.15rem 0.6rem; border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--muted);
}
.badge.ok { background: var(--ok-bg); color: var(--ok-fg); border-color: transparent; }
.badge.warn { background: var(--warn-bg); color: var(--warn-fg); border-color: transparent; }
.row { display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }
.row.split { grid-template-columns: 1fr; }
@media (min-width: 520px) { .row.split { grid-template-columns: 1.2fr 1fr; } }
input, textarea {
  font: inherit;
  padding: 0.5rem 0.75rem;
  background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  width: 100%;
}
input:focus, textarea:focus { outline: none; border-color: var(--accent); }
textarea {
  resize: vertical; min-height: 64px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
}
.actions { display: flex; align-items: center; gap: 0.75rem; }
button {
  font: inherit; font-weight: 500;
  padding: 0.45rem 1rem;
  background: var(--accent); color: white;
  border: none; border-radius: 6px; cursor: pointer;
}
button:hover { filter: brightness(1.05); }
button.ghost {
  background: transparent; color: var(--muted); border: 1px solid var(--border);
}
#status { font-size: 0.85rem; }
#status.ok { color: var(--ok-fg); }
#status.error { color: var(--error-fg); }
#status.muted { color: var(--muted); }
.toast {
  position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
  padding: 0.6rem 1rem;
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  font-size: 0.85rem; opacity: 0; transition: opacity 0.2s;
  pointer-events: none;
}
.toast.show { opacity: 1; }
.toast.error { color: var(--error-fg); }
.toast.ok { color: var(--ok-fg); }
`;

const CLIENT_JS = `
(() => {
  const KEY = 'byok_secret';
  const $ = (id) => document.getElementById(id);
  const status = $('status');
  const toast = $('toast');

  const get = () => sessionStorage.getItem(KEY) || '';
  const set = (v) => v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY);

  function showToast(msg, kind) {
    toast.textContent = msg;
    toast.className = 'toast show ' + (kind || '');
    setTimeout(() => { toast.className = 'toast'; }, 1800);
  }

  async function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + get(),
        'Content-Type': 'application/json',
      },
      body: opts.body,
    });
  }

  function setBadge(id, configured) {
    const el = $(id);
    if (configured) { el.textContent = 'configured'; el.className = 'badge ok'; }
    else { el.textContent = 'not configured'; el.className = 'badge warn'; }
  }

  async function refresh() {
    if (!get()) {
      status.textContent = 'enter secret to load';
      status.className = 'muted';
      ['ampcode-status','anthropic-status','openai-status','gemini-status'].forEach((id) => {
        const el = $(id); el.textContent = '–'; el.className = 'badge';
      });
      return;
    }
    status.textContent = 'loading…';
    status.className = 'muted';
    const r = await api('/__config');
    if (!r.ok) {
      status.textContent = r.status === 401 ? 'invalid secret' : ('error ' + r.status);
      status.className = 'error';
      return;
    }
    const d = await r.json();
    status.textContent = 'connected';
    status.className = 'ok';
    setBadge('ampcode-status', d.ampcode_token_configured);
    setBadge('anthropic-status', d.anthropic.configured);
    setBadge('openai-status', d.openai.configured);
    setBadge('gemini-status', d.gemini.configured);
    $('anthropic-base').placeholder = d.anthropic.base_url;
    $('openai-base').placeholder = d.openai.base_url;
    $('gemini-base').placeholder = d.gemini.base_url;
  }

  async function saveAmpcode() {
    const token = $('ampcode-token').value.trim();
    if (!token) { showToast('token required', 'error'); return; }
    const r = await api('/__config/ampcode-token', { method: 'PUT', body: JSON.stringify({ token }) });
    if (r.ok) { $('ampcode-token').value = ''; showToast('saved', 'ok'); refresh(); }
    else showToast('failed: ' + r.status, 'error');
  }

  async function saveProvider(name) {
    const base = $(name + '-base').value.trim();
    const key = $(name + '-key').value.trim();
    if (!key) { showToast('api key required', 'error'); return; }
    const body = { api_key: key };
    if (base) body.base_url = base;
    const r = await api('/__config/' + name, { method: 'PUT', body: JSON.stringify(body) });
    if (r.ok) { $(name + '-key').value = ''; showToast('saved', 'ok'); refresh(); }
    else showToast('failed: ' + r.status, 'error');
  }

  $('secret').value = get();
  $('save-secret').addEventListener('click', () => { set($('secret').value.trim()); refresh(); });
  $('clear-secret').addEventListener('click', () => { set(''); $('secret').value = ''; refresh(); });
  $('save-ampcode').addEventListener('click', saveAmpcode);
  $('save-anthropic').addEventListener('click', () => saveProvider('anthropic'));
  $('save-openai').addEventListener('click', () => saveProvider('openai'));
  $('save-gemini').addEventListener('click', () => saveProvider('gemini'));

  refresh();
})();
`;

type ProviderName = "anthropic" | "openai" | "gemini";

const ProviderSection = ({ name, hint }: { name: ProviderName; hint: string }) => (
  <section>
    <div class="section-head">
      <h2>{name[0].toUpperCase() + name.slice(1)}</h2>
      <span id={`${name}-status`} class="badge">–</span>
    </div>
    <p class="hint">{hint}</p>
    <div class="row split">
      <input id={`${name}-base`} placeholder="base url (optional)" autocomplete="off" />
      <input id={`${name}-key`} type="password" placeholder="api key" autocomplete="off" />
    </div>
    <div class="actions">
      <button id={`save-${name}`}>Save</button>
    </div>
  </section>
);

export const LoginPage = ({
  authToken,
  callbackPort,
  error,
}: {
  authToken: string;
  callbackPort: string;
  error?: string;
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Authorize amp CLI · ampcode-byok</title>
      <style>{raw(CSS)}</style>
    </head>
    <body>
      <main style="max-width: 480px;">
        <header>
          <h1>Authorize amp CLI</h1>
          <p class="subtitle">
            Your local <code>amp</code> CLI is asking this worker to issue it a
            credential. After you authorize, amp will store the worker's
            <code> SHARED_SECRET</code> as its API key and use it for every
            subsequent request.
          </p>
        </header>

        {error ? (
          <section>
            <p class="hint" style="color: var(--error-fg);">{error}</p>
            <p class="hint">
              Run <code>amp login</code> from your terminal — it will open the
              correct URL with <code>authToken</code> and{" "}
              <code>callbackPort</code> set.
            </p>
          </section>
        ) : (
          <section>
            <p class="hint" id="login-status">Paste the worker's <code>SHARED_SECRET</code> to continue.</p>
            <div class="row">
              <input type="password" id="login-secret" placeholder="SHARED_SECRET" autocomplete="off" />
            </div>
            <div class="actions">
              <button id="authorize">Authorize amp CLI</button>
            </div>
            <p class="hint" style="margin-top: 0.75rem;">
              The browser will redirect to{" "}
              <code>http://127.0.0.1:{callbackPort}/auth/callback</code> and
              hand the secret to your local amp server.
            </p>
          </section>
        )}
      </main>
      <div id="toast" class="toast"></div>
      {error ? null : (
        <script>{raw(`
          (() => {
            const authToken = ${JSON.stringify(authToken)};
            const callbackPort = ${JSON.stringify(callbackPort)};
            const $ = (id) => document.getElementById(id);
            const status = $('login-status');
            const toast = $('toast');

            function showToast(msg, kind) {
              toast.textContent = msg;
              toast.className = 'toast show ' + (kind || '');
              setTimeout(() => { toast.className = 'toast'; }, 1800);
            }

            $('login-secret').value = sessionStorage.getItem('byok_secret') || '';

            async function authorize() {
              const secret = $('login-secret').value.trim();
              if (!secret) { showToast('secret required', 'error'); return; }
              status.textContent = 'verifying secret…';
              let r;
              try { r = await fetch('/__config', { headers: { 'Authorization': 'Bearer ' + secret } }); }
              catch (e) { status.textContent = 'network error'; return; }
              if (!r.ok) {
                status.textContent = r.status === 401 ? 'invalid secret' : ('error ' + r.status);
                return;
              }
              sessionStorage.setItem('byok_secret', secret);
              status.textContent = 'redirecting to amp CLI…';
              const url = 'http://127.0.0.1:' + encodeURIComponent(callbackPort)
                + '/auth/callback?accessToken=' + encodeURIComponent(secret)
                + '&authToken=' + encodeURIComponent(authToken);
              window.location.href = url;
            }

            $('authorize').addEventListener('click', authorize);
            $('login-secret').addEventListener('keydown', (e) => { if (e.key === 'Enter') authorize(); });
          })();
        `)}</script>
      )}
    </body>
  </html>
);

export const Page = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>ampcode-byok</title>
      <style>{raw(CSS)}</style>
    </head>
    <body>
      <main>
        <header>
          <h1>ampcode-byok</h1>
          <p class="subtitle">
            Pass-through worker for the local <code>amp</code> CLI.{" "}
            <span id="status" class="muted">enter secret to load</span>
          </p>
        </header>

        <div class="bar">
          <label for="secret">Shared secret</label>
          <input type="password" id="secret" placeholder="SHARED_SECRET" autocomplete="off" />
          <button id="save-secret">Unlock</button>
          <button id="clear-secret" class="ghost">Clear</button>
        </div>

        <section>
          <div class="section-head">
            <h2>Ampcode token</h2>
            <span id="ampcode-status" class="badge">–</span>
          </div>
          <p class="hint">
            Used for every non-AI request forwarded to <code>ampcode.com</code> (auth, threads, management, …).
          </p>
          <div class="row">
            <textarea id="ampcode-token" placeholder="sgamp_…" autocomplete="off" spellcheck={false}></textarea>
          </div>
          <div class="actions">
            <button id="save-ampcode">Save</button>
          </div>
        </section>

        <ProviderSection
          name="anthropic"
          hint="Used for /api/provider/anthropic/v1/messages. base_url defaults to api.anthropic.com."
        />
        <ProviderSection
          name="openai"
          hint="Used for /api/provider/openai/v1/{chat/completions,responses}. Any OpenAI-compatible host works — exclude /v1 from base_url."
        />
        <ProviderSection
          name="gemini"
          hint="Used for /api/provider/google/v1beta/models/*. base_url defaults to generativelanguage.googleapis.com."
        />
      </main>
      <div id="toast" class="toast"></div>
      <script>{raw(CLIENT_JS)}</script>
    </body>
  </html>
);
