import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_ORIGIN: string;
  GITHUB_SCOPE?: string;
}

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

const STATE_COOKIE = "decap_oauth_state";

const app = new Hono<{ Bindings: Env }>();

function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function handshakePage(origin: string, status: "success" | "error", payload: Record<string, string>): string {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return `<!doctype html>
<html><body><script>
(() => {
  const allowedOrigin = ${scriptSafeJson(origin)};
  const message = ${scriptSafeJson(message)};
  const reply = (event) => {
    if (event.origin !== allowedOrigin) return;
    window.removeEventListener("message", reply);
    window.opener.postMessage(message, allowedOrigin);
  };
  window.addEventListener("message", reply);
  window.opener.postMessage("authorizing:github", allowedOrigin);
})();
</script></body></html>`;
}

app.get("/auth", (c) => {
  const state = crypto.randomUUID();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  const redirectUri = new URL("/callback", c.req.url).toString();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", c.env.GITHUB_SCOPE ?? "repo");
  authorize.searchParams.set("state", state);

  return c.redirect(authorize.toString());
});

app.get("/callback", async (c) => {
  const origin = c.env.ALLOWED_ORIGIN;
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !expectedState || state !== expectedState) {
    return c.html(handshakePage(origin, "error", { message: "Invalid OAuth state" }), 400);
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL("/callback", c.req.url).toString(),
    }),
  });

  const result: GitHubTokenResponse = await response.json();

  if (!response.ok || !result.access_token) {
    const message = result.error_description ?? result.error ?? "Token exchange failed";
    return c.html(handshakePage(origin, "error", { message }), 502);
  }

  return c.html(handshakePage(origin, "success", { token: result.access_token, provider: "github" }));
});

export default app;
