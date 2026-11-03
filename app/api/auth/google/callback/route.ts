import { getOAuthClient, getProfileForTokens } from "@/lib/google/client";
import { saveAccountTokens } from "@/lib/google/accountStore";

function resultPage(message: string, ok: boolean) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${ok ? "Connected" : "Connection failed"}</title>
    ${ok ? '<meta http-equiv="refresh" content="1.5;url=/" />' : ""}
    <style>
      body {
        background: #000;
        color: #ececec;
        font-family: -apple-system, system-ui, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
      }
      .card { text-align: center; max-width: 28rem; padding: 0 1.5rem; }
      a { color: #5b9bff; }
    </style>
  </head>
  <body>
    <div class="card">
      <p>${message}</p>
      ${ok ? "<p>Redirecting you back…</p>" : '<p><a href="/">Back to Cowork</a></p>'}
    </div>
  </body>
</html>`;
}

const NATIVE_CONNECT_SCHEME = "chipscapecowork://google-connected";
const NATIVE_LOGIN_SCHEME = "chipscapecowork://google-login";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const isNativeConnect = state === "native";
  const isNativeLogin = state === "native_login";
  const isWebLogin = state === "login";
  const scheme = isNativeLogin ? NATIVE_LOGIN_SCHEME : NATIVE_CONNECT_SCHEME;

  if (error) {
    if (isNativeConnect || isNativeLogin) {
      return Response.redirect(`${scheme}?ok=0&message=${encodeURIComponent(error)}`);
    }
    if (isWebLogin) {
      return Response.redirect(
        new URL(`/login?error=${encodeURIComponent(error)}`, req.url)
      );
    }
    return new Response(
      resultPage(`Google sign-in was cancelled or denied: ${error}`, false),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }
  if (!code) {
    const message = "Missing authorization code.";
    if (isNativeConnect || isNativeLogin) {
      return Response.redirect(`${scheme}?ok=0&message=${encodeURIComponent(message)}`);
    }
    if (isWebLogin) {
      return Response.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url));
    }
    return new Response(resultPage(message, false), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    const profile = await getProfileForTokens(tokens);
    const { email } = profile;
    saveAccountTokens(email, tokens);

    if (isNativeConnect) {
      return Response.redirect(`${scheme}?ok=1&email=${encodeURIComponent(email)}`);
    }

    // "login"/"native_login": signing in with Google *is* the app's auth —
    // anyone with a Google account can sign in/sign up, same as ChatGPT.
    // The session cookie's value is the shared app password either way
    // (set here automatically instead of being typed in), so it plugs into
    // the exact same proxy.ts check as the old password form.
    const sessionSecret = process.env.APP_ACCESS_PASSWORD;
    if (!sessionSecret) {
      throw new Error("APP_ACCESS_PASSWORD is not set on the server.");
    }

    if (isNativeLogin) {
      return Response.redirect(
        `${scheme}?ok=1&email=${encodeURIComponent(email)}` +
          `&name=${encodeURIComponent(profile.name ?? "")}` +
          `&session=${encodeURIComponent(sessionSecret)}`
      );
    }

    if (isWebLogin) {
      // Response.redirect() returns a response with immutable headers, so
      // the Set-Cookie headers have to be built into a fresh Response instead
      // of appended afterward.
      const headers = new Headers({ Location: new URL("/", req.url).toString() });
      headers.append(
        "Set-Cookie",
        `cowork_auth=${sessionSecret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
      );
      // Scopes the agent's Gmail/Calendar/Drive tools to exactly the account
      // this browser signed in with — never a global pool of every account
      // anyone has ever connected (like ChatGPT: your session is your account).
      headers.append(
        "Set-Cookie",
        `cowork_email=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
      );
      if (profile.name) {
        headers.append(
          "Set-Cookie",
          `cowork_user_name=${encodeURIComponent(profile.name)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
        );
      }
      return new Response(null, { status: 302, headers });
    }

    return new Response(resultPage(`Connected ${email} to Cowork.`, true), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isNativeConnect || isNativeLogin) {
      return Response.redirect(`${scheme}?ok=0&message=${encodeURIComponent(message)}`);
    }
    if (isWebLogin) {
      return Response.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url));
    }
    return new Response(
      resultPage(`Failed to connect Google account: ${message}`, false),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
