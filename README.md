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

A single `SHARED_SECRET` (a Worker secret) authenticates the local `amp` CLI. All other state — the ampcode token and per-provider `base_url` + `api_key` — lives in a KV namespace and is set through the admin UI at `/`.

## Setup

1. Click **Deploy to Cloudflare** above, or `pnpm install && pnpm run deploy`. The `STORE` KV namespace is auto-created on first deploy (requires Wrangler ≥ 4.45).
2. Generate and set the secret amp will use to authenticate to the worker:
   ```sh
   openssl rand -hex 32 | wrangler secret put SHARED_SECRET
   ```
   The Deploy button prompts for this value during deploy and shows the same hint inline.
3. Open `https://<your-worker>.workers.dev/`, unlock with the secret, fill in the ampcode token and your provider keys.
4. Point amp at the worker by adding the URL to `~/.config/amp/settings.json`:
   ```json
   { "amp.url": "https://<your-worker>.workers.dev" }
   ```
   Then run `amp login`. On the page that opens, paste the same `SHARED_SECRET` and click **Authorize**. Amp stores it locally and uses it as its API key from then on.

## Using Cloudflare Secrets Store (optional)

`SHARED_SECRET` can also live in [Secrets Store](https://developers.cloudflare.com/secrets-store/) instead of being a per-Worker secret — useful if you rotate it from a central place or share it across Workers. Create the entry, then replace the comment block in `wrangler.jsonc` with:

```jsonc
"secrets_store_secrets": [
  {
    "binding": "SHARED_SECRET",
    "store_id": "<your-store-id>",
    "secret_name": "ampcode-byok-shared-secret"
  }
]
```

The worker's auth middleware resolves the binding through `await binding.get()`, so no code change is needed when switching between the two shapes.

## Local development

```sh
pnpm install
cp .dev.vars.example .dev.vars   # then fill in SHARED_SECRET
pnpm run dev
```

`pnpm run typecheck` for `tsc --noEmit`; `pnpm run cf-typegen` after binding changes.

## License

MIT.
