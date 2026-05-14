# ampcode-byok

A minimal Cloudflare Worker that lets the local **amp CLI** talk to it as
if it were `ampcode.com`, while transparently:

- forwarding AI requests to your own **Anthropic / OpenAI / Gemini** keys
- forwarding everything else to `ampcode.com` using your real ampcode token

Only **one** environment value (`SHARED_SECRET`) needs to be set in the
Worker. All other state lives in a KV namespace and can be updated through
authenticated `PUT /__config/*` endpoints.

## Routes

| Path | Forwards to |
| --- | --- |
| `POST /api/provider/anthropic/v1/messages` | `<anthropic.base_url>/v1/messages` |
| `POST /api/provider/openai/v1/chat/completions` | `<openai.base_url>/v1/chat/completions` |
| `POST /api/provider/openai/v1/responses` | `<openai.base_url>/v1/responses` |
| `POST /api/provider/google/v1beta/models/{action}` | `<gemini.base_url>/v1beta/models/{action}` |
| anything else (`/api/*`, `/v0/management/*`, `/auth/*`, `/v1/login`) | `https://ampcode.com` + stored ampcode token |

Every request must carry the shared secret as either
`Authorization: Bearer <SHARED_SECRET>` or `x-api-key: <SHARED_SECRET>`.
The worker strips it before forwarding and replaces it with the appropriate
upstream credential.

## Setup

```sh
pnpm install

# 1. Create the KV namespace, then paste the id into wrangler.jsonc
wrangler kv namespace create STORE

# 2. Set the secret that the amp CLI will send
wrangler secret put SHARED_SECRET

# 3. Deploy
pnpm run deploy
```

## Configure storage

`base_url` should be the API root *without* the `/v1` suffix. Omit it to
use the public default.

```sh
# Real ampcode token (paste your existing amp CLI token here)
curl -X PUT https://ampcode-byok.example.workers.dev/__config/ampcode-token \
  -H "Authorization: Bearer $SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"token":"sgamp_..."}'

# Anthropic
curl -X PUT https://ampcode-byok.example.workers.dev/__config/anthropic \
  -H "Authorization: Bearer $SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"base_url":"https://api.anthropic.com","api_key":"sk-ant-..."}'

# OpenAI (or any compatible base)
curl -X PUT https://ampcode-byok.example.workers.dev/__config/openai \
  -H "Authorization: Bearer $SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"base_url":"https://api.openai.com","api_key":"sk-..."}'

# Gemini
curl -X PUT https://ampcode-byok.example.workers.dev/__config/gemini \
  -H "Authorization: Bearer $SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"base_url":"https://generativelanguage.googleapis.com","api_key":"AIza..."}'

# Inspect (api keys redacted)
curl https://ampcode-byok.example.workers.dev/__config \
  -H "Authorization: Bearer $SHARED_SECRET"
```

## Point amp CLI at the worker

Set amp CLI's server URL to your worker (e.g. `AMP_URL=https://ampcode-byok.example.workers.dev` or the equivalent setting), then either:

**a) `amp login`** — the worker intercepts amp's standard CLI login flow:

1. amp opens `https://your-worker/auth/cli-login?authToken=…&callbackPort=…`
2. The worker shows a one-screen page asking for `SHARED_SECRET`
3. After verification, the browser is redirected to amp's local callback
   (`http://127.0.0.1:{callbackPort}/auth/callback`) carrying
   `SHARED_SECRET` as `accessToken`
4. amp writes it to `~/.local/share/amp/secrets.json` and uses it as a
   Bearer token from then on

**b) Manual** — edit `~/.local/share/amp/secrets.json` directly so amp's
`apiKey` for this server equals `SHARED_SECRET`.

From amp's side the worker is indistinguishable from `ampcode.com`; the
worker strips `SHARED_SECRET` from each request and swaps in either the
stored ampcode token (for `ampcode.com` passthrough) or the matching
provider key (for AI requests).

## Dev

```sh
pnpm run dev          # wrangler dev with local KV
pnpm run cf-typegen   # regenerate worker-configuration.d.ts after binding changes
```
