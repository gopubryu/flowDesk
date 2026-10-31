const PUBLIC_PATHS = new Set(["/sign-in", "/sign-up", "/invitations/accept"]);

/**
 * Optimistic page guard: decides from session-cookie presence only, before a page renders.
 * Real session validity is still enforced by every API route (401) and the client redirect.
 */
export function signInRedirectFor(pathname: string, search: string, hasSessionCookie: boolean): string | null {
  if (hasSessionCookie || PUBLIC_PATHS.has(pathname)) return null;
  const query = new URLSearchParams({ next: `${pathname}${search}` });
  return `/sign-in?${query.toString()}`;
}
