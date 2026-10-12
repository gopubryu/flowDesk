export class ClientRequestError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "ClientRequestError";
    this.status = status;
    this.url = url;
  }
}

function redirectToSignIn() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/sign-in") return;
  const next = `${window.location.pathname}${window.location.search}`;
  const query = new URLSearchParams({ reason: "session-expired", next });
  window.location.assign(`/sign-in?${query.toString()}`);
}

export async function clientJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = response.status === 204 ? "" : await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 401) redirectToSignIn();
    let message = text;
    try {
      const data = JSON.parse(text) as { error?: unknown };
      if (typeof data.error === "string") message = data.error;
    } catch {
      // Preserve non-JSON response text for diagnostics.
    }
    throw new ClientRequestError(message || `${response.status} ${response.statusText}`, response.status, url);
  }

  if (response.status === 204) return undefined as T;
  return JSON.parse(text) as T;
}
