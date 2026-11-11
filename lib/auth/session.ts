import { cookies } from "next/headers";

/** The Google account this browser/app session signed in with, if any. */
export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get("cowork_email")?.value ?? null;
}

/** The display name Google gave this session at sign-in, if any. */
export async function getSessionName(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get("cowork_user_name")?.value;
  return raw ? decodeURIComponent(raw) : null;
}

// Only this account can see every team member's chat history — everyone
// else only ever sees their own, same as before.
export const ADMIN_EMAIL = "rohan@chipscape.com";

export async function isAdminSession(): Promise<boolean> {
  return (await getSessionEmail()) === ADMIN_EMAIL;
}
