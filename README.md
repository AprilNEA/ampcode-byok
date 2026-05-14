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

Configure the local amp CLI so its server URL is your worker, and its
token is the value of `SHARED_SECRET`. From amp's side it looks identical
to talking to `ampcode.com`; the worker takes care of swapping in the
right upstream credential per request.

## Dev

```sh
pnpm run dev          # wrangler dev with local KV
pnpm run cf-typegen   # regenerate worker-configuration.d.ts after binding changes
```
