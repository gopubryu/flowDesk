import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth";

const integrationState = globalThis as typeof globalThis & {
  __flowdeskIntegrationSession?: AuthSession | null;
};

export function setIntegrationTestSession(session: AuthSession | null) {
  if (process.env.INTEGRATION_TEST !== "1") throw new Error("Integration session override is test-only");
  integrationState.__flowdeskIntegrationSession = session;
}

export async function getServerSession(): Promise<AuthSession | null> {
  if (process.env.INTEGRATION_TEST === "1" && "__flowdeskIntegrationSession" in integrationState) {
    return integrationState.__flowdeskIntegrationSession ?? null;
  }
  return auth.api.getSession({ headers: await headers() });
}
