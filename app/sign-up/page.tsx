"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result = await signUp.email({ name, email, password, callbackURL: "/" });
    setPending(false);
    if (result.error) setError(result.error.message ?? "회원가입에 실패했습니다.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-wide text-primary">FLOWDESK</p>
          <h1 className="mt-2 text-2xl font-semibold">회원가입</h1>
          <p className="mt-2 text-sm text-muted-foreground">새 업무 공간을 시작하세요.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            이름
            <input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            이메일
            <input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            비밀번호
            <input className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={pending}>
            {pending ? "가입 중..." : "회원가입"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          이미 계정이 있나요? <Link className="font-semibold text-primary hover:underline" href="/sign-in">로그인</Link>
        </p>
      </section>
    </main>
  );
}
