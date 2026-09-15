"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Use the current browser origin in local development so dynamic Next.js
  // ports (3001, 3002, ...) still reach the same auth API.
  baseURL: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : undefined),
});

export const { signIn, signUp, signOut, useSession } = authClient;
