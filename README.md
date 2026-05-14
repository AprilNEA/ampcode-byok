# ampcode-byok

> Bring Your Own Key for [Amp CLI](https://ampcode.com). A tiny Cloudflare Worker that swaps `amp`'s AI calls onto your own Anthropic / OpenAI / Gemini keys and passes everything else through to `ampcode.com`.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AprilNEA/ampcode-byok)

## Routes

| Path | Forwards to |
| --- | --- |
| `POST /api/provider/anthropic/v1/messages` | your Anthropic |
| `POST /api/provider/openai/v1/{chat/completions,responses}` | your OpenAI |
| `POST /api/provider/google/v1beta/models/{action}` | your Gemini |
| anything else | `ampcode.com` with your stored ampcode token |

`SHARED_SECRET` lives in [Cloudflare Secrets Store](https://developers.cloudflare.com/secrets-store/) and authenticates the local `amp` CLI to this worker. All other state — the ampcode token and per-provider `base_url` + `api_key` — lives in a KV namespace and is set through the admin UI at `/`.

## Setup

### Click the button

The Deploy to Cloudflare button creates the KV namespace and lets you select or create a Secrets Store entry for `SHARED_SECRET`. Generate the value with `openssl rand -hex 32` and paste it when prompted. Done.

### Or via CLI

```sh
pnpm install

# Create a Secrets Store (skip if you already have one)
wrangler secrets-store store create default --remote
wrangler secrets-store store list --remote        # copy the store_id

# Create the secret entry; paste `openssl rand -hex 32` when prompted
wrangler secrets-store secret create <STORE_ID> \
  --name ampcode-byok-shared-secret \
  --scopes workers \
  --remote

# Paste <STORE_ID> into wrangler.jsonc → secrets_store_secrets[0].store_id
pnpm run deploy        # also auto-creates the STORE KV namespace
```

### Then

1. Open `https://<your-worker>.workers.dev/`, unlock with the same secret, fill in the ampcode token and your provider keys.
2. Point amp at the worker by adding the URL to `~/.config/amp/settings.json`:
   ```json
   { "amp.url": "https://<your-worker>.workers.dev" }
   ```
   Then run `amp login`. On the page that opens, paste the same `SHARED_SECRET` and click **Authorize**. Amp stores it locally and uses it as its API key from then on.

## Local development

Secrets Store has a separate local-mode namespace; mirror the production entry into it:

```sh
pnpm install

# Same store_id you used in wrangler.jsonc, but without --remote.
wrangler secrets-store secret create <STORE_ID> \
  --name ampcode-byok-shared-secret \
  --scopes workers \
  --value "$(openssl rand -hex 32)"

pnpm run dev
```

`pnpm run typecheck` for `tsc --noEmit`; `pnpm run cf-typegen` after binding changes.

## License

MIT.
