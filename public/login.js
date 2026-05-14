(() => {
  const meta = (name) => {
    const el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute("content") || "" : "";
  };
  const authToken = meta("x-amp-auth-token");
  const callbackPort = meta("x-amp-callback-port");

  const $ = (id) => document.getElementById(id);
  const status = $("login-status");
  const toast = $("toast");

  function showToast(msg, kind) {
    toast.textContent = msg;
    toast.className = "toast show " + (kind || "");
    setTimeout(() => {
      toast.className = "toast";
    }, 1800);
  }

  $("login-secret").value = sessionStorage.getItem("byok_secret") || "";

  async function authorize() {
    const secret = $("login-secret").value.trim();
    if (!secret) {
      showToast("secret required", "error");
      return;
    }
    status.textContent = "verifying secret…";
    let r;
    try {
      r = await fetch("/__config", {
        headers: { Authorization: "Bearer " + secret },
      });
    } catch (_) {
      status.textContent = "network error";
      return;
    }
    if (!r.ok) {
      status.textContent =
        r.status === 401 ? "invalid secret" : "error " + r.status;
      return;
    }
    sessionStorage.setItem("byok_secret", secret);
    status.textContent = "redirecting to amp CLI…";
    const url =
      "http://127.0.0.1:" +
      encodeURIComponent(callbackPort) +
      "/auth/callback?accessToken=" +
      encodeURIComponent(secret) +
      "&authToken=" +
      encodeURIComponent(authToken);
    window.location.href = url;
  }

  $("authorize").addEventListener("click", authorize);
  $("login-secret").addEventListener("keydown", (e) => {
    if (e.key === "Enter") authorize();
  });
})();
