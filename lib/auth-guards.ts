import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth";

export async function getServerSession(): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: await headers() });
}
