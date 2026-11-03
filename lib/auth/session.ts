import { cookies } from "next/headers";

/** The Google account this browser/app session signed in with, if any. */
export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get("cowork_email")?.value ?? null;
}
