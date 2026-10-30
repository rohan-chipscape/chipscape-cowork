import { getOAuthClient, getEmailForTokens } from "@/lib/google/client";
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(
      resultPage(`Google sign-in was cancelled or denied: ${error}`, false),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }
  if (!code) {
    return new Response(resultPage("Missing authorization code.", false), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    const email = await getEmailForTokens(tokens);
    saveAccountTokens(email, tokens);

    return new Response(resultPage(`Connected ${email} to Cowork.`, true), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    return new Response(
      resultPage(
        `Failed to connect Google account: ${err instanceof Error ? err.message : String(err)}`,
        false
      ),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
