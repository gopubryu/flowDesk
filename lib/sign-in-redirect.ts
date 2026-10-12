export function signInCallbackUrl(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  try {
    const url = new URL(next, "https://flowdesk.local");
    if (url.origin !== "https://flowdesk.local" || url.pathname === "/sign-in") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
