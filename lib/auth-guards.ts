import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth";

const integrationSessionStorage = new AsyncLocalStorage<AuthSession | null>();

export function setIntegrationTestSession(session: AuthSession | null) {
  if (process.env.INTEGRATION_TEST !== "1") throw new Error("Integration session override is test-only");
  integrationSessionStorage.enterWith(session);
}

export async function getServerSession(): Promise<AuthSession | null> {
  if (process.env.INTEGRATION_TEST === "1") {
    const session = integrationSessionStorage.getStore();
    if (session !== undefined) return session;
  }
  return auth.api.getSession({ headers: await headers() });
}
