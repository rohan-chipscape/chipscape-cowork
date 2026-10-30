# Chipscape Cowork

A private, Claude-Cowork-style chat app for one person (e.g. a CEO). Plain questions get answered by **Claude, GPT, Gemini, DeepSeek and Grok debating in parallel**, synthesized into one answer. Tasks get routed to an **agent** that can search the web, read pages, run calculations, and — once connected — search/read/send Gmail, manage Google Calendar, and read Google Drive files, with every action requiring approval first. Chats are saved and browsable from a ChatGPT-style sidebar. Works on mobile, tablet, and desktop browsers, gated by a shared access password.

## How it works

Every message is routed into one of two modes (`lib/agent/run.ts:classifyIntent`):

**Debate mode** (plain questions, opinions, analysis):
1. All 5 providers answer in parallel (`lib/providers/*`).
2. A judge model merges/resolves the answers into one final answer (`lib/debate.ts`). If the preferred judge (Claude, by default) fails or has no credit, it automatically falls back to another model that did answer successfully — see `JUDGE_PROVIDER` below.
3. The panel's individual answers are visible but collapsed by default (click "Panel answered" to expand) — only the final synthesized answer is shown by default.

**Agent mode** (tasks: "look this up", "calculate X", "check this page", "check my calendar"):
1. A single agentic model (GPT-5.1, since it has tool-calling and credit) plans and calls tools (`lib/agent/tools.ts`): `web_search`, `web_fetch`, `run_js`, and — once Google is connected — `gmail_search`/`gmail_read`/`gmail_send`, `calendar_list_events`/`calendar_create_event`, `drive_search`/`drive_read_file`.
2. **Every tool call is shown to the user first and must be approved or denied** before it runs — nothing executes silently. This is a deliberate safety choice since the agent acts on a CEO's behalf. Actions that send an email or create a calendar event are flagged with a red border + ⚠️ so they stand out from read-only actions.
3. Once the agent has what it needs, it gives one final answer.

**File uploads**: the 📎 button in the composer lets the CEO attach a PDF, spreadsheet (.xlsx/.csv), or text/markdown file; its extracted content is included with the question for either mode to read and analyze (`lib/files/extract.ts`).

**Voice input**: the 🎤 button lets the CEO speak instead of typing — free, no API key, two layers (`lib/speech/*`):
1. **Chrome/Edge**: the browser's built-in Web Speech API, live — text appears as you talk.
2. **Safari/Firefox fallback**: records audio, sends it to this server, and transcribes it with a small local Whisper model (`@xenova/transformers`, runs fully on your own machine/server — nothing sent to OpenAI or anyone else). Needs `ffmpeg-static` to decode the recorded audio, already wired up.

Slack isn't wired up yet — same extension pattern as Google (see "Extending agent mode" below) would add it.

**Chat history**: every conversation is saved (`lib/conversations/*`, one JSON file per chat under `.data/conversations/`) and listed in the left sidebar, like ChatGPT — click a past chat to reopen it, "New chat" to start fresh, the sidebar collapses to a thin rail with the `«`/`»` button. A chat is only saved once its first turn finishes (so an abandoned empty chat never shows up), and its title is auto-generated from the first message.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your real keys (already done if .env.local exists)
npm run dev
```

Open http://localhost:3000 — you'll be asked for `APP_ACCESS_PASSWORD` first.

## Environment variables (`.env.local`)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | GPT |
| `GEMINI_API_KEY` | Gemini |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `XAI_API_KEY` | Grok |
| `TAVILY_API_KEY` | Optional. Powers `web_search` in agent mode (sign up free at [tavily.com](https://tavily.com)). Without it, the agent can still fetch specific URLs and run calculations, just can't discover pages on its own. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Optional. Enables Gmail/Calendar/Drive tools once the CEO connects their Google account via the "Connect Google" button in the header. See "Connecting Google Workspace" below for how to get these. |
| `JUDGE_PROVIDER` | Which model synthesizes the final answer first (`anthropic`, `openai`, `gemini`, `deepseek`, or `grok`). Falls back automatically to any model that answered successfully if this one fails. |
| `APP_ACCESS_PASSWORD` | Shared password gating the whole app. **Change this from the default before going live.** |

Never commit `.env.local` — it's already in `.gitignore`.

## Deploying on your own server (e.g. an E2E Networks VM)

This ships as a standalone Next.js server, so it runs anywhere Docker runs.

1. **Provision a VM** (E2E Networks, or any VPS) with Docker installed, and point a domain/subdomain at its IP (e.g. `cowork.yourcompany.com`) so it's reachable from phones/tablets/laptops anywhere.
2. **Copy the project to the server** (git clone, or `scp -r`), including a `.env.local` with real keys and a strong `APP_ACCESS_PASSWORD`.
3. **Build and run:**
   ```bash
   docker compose up -d --build
   ```
   The app listens on port 3000 inside the container.
4. **Put HTTPS in front of it** (required — phones/iPads won't treat an http:// site as fully trusted, and you don't want API traffic or the access password sent in plaintext). Easiest path: install `nginx` + `certbot` on the host and reverse-proxy to `127.0.0.1:3000`, e.g.:
   ```nginx
   server {
     server_name cowork.yourcompany.com;
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
   then `sudo certbot --nginx -d cowork.yourcompany.com` for a free TLS cert.
5. Share `https://cowork.yourcompany.com` and the access password with your CEO. It works the same on iPhone/Android/iPad/laptop — no app install needed, just a browser bookmark (can also be "Added to Home Screen" for an app-like icon).

### Updating after a code change

```bash
git pull
docker compose up -d --build
```

## Connecting Google Workspace (Gmail, Calendar, Drive)

This needs a one-time OAuth app setup in **your Google Workspace admin's** Google Cloud Console (not something I can create for you — it has to be done by someone with access to your company's Google account). Since the CEO's account is on a Workspace domain, this can be set to "Internal" and works immediately — no waiting on Google's review process.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or pick an existing one) for this app.
2. **Enable APIs** — go to "APIs & Services" → "Library" and enable: **Gmail API**, **Google Calendar API**, **Google Drive API**.
3. **Configure the OAuth consent screen** — "APIs & Services" → "OAuth consent screen":
   - User type: **Internal** (only shows if you're in a Workspace org — this is what skips Google's review).
   - App name: anything, e.g. "Cowork".
   - Scopes: add `gmail.readonly`, `gmail.send`, `calendar`, `drive.readonly`.
4. **Create credentials** — "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID":
   - Application type: **Web application**.
   - Authorized redirect URI: `http://localhost:3000/api/auth/google/callback` for local testing, or `https://cowork.yourcompany.com/api/auth/google/callback` once deployed (use the real one you'll deploy to).
5. Copy the **Client ID** and **Client Secret** it gives you into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```
6. Restart the app. A **"Connect Google"** button appears in the header — the CEO (or whoever is logged into the app) clicks it, signs in with their Workspace account, and approves access. After that, Gmail/Calendar/Drive tools become available to the agent automatically.

The resulting token is stored in a local file (`.data/google-tokens.json`, gitignored) — see the Docker volume note below so it survives container restarts in production.

## Extending agent mode (Slack, etc.)

Real company-tool access needs an OAuth app registered per service, under your own account/organization — this can't be done from code alone:

1. Register an OAuth app in that platform's developer console (e.g. api.slack.com/apps for Slack), with a redirect URI back to this app.
2. Add the resulting client ID/secret to `.env.local`.
3. Add a new tool in `lib/agent/tools.ts` (schema + executor) that calls that service's API using a stored access token, following the same pattern as the Google tools in `lib/tools/google.ts`.
4. Because every tool call already goes through the approval UI, a new "post to Slack" tool gets the same CEO-approval safety net automatically.

## Notes / known limitations

- This is a single shared password for one trusted user, not multi-user auth — fine for a single CEO, not meant for a whole company.
- If a provider's API key runs out of credit or hits a rate limit, that one model is skipped (shown in the collapsed panel) and the rest still produce a final answer.
- Model IDs in `lib/providers/*` (e.g. `gpt-5.1`, `claude-sonnet-5-5`, `gemini-pro-latest`, `grok-4`, `deepseek-chat`) may need updating over time as providers release new models.
- `run_js`'s sandbox (`lib/tools/runJs.ts`) blocks filesystem/network/process access but isn't a hardened security boundary — it's meant to contain mistakes in CEO-approved code, not run untrusted/adversarial code.
- The debate-vs-agent router (`classifyIntent`) is a single model call and can occasionally misroute an ambiguous request; if agent mode doesn't trigger when expected, be more explicit ("search for...", "calculate...", "check this page...").
- The Google OAuth refresh token is stored in one local file (`.data/google-tokens.json`), not a database — fine for one CEO's account, not designed for multiple Google accounts. Mount `.data/` as a Docker volume (already in `docker-compose.yml`) or it's lost on every redeploy.
- `gmail_send` and `calendar_create_event` are real, irreversible actions once approved (an email actually sends, an event actually gets created) — the approval UI is the only safety net, so read what's being sent/created before approving.
- File uploads: supports .pdf, .xlsx/.xls, .csv, .txt, .md, .json, up to 10MB; other formats (e.g. .docx) aren't parsed yet.
- Voice input: the Whisper fallback model downloads itself (~75MB) from Hugging Face the first time it's used, then caches locally — the first Safari/Firefox voice message will be slower than the rest. The server needs outbound internet access for that first download.
- Chat history is one JSON file per conversation under `.data/conversations/` (same Docker volume as the Google token, already set up) — fine for one person's history, not built for concurrent multi-user writes.
- If you leave a chat mid-approval (an agent turn waiting on Approve/Deny) and switch to another chat, reopening it later shows that turn as finished rather than still-pending — finish approving before navigating away.
