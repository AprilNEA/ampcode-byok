(() => {
  const KEY = "byok_secret";
  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const toast = $("toast");

  const get = () => sessionStorage.getItem(KEY) || "";
  const set = (v) =>
    v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY);

  function showToast(msg, kind) {
    toast.textContent = msg;
    toast.className = "toast show " + (kind || "");
    setTimeout(() => {
      toast.className = "toast";
    }, 1800);
  }

  async function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || "GET",
      headers: {
        Authorization: "Bearer " + get(),
        "Content-Type": "application/json",
      },
      body: opts.body,
    });
  }

  function setBadge(id, configured) {
    const el = $(id);
    if (configured) {
      el.textContent = "configured";
      el.className = "badge ok";
    } else {
      el.textContent = "not configured";
      el.className = "badge warn";
    }
  }

  async function refresh() {
    if (!get()) {
      status.textContent = "enter secret to load";
      status.className = "muted";
      [
        "ampcode-status",
        "anthropic-status",
        "openai-status",
        "gemini-status",
      ].forEach((id) => {
        const el = $(id);
        el.textContent = "–";
        el.className = "badge";
      });
      return;
    }
    status.textContent = "loading…";
    status.className = "muted";
    const r = await api("/__config");
    if (!r.ok) {
      status.textContent =
        r.status === 401 ? "invalid secret" : "error " + r.status;
      status.className = "error";
      return;
    }
    const d = await r.json();
    status.textContent = "connected";
    status.className = "ok";
    setBadge("ampcode-status", d.ampcode_token_configured);
    setBadge("anthropic-status", d.anthropic.configured);
    setBadge("openai-status", d.openai.configured);
    setBadge("gemini-status", d.gemini.configured);
    $("anthropic-base").placeholder = d.anthropic.base_url;
    $("openai-base").placeholder = d.openai.base_url;
    $("gemini-base").placeholder = d.gemini.base_url;
  }

  async function saveAmpcode() {
    const token = $("ampcode-token").value.trim();
    if (!token) {
      showToast("token required", "error");
      return;
    }
    const r = await api("/__config/ampcode-token", {
      method: "PUT",
      body: JSON.stringify({ token }),
    });
    if (r.ok) {
      $("ampcode-token").value = "";
      showToast("saved", "ok");
      refresh();
    } else {
      showToast("failed: " + r.status, "error");
    }
  }

  async function saveProvider(name) {
    const base = $(name + "-base").value.trim();
    const key = $(name + "-key").value.trim();
    if (!key) {
      showToast("api key required", "error");
      return;
    }
    const body = { api_key: key };
    if (base) body.base_url = base;
    const r = await api("/__config/" + name, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (r.ok) {
      $(name + "-key").value = "";
      showToast("saved", "ok");
      refresh();
    } else {
      showToast("failed: " + r.status, "error");
    }
  }

  $("secret").value = get();
  $("save-secret").addEventListener("click", () => {
    set($("secret").value.trim());
    refresh();
  });
  $("clear-secret").addEventListener("click", () => {
    set("");
    $("secret").value = "";
    refresh();
  });
  $("save-ampcode").addEventListener("click", saveAmpcode);
  $("save-anthropic").addEventListener("click", () => saveProvider("anthropic"));
  $("save-openai").addEventListener("click", () => saveProvider("openai"));
  $("save-gemini").addEventListener("click", () => saveProvider("gemini"));

  refresh();
})();
