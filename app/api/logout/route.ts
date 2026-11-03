// Clears every session cookie set at login (lib/auth/session.ts reads
// cowork_email; proxy.ts reads cowork_auth). Max-Age=0 tells the browser to
// delete the cookie immediately rather than just letting it expire later.
const CLEARED = [
  "cowork_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  "cowork_email=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  "cowork_user_name=; Path=/; SameSite=Lax; Max-Age=0",
];

export async function POST() {
  // Built directly on a Headers instance (not a plain object) so the three
  // Set-Cookie entries stay separate response headers instead of being
  // collapsed into one comma-joined string.
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of CLEARED) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify({ ok: true }), { headers });
}
