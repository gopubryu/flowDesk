"use client";

import { useEffect, useRef, useState } from "react";

export default function AcceptInvitationPage() {
  const submitted = useRef(false);
  const [status, setStatus] = useState("초대 링크를 확인하는 중입니다.");
  const [error, setError] = useState("");

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (token) window.sessionStorage.setItem("flowdesk_pending_invitation", token);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

    if (!token) {
      setError("초대 토큰이 없습니다.");
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/auth/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            window.location.assign("/sign-in?returnTo=%2Finvitations%2Faccept");
            return;
          }
          setError(result.error ?? "초대를 수락할 수 없습니다.");
          return;
        }
        window.sessionStorage.removeItem("flowdesk_pending_invitation");
        setStatus(`${result.workspace.name} 업무 공간에 ${result.role} 권한으로 참여했습니다.`);
      } catch {
        setError("초대를 수락할 수 없습니다.");
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-primary">FLOWDESK</p>
        <h1 className="mt-2 text-2xl font-semibold">초대 수락</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {error || status}
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          초대 링크 수신은 이메일 제공업체 설정에 따라 달라집니다. 현재 이메일 제공업체가
          설정되지 않은 경우 관리자가 링크를 별도로 전달해야 합니다.
        </p>
      </section>
    </main>
  );
}
