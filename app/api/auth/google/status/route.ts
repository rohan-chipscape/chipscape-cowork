import { connection } from "next/server";
import { isGoogleConnected } from "@/lib/google/accountStore";

export async function GET() {
  await connection(); // reads a local file at request time; never prerender this
  const configured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
  return Response.json({ configured, connected: configured && isGoogleConnected() });
}
