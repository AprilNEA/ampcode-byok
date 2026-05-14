type ProviderName = "anthropic" | "openai" | "gemini";

const HeadShared = ({ title }: { title: string }) => (
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
);

const ProviderSection = ({
  name,
  hint,
}: {
  name: ProviderName;
  hint: string;
}) => (
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

export const Page = () => (
  <html lang="en">
    <HeadShared title="ampcode-byok" />
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
      <script src="/admin.js" defer></script>
    </body>
  </html>
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
      <link rel="stylesheet" href="/styles.css" />
      {error ? null : (
        <>
          <meta name="x-amp-auth-token" content={authToken} />
          <meta name="x-amp-callback-port" content={callbackPort} />
        </>
      )}
    </head>
    <body>
      <main style="max-width: 480px;">
        <header>
          <h1>Authorize amp CLI</h1>
          <p class="subtitle">
            Your local <code>amp</code> CLI is asking this worker to issue it a
            credential. After you authorize, amp will store the worker's{" "}
            <code>SHARED_SECRET</code> as its API key and use it for every
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
            <p class="hint" id="login-status">
              Paste the worker's <code>SHARED_SECRET</code> to continue.
            </p>
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
      {error ? null : <script src="/login.js" defer></script>}
    </body>
  </html>
);
