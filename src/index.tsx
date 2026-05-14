import { Hono } from "hono";
import { LoginPage, Page } from "./ui";

const PUBLIC_GET_PATHS = new Set(["/", "/auth/cli-login", "/v1/login"]);

type Bindings = {
  STORE: KVNamespace;
  // Plain Worker secret (`wrangler secret put SHARED_SECRET`) -> string.
  // Secrets Store binding -> SecretsStoreSecret (resolved via .get()).
  SHARED_SECRET: string | SecretsStoreSecret;
};

type ProviderConfig = {
  base_url: string;
  api_key: string;
};

type ProviderName = "anthropic" | "openai" | "gemini";

const DEFAULT_BASE: Record<ProviderName, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
};

const AMP_BACKEND = "https://ampcode.com";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const CLIENT_AUTH = new Set(["authorization", "x-api-key", "x-goog-api-key"]);

const FINGERPRINT = new Set([
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "forwarded",
  "via",
  "priority",
]);

function shouldStrip(name: string): boolean {
  if (HOP_BY_HOP.has(name)) return true;
  if (CLIENT_AUTH.has(name)) return true;
  if (FINGERPRINT.has(name)) return true;
  if (name.startsWith("sec-ch-ua-")) return true;
  if (name.startsWith("sec-fetch-")) return true;
  if (name.startsWith("cf-")) return true;
  return false;
}

function forwardableHeaders(src: Headers): Headers {
  const out = new Headers();
  for (const [name, value] of src) {
    if (shouldStrip(name.toLowerCase())) continue;
    out.set(name, value);
  }
  return out;
}

function responseHeaders(src: Headers): Headers {
  const out = new Headers();
  for (const [name, value] of src) {
    if (HOP_BY_HOP.has(name.toLowerCase())) continue;
    out.set(name, value);
  }
  return out;
}

function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (m) return m[1].trim();
  }
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) return apiKey.trim();
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function getProvider(
  store: KVNamespace,
  name: ProviderName,
): Promise<ProviderConfig | null> {
  const raw = await store.get(`provider:${name}`);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<ProviderConfig>;
  if (!parsed.api_key) return null;
  return {
    base_url: normalizeBase(parsed.base_url || DEFAULT_BASE[name]),
    api_key: parsed.api_key,
  };
}

async function forward(
  req: Request,
  targetUrl: string,
  injectAuth: (h: Headers) => void,
): Promise<Response> {
  const headers = forwardableHeaders(req.headers);
  injectAuth(headers);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    (init as RequestInit & { duplex?: string }).duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    return jsonError(502, `upstream fetch failed: ${(err as Error).message}`);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream.headers),
  });
}

const app = new Hono<{ Bindings: Bindings }>();

async function resolveSecret(
  binding: string | SecretsStoreSecret | undefined,
): Promise<string | null> {
  if (!binding) return null;
  if (typeof binding === "string") return binding || null;
  try {
    const v = await binding.get();
    return v || null;
  } catch {
    return null;
  }
}

app.use("*", async (c, next) => {
  if (c.req.method === "GET" && PUBLIC_GET_PATHS.has(c.req.path)) {
    return next();
  }
  const expected = await resolveSecret(c.env.SHARED_SECRET);
  if (!expected) {
    return jsonError(500, "SHARED_SECRET not configured");
  }
  const provided = extractToken(c.req.raw);
  if (!provided || !constantTimeEqual(provided, expected)) {
    return jsonError(401, "unauthorized");
  }
  await next();
});

app.get("/", (c) => c.html(<Page />));

app.get("/auth/cli-login", (c) => {
  const authToken = c.req.query("authToken") ?? "";
  const callbackPort = c.req.query("callbackPort") ?? "";
  const validAuthToken = /^[A-Za-z0-9+/=_-]+$/.test(authToken);
  const validPort = /^\d{1,5}$/.test(callbackPort);
  if (!validAuthToken || !validPort) {
    return c.html(
      <LoginPage
        authToken=""
        callbackPort=""
        error="Missing or malformed authToken / callbackPort query parameters."
      />,
    );
  }
  return c.html(<LoginPage authToken={authToken} callbackPort={callbackPort} />);
});

app.get("/v1/login", (c) => c.redirect("/", 302));

app.get("/__config", async (c) => {
  const [tok, ant, oai, gem] = await Promise.all([
    c.env.STORE.get("ampcode_token"),
    c.env.STORE.get("provider:anthropic"),
    c.env.STORE.get("provider:openai"),
    c.env.STORE.get("provider:gemini"),
  ]);
  const redact = (raw: string | null, name: ProviderName) => {
    if (!raw) return { base_url: DEFAULT_BASE[name], configured: false };
    const p = JSON.parse(raw) as Partial<ProviderConfig>;
    return {
      base_url: p.base_url || DEFAULT_BASE[name],
      configured: !!p.api_key,
    };
  };
  return c.json({
    ampcode_token_configured: !!tok,
    anthropic: redact(ant, "anthropic"),
    openai: redact(oai, "openai"),
    gemini: redact(gem, "gemini"),
  });
});

app.put("/__config/ampcode-token", async (c) => {
  const body = await c.req.json<{ token?: unknown }>().catch(() => null);
  if (!body || typeof body.token !== "string" || !body.token) {
    return jsonError(400, "expected { token: string }");
  }
  await c.env.STORE.put("ampcode_token", body.token);
  return c.json({ ok: true });
});

async function handleProviderPut(
  c: { env: Bindings; req: { json: <T>() => Promise<T> }; json: (b: unknown) => Response },
  name: ProviderName,
): Promise<Response> {
  const body = await c.req
    .json<{ base_url?: unknown; api_key?: unknown }>()
    .catch(() => null);
  if (!body || typeof body.api_key !== "string" || !body.api_key) {
    return jsonError(400, "expected { base_url?: string, api_key: string }");
  }
  const cfg: ProviderConfig = {
    base_url:
      typeof body.base_url === "string" && body.base_url
        ? normalizeBase(body.base_url)
        : DEFAULT_BASE[name],
    api_key: body.api_key,
  };
  await c.env.STORE.put(`provider:${name}`, JSON.stringify(cfg));
  return c.json({ ok: true, base_url: cfg.base_url });
}

app.put("/__config/anthropic", (c) => handleProviderPut(c, "anthropic"));
app.put("/__config/openai", (c) => handleProviderPut(c, "openai"));
app.put("/__config/gemini", (c) => handleProviderPut(c, "gemini"));

app.post("/api/provider/anthropic/v1/messages", async (c) => {
  const cfg = await getProvider(c.env.STORE, "anthropic");
  if (!cfg) return jsonError(503, "anthropic not configured");
  return forward(c.req.raw, `${cfg.base_url}/v1/messages`, (h) => {
    h.set("x-api-key", cfg.api_key);
    h.delete("authorization");
  });
});

app.post("/api/provider/openai/v1/chat/completions", async (c) => {
  const cfg = await getProvider(c.env.STORE, "openai");
  if (!cfg) return jsonError(503, "openai not configured");
  return forward(c.req.raw, `${cfg.base_url}/v1/chat/completions`, (h) => {
    h.set("authorization", `Bearer ${cfg.api_key}`);
  });
});

app.post("/api/provider/openai/v1/responses", async (c) => {
  const cfg = await getProvider(c.env.STORE, "openai");
  if (!cfg) return jsonError(503, "openai not configured");
  return forward(c.req.raw, `${cfg.base_url}/v1/responses`, (h) => {
    h.set("authorization", `Bearer ${cfg.api_key}`);
  });
});

app.post("/api/provider/google/v1beta/models/:action", async (c) => {
  const cfg = await getProvider(c.env.STORE, "gemini");
  if (!cfg) return jsonError(503, "gemini not configured");
  const action = c.req.param("action");
  const qs = new URL(c.req.url).search;
  return forward(
    c.req.raw,
    `${cfg.base_url}/v1beta/models/${action}${qs}`,
    (h) => {
      h.set("x-goog-api-key", cfg.api_key);
      h.delete("authorization");
    },
  );
});

app.all("*", async (c) => {
  const token = await c.env.STORE.get("ampcode_token");
  if (!token) return jsonError(503, "ampcode_token not configured");
  const u = new URL(c.req.url);
  return forward(c.req.raw, `${AMP_BACKEND}${u.pathname}${u.search}`, (h) => {
    h.set("authorization", `Bearer ${token}`);
    h.set("x-api-key", token);
  });
});

export default app;
