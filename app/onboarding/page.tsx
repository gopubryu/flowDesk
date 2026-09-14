"use client";

import { FormEvent, useState } from "react";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/auth/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "업무 공간을 만들 수 없습니다.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("업무 공간을 만들 수 없습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-wide text-primary">FLOWDESK</p>
          <h1 className="mt-2 text-2xl font-semibold">업무 공간 만들기</h1>
          <p className="mt-2 text-sm text-muted-foreground">새 업무 공간의 이름을 정해주세요.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            업무 공간 이름
            <input
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
              type="text"
              autoComplete="organization"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={pending}>
            {pending ? "만드는 중..." : "업무 공간 시작하기"}
          </button>
        </form>
      </section>
    </main>
  );
}
